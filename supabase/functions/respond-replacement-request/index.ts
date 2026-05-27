import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function page(title: string, message: string, color: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:40px 16px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.08);text-align:center">
        <div style="font-size:48px;margin-bottom:8px">${color === "#059669" ? "✓" : color === "#dc2626" ? "✗" : "⏱"}</div>
        <h1 style="color:${color};margin:0 0 12px">${title}</h1>
        <p style="color:#475569;font-size:16px;line-height:1.5">${message}</p>
      </div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "GigGme <noreply@giggme.com>", to: [to], subject, html }),
    });
  } catch (e) { console.error("sendEmail failed", e); }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");

  if (!token || (action !== "accept" && action !== "decline")) {
    return page("Invalid link", "This response link is invalid.", "#dc2626");
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: rec } = await admin
      .from("replacement_request_recipients")
      .select("*, replacement_requests(*)")
      .eq("response_token", token)
      .maybeSingle();

    if (!rec) return page("Invalid link", "We couldn't find this response request.", "#dc2626");

    const reqRow: any = rec.replacement_requests;

    if (rec.status !== "pending") {
      return page("Already responded", `You already responded as "${rec.status}".`, "#64748b");
    }
    if (new Date(reqRow.deadline_at).getTime() < Date.now() || reqRow.status !== "open") {
      // Mark expired if not already
      await admin
        .from("replacement_request_recipients")
        .update({ status: "ruled_out", responded_at: new Date().toISOString() })
        .eq("id", rec.id);
      return page("Response window closed", "The 30-minute response window has expired. You've been ruled out for this cover.", "#dc2626");
    }

    const newStatus = action === "accept" ? "accepted" : "declined";
    await admin
      .from("replacement_request_recipients")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", rec.id);

    // If accepted: mark request filled and rule out other pending recipients
    if (action === "accept") {
      await admin
        .from("replacement_requests")
        .update({ status: "filled", filled_by: rec.performer_id })
        .eq("id", reqRow.id);
      await admin
        .from("replacement_request_recipients")
        .update({ status: "ruled_out", responded_at: new Date().toISOString() })
        .eq("request_id", reqRow.id)
        .eq("status", "pending");
    }

    // Notify requester
    if (reqRow.requester_email) {
      const color = action === "accept" ? "#059669" : "#dc2626";
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
          <h2 style="margin:0 0 12px;color:${color}">${rec.performer_name || "A performer"} ${action === "accept" ? "ACCEPTED" : "declined"} the cover</h2>
          ${reqRow.venue ? `<p><strong>Venue:</strong> ${reqRow.venue}</p>` : ""}
          ${reqRow.event_date ? `<p><strong>Date:</strong> ${reqRow.event_date}${reqRow.event_time ? " · " + reqRow.event_time : ""}</p>` : ""}
          ${action === "accept" ? `<p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:12px;border-radius:8px"><strong>The cover is filled.</strong> All other pending performers have been auto-ruled-out.</p>` : `<p style="color:#475569">They can't cover this gig. Other performers may still respond.</p>`}
          ${rec.performer_email ? `<p style="font-size:13px;color:#64748b">Reply directly: ${rec.performer_email}</p>` : ""}
        </div>
      `;
      await sendEmail(
        reqRow.requester_email,
        `${action === "accept" ? "✓ Cover ACCEPTED" : "✗ Cover declined"} — ${rec.performer_name || "performer"}`,
        html,
      );
    }

    if (action === "accept") {
      return page("Thanks — you're on!", `We've notified ${reqRow.requester_name || "the manager"}. You're confirmed to cover this gig.`, "#059669");
    }
    return page("Response recorded", "Thanks for letting us know. We'll keep looking.", "#dc2626");
  } catch (e: any) {
    console.error("respond-replacement-request error", e);
    return page("Something went wrong", "Please try again or contact your manager.", "#dc2626");
  }
});
