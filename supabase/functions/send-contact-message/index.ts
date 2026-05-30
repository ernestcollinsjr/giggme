import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TO_EMAIL = "management@giggme.com";
const FROM_EMAIL = "GiggMe <management@giggme.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactPayload {
  name?: string;
  email?: string;
  category?: "sales" | "tech_support" | "other" | string;
  message?: string;
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  tech_support: "Tech Support",
  other: "Other",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const p: ContactPayload = await req.json();

    if (!p.name || !p.email || !p.message || !p.category) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const categoryLabel = CATEGORY_LABELS[p.category] ?? p.category;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
        <h1 style="color:#4F46E5;border-bottom:2px solid #4F46E5;padding-bottom:8px">New Contact Message</h1>
        <p><strong>Category:</strong> ${esc(categoryLabel)}</p>
        <p><strong>Name:</strong> ${esc(p.name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></p>
        <h2 style="font-size:16px;margin-top:24px">Message</h2>
        <p style="white-space:pre-wrap">${esc(p.message)}</p>
      </div>`;

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
        subject: `[${categoryLabel}] Contact from ${p.name}`,
        html,
      }),
    });

    if (!notify.ok) {
      const err = await notify.text();
      console.error("Resend notify error:", err);
      throw new Error(`Resend error: ${err}`);
    }

    // Confirmation to sender
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
        subject: "We received your message — GiggMe",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111">
            <h1 style="color:#4F46E5">Thanks, ${esc(p.name)}!</h1>
            <p>We received your <strong>${esc(categoryLabel)}</strong> message and will get back to you shortly.</p>
            <p>For reference, here's what you sent:</p>
            <blockquote style="border-left:3px solid #4F46E5;padding-left:12px;color:#444;white-space:pre-wrap">${esc(p.message)}</blockquote>
            <p style="margin-top:24px">— The GiggMe Team</p>
          </div>`,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("send-contact-message error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
