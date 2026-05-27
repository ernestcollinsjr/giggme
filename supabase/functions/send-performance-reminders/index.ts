// Sends "1 day before" and "2 hours before" email reminders to performers
// for accepted booking_requests and accepted gig_members.
// Designed to be invoked by pg_cron every ~15 minutes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = 'GigGme <noreply@giggme.com>';

interface SendResult {
  sent: number;
  errors: number;
}

function fmtDate(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildHtml(opts: {
  recipientName?: string | null;
  windowLabel: string; // "tomorrow" or "in 2 hours"
  venue: string;
  whenLabel: string;
  notes?: string | null;
}): string {
  const greet = opts.recipientName ? `Hi ${opts.recipientName},` : 'Hi,';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#6d28d9,#2563eb);color:#fff;">
        <div style="font-size:13px;opacity:.85;">GigGme</div>
        <div style="font-size:18px;font-weight:600;margin-top:2px;">Performance reminder</div>
      </div>
      <div style="padding:20px 24px;color:#111827;">
        <p style="margin:0 0 12px 0;font-size:14px;">${greet}</p>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;">
          This is a reminder that your performance is <strong>${opts.windowLabel}</strong>.
        </p>
        <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:120px;">When</td><td style="padding:8px 12px;font-size:14px;">${opts.whenLabel}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Venue</td><td style="padding:8px 12px;font-size:14px;">${opts.venue}</td></tr>
          ${opts.notes ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Notes</td><td style="padding:8px 12px;font-size:14px;">${opts.notes}</td></tr>` : ''}
        </table>
        <p style="margin:20px 0 0 0;font-size:13px;color:#6b7280;">Break a leg! — The GigGme Team</p>
      </div>
    </div>
  </body></html>`;
}

async function sendEmail(to: string | (string | null | undefined)[], subject: string, html: string): Promise<boolean> {
  const recipients = (Array.isArray(to) ? to : [to]).filter((e): e is string => !!e);
  const unique = [...new Set(recipients.map((e) => e.toLowerCase()))];
  if (unique.length === 0) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: unique, subject, html }),
    });
    if (!res.ok) {
      console.error('Resend error', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('Email send threw', e);
    return false;
  }
}


async function getBookerEmail(supabase: any, bookerId: string | null | undefined): Promise<string | null> {
  if (!bookerId) return null;
  const { data } = await supabase.from('profiles').select('email').eq('id', bookerId).maybeSingle();
  return data?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const result: SendResult = { sent: 0, errors: 0 };

  // Window thresholds — fire when event is within (lower, upper) for each reminder type.
  // 1-day window: send when 22h < timeUntilEvent <= 26h
  // 2-hour window: send when 1h < timeUntilEvent <= 3h
  const upper1d = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();
  const lower1d = new Date(now.getTime() + 22 * 60 * 60 * 1000).toISOString();
  const upper2h = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  const lower2h = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();

  // ============ BOOKING REQUESTS ============
  // 1-day reminders for accepted booking_requests with event_date set
  const { data: br1d } = await supabase
    .from('booking_requests')
    .select('id, performer_email, performer_name, venue, event_date, note, booker_id')
    .eq('status', 'accepted')
    .eq('auto_reminders_disabled', false)
    .is('reminder_1d_sent_at', null)
    .not('event_date', 'is', null)
    .gt('event_date', lower1d)
    .lte('event_date', upper1d);

  for (const r of br1d ?? []) {
    if (!r.event_date) continue;
    const bookerEmail = await getBookerEmail(supabase, r.booker_id);
    const recipients = [r.performer_email, bookerEmail];
    if (!recipients.some((e) => !!e)) continue;
    const when = fmtDate(new Date(r.event_date));
    const ok = await sendEmail(
      recipients,
      `Reminder: performance tomorrow at ${r.venue}`,
      buildHtml({
        recipientName: r.performer_name,
        windowLabel: 'tomorrow',
        venue: r.venue,
        whenLabel: when,
        notes: r.note,
      }),
    );
    if (ok) {
      await supabase
        .from('booking_requests')
        .update({ reminder_1d_sent_at: new Date().toISOString() })
        .eq('id', r.id);
      result.sent++;
    } else result.errors++;
  }

  // 2-hour reminders for accepted booking_requests
  const { data: br2h } = await supabase
    .from('booking_requests')
    .select('id, performer_email, performer_name, venue, event_date, note, booker_id')
    .eq('status', 'accepted')
    .eq('auto_reminders_disabled', false)
    .is('reminder_2h_sent_at', null)
    .not('event_date', 'is', null)
    .gt('event_date', lower2h)
    .lte('event_date', upper2h);

  for (const r of br2h ?? []) {
    if (!r.event_date) continue;
    const bookerEmail = await getBookerEmail(supabase, r.booker_id);
    const recipients = [r.performer_email, bookerEmail];
    if (!recipients.some((e) => !!e)) continue;
    const when = fmtDate(new Date(r.event_date));
    const ok = await sendEmail(
      recipients,
      `Reminder: performance in 2 hours at ${r.venue}`,
      buildHtml({
        recipientName: r.performer_name,
        windowLabel: 'in about 2 hours',
        venue: r.venue,
        whenLabel: when,
        notes: r.note,
      }),
    );
    if (ok) {
      await supabase
        .from('booking_requests')
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq('id', r.id);
      result.sent++;
    } else result.errors++;
  }

  // ============ GIG MEMBERS ============
  // Fetch accepted gig_members whose gig.date falls in either window and reminder not yet sent.
  async function processGigWindow(field: 'reminder_1d_sent_at' | 'reminder_2h_sent_at', lo: string, hi: string, label: string, subjectPrefix: string) {
    const { data: gms } = await supabase
      .from('gig_members')
      .select(`id, member_id, ${field}, gigs!inner(id, user_id, date, venue, venue_name, notes, auto_reminders_disabled)`)
      .eq('status', 'accepted')
      .eq('gigs.auto_reminders_disabled', false)
      .is(field, null)
      .gt('gigs.date', lo)
      .lte('gigs.date', hi);

    if (!gms || gms.length === 0) return;
    const memberIds = [...new Set(gms.map((g: any) => g.member_id))];
    const ownerIds = [...new Set(gms.map((g: any) => g.gigs?.user_id).filter(Boolean))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', [...new Set([...memberIds, ...ownerIds])]);
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    for (const gm of gms as any[]) {
      const prof = profMap.get(gm.member_id);
      const gig = gm.gigs;
      const owner = gig?.user_id ? profMap.get(gig.user_id) : null;
      const recipients = [prof?.email, owner?.email];
      if (!recipients.some((e) => !!e)) continue;
      const when = fmtDate(new Date(gig.date));
      const venue = gig.venue_name || gig.venue;
      const ok = await sendEmail(
        recipients,
        `${subjectPrefix} ${venue}`,
        buildHtml({
          recipientName: prof.name,
          windowLabel: label,
          venue,
          whenLabel: when,
          notes: gig.notes,
        }),
      );
      if (ok) {
        await supabase
          .from('gig_members')
          .update({ [field]: new Date().toISOString() })
          .eq('id', gm.id);
        result.sent++;
      } else result.errors++;
    }
  }

  await processGigWindow('reminder_1d_sent_at', lower1d, upper1d, 'tomorrow', 'Reminder: gig tomorrow at');
  await processGigWindow('reminder_2h_sent_at', lower2h, upper2h, 'in about 2 hours', 'Reminder: gig in 2 hours at');

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
});
