import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://giggme.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const RESPONSE_WINDOW_MIN = 30;

function fmtDeadline(d: Date) {
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GigGme <noreply@giggme.com>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!r.ok) console.error("Resend error", await r.text());
  } catch (e) {
    console.error("sendEmail failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const performerIds: string[] = Array.isArray(body.performer_ids) ? body.performer_ids : [];
    const message: string = (body.message || "").toString().trim();
    const venue: string | null = body.venue || null;
    const eventDate: string | null = body.event_date || null;
    const eventTime: string | null = body.event_time || null;

    if (!message || performerIds.length === 0) {
      return new Response(JSON.stringify({ error: "message and performer_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Requester profile
    const { data: requester } = await admin
      .from("profiles").select("id, name, email").eq("id", userId).maybeSingle();

    const deadline = new Date(Date.now() + RESPONSE_WINDOW_MIN * 60_000);

    // Insert request
    const { data: reqRow, error: reqErr } = await admin
      .from("replacement_requests")
      .insert({
        requester_id: userId,
        requester_email: requester?.email || userData.user.email || null,
        requester_name: requester?.name || null,
        venue, event_date: eventDate, event_time: eventTime,
        message,
        deadline_at: deadline.toISOString(),
        status: "open",
      })
      .select()
      .single();
    if (reqErr) throw reqErr;

    // Performer profiles
    const { data: profiles } = await admin
      .from("profiles").select("id, name, email").in("id", performerIds);

    const recipients = (profiles || []).map((p: any) => ({
      request_id: reqRow.id,
      performer_id: p.id,
      performer_email: p.email,
      performer_name: p.name,
      response_token: crypto.randomUUID() + "-" + crypto.randomUUID(),
      status: "pending",
    }));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid performers" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: insertedRecipients, error: recErr } = await admin
      .from("replacement_request_recipients")
      .insert(recipients)
      .select();
    if (recErr) throw recErr;

    // Insert in-app messages too
    const msgRows = recipients.map((r) => ({
      sender_id: userId,
      recipient_id: r.performer_id,
      is_group_message: false,
      content: `🚨 COVER REQUEST (reply within ${RESPONSE_WINDOW_MIN} min)\n\n${message}\n\n${venue ? "Venue: " + venue + "\n" : ""}${eventDate ? "Date: " + eventDate + "\n" : ""}${eventTime ? "Time: " + eventTime + "\n" : ""}\nCheck your email to accept or decline.`,
    }));
    await admin.from("messages").insert(msgRows);

    // Build & send performer emails
    const deadlineStr = fmtDeadline(deadline);
    const fnBase = `${SUPABASE_URL}/functions/v1/respond-replacement-request`;

    for (const r of insertedRecipients || []) {
      if (!r.performer_email) continue;
      const acceptUrl = `${fnBase}?token=${encodeURIComponent(r.response_token)}&action=accept`;
      const declineUrl = `${fnBase}?token=${encodeURIComponent(r.response_token)}&action=decline`;
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:600;color:#b91c1c;letter-spacing:0.05em;text-transform:uppercase">⏱ ${RESPONSE_WINDOW_MIN}-Minute Response Window</div>
            <div style="font-size:18px;font-weight:700;margin-top:6px">Reply by ${deadlineStr}</div>
            <div style="font-size:13px;color:#7f1d1d;margin-top:6px">If you don't respond by the deadline you'll automatically be ruled out for this cover.</div>
          </div>
          <h2 style="margin:0 0 8px;font-size:22px">Cover request from ${requester?.name || "your manager"}</h2>
          ${venue ? `<p style="margin:4px 0;color:#475569"><strong>Venue:</strong> ${venue}</p>` : ""}
          ${eventDate ? `<p style="margin:4px 0;color:#475569"><strong>Date:</strong> ${eventDate}${eventTime ? " · " + eventTime : ""}</p>` : ""}
          <p style="white-space:pre-wrap;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0">${message.replace(/</g, "&lt;")}</p>
          <div style="margin:24px 0;display:flex;gap:12px">
            <a href="${acceptUrl}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">✓ Accept gig</a>
            <a href="${declineUrl}" style="background:#dc2626;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;margin-left:8px">✗ Can't cover</a>
          </div>
          <p style="font-size:12px;color:#94a3b8;margin-top:24px">Sent via GigGme. No response = automatically ruled out.</p>
        </div>
      `;
      const subject = `🚨 Cover needed${venue ? " at " + venue : ""} — reply within ${RESPONSE_WINDOW_MIN} min`;
      await sendEmail(r.performer_email, subject, html);
    }

    // Summary email to requester
    const requesterEmail = requester?.email || userData.user.email;
    if (requesterEmail) {
      const listHtml = (insertedRecipients || [])
        .map((r) => `<li>${r.performer_name || r.performer_email} <span style="color:#94a3b8">(${r.performer_email || "no email"})</span></li>`)
        .join("");
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
          <h2 style="margin:0 0 12px">Cover request sent</h2>
          <p>Your replacement request was sent to ${insertedRecipients?.length || 0} performer${(insertedRecipients?.length || 0) === 1 ? "" : "s"}.</p>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:14px 0">
            <strong>Response deadline:</strong> ${deadlineStr}<br/>
            <span style="font-size:13px;color:#78350f">Non-responders will be auto-ruled-out after this time.</span>
          </div>
          ${venue ? `<p><strong>Venue:</strong> ${venue}</p>` : ""}
          ${eventDate ? `<p><strong>Date:</strong> ${eventDate}${eventTime ? " · " + eventTime : ""}</p>` : ""}
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0">${message.replace(/</g, "&lt;")}</p>
          <p><strong>Recipients:</strong></p>
          <ul>${listHtml}</ul>
          <p style="font-size:12px;color:#94a3b8;margin-top:24px">You'll get follow-up emails as each performer responds.</p>
        </div>
      `;
      await sendEmail(requesterEmail, `Cover request sent to ${insertedRecipients?.length || 0} performer${(insertedRecipients?.length || 0) === 1 ? "" : "s"}`, html);
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: reqRow.id,
        deadline_at: deadline.toISOString(),
        recipients: insertedRecipients?.length || 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("send-replacement-request error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
