import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  user_id: string;
  email?: string | null;
  name?: string | null;
}

interface ReminderJob {
  source: "gig" | "booking_request";
  id: string;
  venue: string;
  eventAt: Date;
  recipients: Recipient[];
  tier: "24h" | "3h" | "30m";
  column: "reminder_24h_sent_at" | "reminder_3h_sent_at" | "reminder_30m_sent_at";
}

const TIERS: Array<{ tier: "24h" | "3h" | "30m"; minutes: number; window: number; column: ReminderJob["column"]; label: string }> = [
  { tier: "24h", minutes: 24 * 60, window: 60, column: "reminder_24h_sent_at", label: "in 24 hours" },
  { tier: "3h", minutes: 3 * 60, window: 30, column: "reminder_3h_sent_at", label: "in 3 hours" },
  { tier: "30m", minutes: 30, window: 15, column: "reminder_30m_sent_at", label: "in 30 minutes" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails("mailto:notify@giggme.com", vapidPublic, vapidPrivate);
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25h ahead
  const sentCounts = { push: 0, email: 0, gigs: 0, requests: 0 };

  // Pull candidate gigs in the next 25 hours
  const { data: gigs } = await supabase
    .from("gigs")
    .select("id, user_id, date, venue, venue_name, loading_time, sound_check_time, band_id, reminder_24h_sent_at, reminder_3h_sent_at, reminder_30m_sent_at")
    .gte("date", now.toISOString())
    .lte("date", horizon.toISOString());

  const { data: requests } = await supabase
    .from("booking_requests")
    .select("id, booker_id, performer_id, event_date, venue, status, reminder_24h_sent_at, reminder_3h_sent_at, reminder_30m_sent_at")
    .eq("status", "accepted")
    .gte("event_date", now.toISOString())
    .lte("event_date", horizon.toISOString());

  const jobs: ReminderJob[] = [];

  for (const g of gigs || []) {
    const eventAt = computeEventAt(g.date, g.loading_time, g.sound_check_time);
    if (!eventAt) continue;
    for (const t of TIERS) {
      const due = isDue(now, eventAt, t.minutes, t.window);
      if (!due) continue;
      if ((g as any)[t.column]) continue;
      const recipients = await collectGigRecipients(supabase, g.id, g.user_id);
      jobs.push({
        source: "gig",
        id: g.id,
        venue: g.venue_name || g.venue,
        eventAt,
        recipients,
        tier: t.tier,
        column: t.column,
      });
    }
  }

  for (const r of requests || []) {
    const eventAt = r.event_date ? new Date(r.event_date) : null;
    if (!eventAt) continue;
    for (const t of TIERS) {
      const due = isDue(now, eventAt, t.minutes, t.window);
      if (!due) continue;
      if ((r as any)[t.column]) continue;
      const recipients: Recipient[] = [];
      if (r.booker_id) recipients.push({ user_id: r.booker_id });
      if (r.performer_id) recipients.push({ user_id: r.performer_id });
      jobs.push({
        source: "booking_request",
        id: r.id,
        venue: r.venue,
        eventAt,
        recipients,
        tier: t.tier,
        column: t.column,
      });
    }
  }

  for (const job of jobs) {
    // Hydrate recipients with profile + preferences
    const userIds = Array.from(new Set(job.recipients.map((r) => r.user_id)));
    if (userIds.length === 0) continue;

    const [{ data: profiles }, { data: prefs }, { data: tokens }] = await Promise.all([
      supabase.from("profiles").select("id, name, email").in("id", userIds),
      supabase.from("notification_preferences").select("user_id, push_enabled, email_enabled").in("user_id", userIds),
      supabase.from("push_tokens").select("user_id, token, platform").in("user_id", userIds),
    ]);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const prefMap = new Map((prefs || []).map((p: any) => [p.user_id, p]));

    const tier = TIERS.find((t) => t.tier === job.tier)!;
    const title = `Gig ${tier.label}`;
    const body = `${job.venue} — tap to navigate`;

    // Web push
    for (const tok of tokens || []) {
      const pref = prefMap.get(tok.user_id);
      if (pref && pref.push_enabled === false) continue;
      try {
        const subscription = JSON.parse(tok.token);
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title, body, data: { gigId: job.id, source: job.source } }),
        );
        sentCounts.push++;
      } catch (err) {
        console.error("push failed", tok.user_id, err);
      }
    }

    // Email via the existing transactional email function (best-effort)
    for (const uid of userIds) {
      const pref = prefMap.get(uid);
      if (pref && pref.email_enabled === false) continue;
      const profile = profileMap.get(uid) as any;
      if (!profile?.email) continue;
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: profile.email,
            subject: `Reminder: gig ${tier.label} at ${job.venue}`,
            html: `<p>Hi ${profile.name || "there"},</p><p>Your gig at <strong>${escapeHtml(job.venue)}</strong> starts ${tier.label} (${job.eventAt.toLocaleString()}).</p><p>Open the app to navigate and update your travel status.</p>`,
            purpose: "transactional",
            idempotency_key: `gig-reminder-${job.source}-${job.id}-${job.tier}-${uid}`,
          }),
        });
        sentCounts.email++;
      } catch (err) {
        console.error("email failed", uid, err);
      }
    }

    // Stamp the reminder column so we don't resend
    const table = job.source === "gig" ? "gigs" : "booking_requests";
    await supabase.from(table).update({ [job.column]: now.toISOString() }).eq("id", job.id);
    if (job.source === "gig") sentCounts.gigs++;
    else sentCounts.requests++;
  }

  return new Response(JSON.stringify({ ok: true, processed: jobs.length, ...sentCounts }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

function computeEventAt(dateIso: string, loading?: string | null, soundCheck?: string | null): Date | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  const t = loading || soundCheck;
  if (t) {
    const [h, m] = t.split(":").map(Number);
    if (!Number.isNaN(h)) d.setHours(h, m || 0, 0, 0);
  }
  return d;
}

function isDue(now: Date, eventAt: Date, minutesBefore: number, windowMinutes: number): boolean {
  const minutesUntil = (eventAt.getTime() - now.getTime()) / 60000;
  // Fire when we're inside [minutesBefore - window, minutesBefore]
  return minutesUntil <= minutesBefore && minutesUntil >= minutesBefore - windowMinutes;
}

async function collectGigRecipients(supabase: any, gigId: string, ownerId: string): Promise<Recipient[]> {
  const recipients: Recipient[] = [{ user_id: ownerId }];
  const { data: members } = await supabase
    .from("gig_members")
    .select("member_id")
    .eq("gig_id", gigId)
    .eq("status", "accepted");
  (members || []).forEach((m: any) => recipients.push({ user_id: m.member_id }));

  // Booking managers who manage this artist
  const { data: mgrs } = await supabase
    .from("booking_manager_artists")
    .select("booking_manager_id")
    .eq("artist_id", ownerId);
  (mgrs || []).forEach((m: any) => recipients.push({ user_id: m.booking_manager_id }));

  return recipients;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
