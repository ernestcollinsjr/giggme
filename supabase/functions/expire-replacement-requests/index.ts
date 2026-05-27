import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "GigGme <noreply@giggme.com>", to: [to], subject, html }),
    });
  } catch (e) { console.error(e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date().toISOString();

  // Find open requests past deadline
  const { data: expired } = await admin
    .from("replacement_requests")
    .select("*")
    .eq("status", "open")
    .lt("deadline_at", now);

  let totalRuledOut = 0;
  for (const r of expired || []) {
    const { data: pending } = await admin
      .from("replacement_request_recipients")
      .select("id, performer_name, performer_email")
      .eq("request_id", r.id)
      .eq("status", "pending");

    if (pending && pending.length > 0) {
      await admin
        .from("replacement_request_recipients")
        .update({ status: "ruled_out", responded_at: now })
        .eq("request_id", r.id)
        .eq("status", "pending");
      totalRuledOut += pending.length;
    }

    // Final status
    const { data: anyAccepted } = await admin
      .from("replacement_request_recipients")
      .select("id")
      .eq("request_id", r.id)
      .eq("status", "accepted")
      .limit(1);

    const finalStatus = anyAccepted && anyAccepted.length > 0 ? "filled" : "expired";
    await admin.from("replacement_requests").update({ status: finalStatus }).eq("id", r.id);

    // Notify requester of timeout
    if (r.requester_email && finalStatus === "expired") {
      const ruledList = (pending || [])
        .map((p) => `<li>${p.performer_name || p.performer_email}</li>`)
        .join("");
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
          <h2 style="margin:0 0 12px;color:#dc2626">Cover request window closed — no replacement</h2>
          ${r.venue ? `<p><strong>Venue:</strong> ${r.venue}</p>` : ""}
          ${r.event_date ? `<p><strong>Date:</strong> ${r.event_date}${r.event_time ? " · " + r.event_time : ""}</p>` : ""}
          <p>The 30-minute response window expired. The following performer${(pending?.length || 0) === 1 ? " was" : "s were"} auto-ruled-out for not responding:</p>
          <ul>${ruledList}</ul>
          <p style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:8px">You may want to send another cover request to a wider group.</p>
        </div>
      `;
      await sendEmail(r.requester_email, "Cover request expired — no replacement found", html);
    }
  }

  return new Response(
    JSON.stringify({ requests_processed: expired?.length || 0, ruled_out: totalRuledOut }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
