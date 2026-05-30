import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TO_EMAIL = "management@giggme.com";
const FROM_EMAIL = "GiggMe <management@giggme.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoPayload {
  audience?: string;
  role?: string;
  teamSize?: string | null;
  challenges?: string[];
  name?: string;
  email?: string;
  phone?: string;
  scheduledFor?: string | null;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const p: DemoPayload = await req.json();

    const challengesHtml = (p.challenges ?? []).map((c) => `<li>${esc(c)}</li>`).join("") || "<li>None listed</li>";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
        <h1 style="color:#4F46E5;border-bottom:2px solid #4F46E5;padding-bottom:8px">New Demo Request</h1>
        <h2 style="font-size:16px;margin-top:24px">Contact</h2>
        <p><strong>Name:</strong> ${esc(p.name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>
        <p><strong>Phone:</strong> ${esc(p.phone)}</p>
        <h2 style="font-size:16px;margin-top:24px">About</h2>
        <p><strong>Audience:</strong> ${esc(p.audience)}</p>
        <p><strong>Role:</strong> ${esc(p.role)}</p>
        ${p.teamSize ? `<p><strong>Team Size:</strong> ${esc(p.teamSize)}</p>` : ""}
        <h2 style="font-size:16px;margin-top:24px">Challenges / Interests</h2>
        <ul>${challengesHtml}</ul>
        <h2 style="font-size:16px;margin-top:24px">Requested Time</h2>
        <p>${esc(p.scheduledFor) || "Not specified"}</p>
      </div>`;

    // Notify GiggMe
    const notify = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: p.email,
        subject: `New Demo Request — ${p.name ?? "Unknown"} (${p.audience ?? ""})`,
        html,
      }),
    });

    if (!notify.ok) {
      const err = await notify.text();
      console.error("Resend notify error:", err);
      throw new Error(`Resend error: ${err}`);
    }

    // Confirmation to requester
    if (p.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [p.email],
          reply_to: TO_EMAIL,
          subject: "Your GiggMe demo request",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
              <h1 style="color:#4F46E5">Thanks, ${esc(p.name) || "there"}!</h1>
              <p>We received your demo request and will be in touch shortly${p.scheduledFor ? ` to confirm <strong>${esc(p.scheduledFor)}</strong>` : ""}.</p>
              <p>If you need to reach us in the meantime, reply to this email or write to <a href="mailto:management@giggme.com">management@giggme.com</a>.</p>
              <p style="margin-top:24px">— The GiggMe Team</p>
            </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("send-demo-request error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
