import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelRequest {
  gig_id: string;
  performer_id: string;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gig_id, performer_id, reason }: CancelRequest = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let { data: gig, error: gigErr } = await supabase
      .from("gigs")
      .select("id, venue, venue_name, date, band_id, user_id")
      .eq("id", gig_id)
      .maybeSingle();

    let bookingRequest: any = null;
    if (!gig) {
      const { data: br, error: brErr } = await supabase
        .from("booking_requests")
        .select("id, venue, event_date, dates_text, time_text, booker_id, booker_name, performer_id")
        .eq("id", gig_id)
        .maybeSingle();
      if (brErr || !br) throw brErr || gigErr || new Error("Gig not found");
      bookingRequest = br;
      gig = {
        id: br.id,
        venue: br.venue || br.booker_name || "Booking",
        venue_name: null,
        date: br.event_date,
        band_id: null,
        user_id: br.booker_id,
      };
    }

    const { data: performer } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", performer_id)
      .single();

    // Find booking manager(s) — collect IDs from every possible relationship
    const managerIds = new Set<string>();

    // 1) Via the gig's band
    if (gig.band_id) {
      const { data: bmBands } = await supabase
        .from("booking_manager_bands")
        .select("booking_manager_id")
        .eq("band_id", gig.band_id);
      (bmBands || []).forEach((r: any) => r.booking_manager_id && managerIds.add(r.booking_manager_id));
    }

    // 2) Via direct artist link (booking_manager_artists)
    const { data: bmArtists } = await supabase
      .from("booking_manager_artists")
      .select("booking_manager_id")
      .eq("artist_id", performer_id);
    (bmArtists || []).forEach((r: any) => r.booking_manager_id && managerIds.add(r.booking_manager_id));

    // 3) Via any band the performer is a member of
    const { data: perfBands } = await supabase
      .from("band_members")
      .select("band_id")
      .eq("member_id", performer_id);
    const bandIds = (perfBands || []).map((r: any) => r.band_id).filter(Boolean);
    if (bandIds.length) {
      const { data: bmb2 } = await supabase
        .from("booking_manager_bands")
        .select("booking_manager_id")
        .in("band_id", bandIds);
      (bmb2 || []).forEach((r: any) => r.booking_manager_id && managerIds.add(r.booking_manager_id));
    }

    // 4) Gig owner if different from performer
    if (gig.user_id && gig.user_id !== performer_id) {
      managerIds.add(gig.user_id);
    }
    if (bookingRequest?.booker_id && bookingRequest.booker_id !== performer_id) {
      managerIds.add(bookingRequest.booker_id);
    }

    managerIds.delete(performer_id);

    const managerEmails: { email: string; name: string }[] = [];
    if (managerIds.size) {
      const { data: bms } = await supabase
        .from("profiles")
        .select("name, email")
        .in("id", Array.from(managerIds));
      (bms || []).forEach((b: any) => b.email && managerEmails.push(b));
    }

    const venueDisplay = gig.venue_name || gig.venue;
    const gigDate = gig.date ? new Date(gig.date).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) : bookingRequest?.dates_text || "Date TBD";
    const performerName = performer?.name || "A performer";
    const reasonBlock = reason
      ? `<p style="margin:16px 0;padding:12px;background:#f4f4f5;border-radius:6px"><strong>Reason:</strong> ${reason}</p>`
      : "";

    const fromAddr = "GiggMe <notifications@giggme.com>";

    // Email booking manager(s) / owner
    const mgrResults = await Promise.allSettled(
      managerEmails.map((m) =>
        resend.emails.send({
          from: fromAddr,
          to: [m.email],
          subject: `Gig Cancellation: ${performerName} at ${venueDisplay}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#dc2626">Gig Cancellation Notice</h2>
              <p>Hi ${m.name || "there"},</p>
              <p><strong>${performerName}</strong> has cancelled their commitment to the following gig:</p>
              <div style="margin:16px 0;padding:16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px">
                <p style="margin:0"><strong>Venue:</strong> ${venueDisplay}</p>
                <p style="margin:8px 0 0 0"><strong>Date:</strong> ${gigDate}</p>
              </div>
              ${reasonBlock}
              <p>Please log in to GiggMe to find a replacement or update the gig status.</p>
              <p style="color:#666;font-size:12px;margin-top:32px">This is an automated notification from GiggMe.</p>
            </div>
          `,
        })
      )
    );
    console.log("Manager emails:", JSON.stringify(mgrResults));

    // Confirmation email to performer
    if (performer?.email) {
      await resend.emails.send({
        from: fromAddr,
        to: [performer.email],
        subject: `Cancellation Confirmed: ${venueDisplay}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2>Your cancellation is confirmed</h2>
            <p>Hi ${performer.name || "there"},</p>
            <p>We've recorded your cancellation for the following gig:</p>
            <div style="margin:16px 0;padding:16px;background:#f4f4f5;border-radius:4px">
              <p style="margin:0"><strong>Venue:</strong> ${venueDisplay}</p>
              <p style="margin:8px 0 0 0"><strong>Date:</strong> ${gigDate}</p>
            </div>
            ${reasonBlock}
            <p>The booking manager has been notified.</p>
            <p style="color:#666;font-size:12px;margin-top:32px">This is an automated notification from GiggMe.</p>
          </div>
        `,
      });
    }

    // Push notifications + in-app notifications
    const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`;
    const pushHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    };

    const mgrPushPromises = Array.from(managerIds).map((uid) =>
      fetch(pushUrl, {
        method: "POST",
        headers: pushHeaders,
        body: JSON.stringify({
          user_id: uid,
          title: "Gig Cancellation",
          body: `${performerName} cancelled ${venueDisplay} on ${gigDate}${reason ? ` — ${reason}` : ""}`,
          url: "/booking-manager",
        }),
      }).catch((e) => console.error("mgr push err", e))
    );

    const performerPushPromise = performer_id
      ? fetch(pushUrl, {
          method: "POST",
          headers: pushHeaders,
          body: JSON.stringify({
            user_id: performer_id,
            title: "Cancellation Confirmed",
            body: `Your cancellation for ${venueDisplay} on ${gigDate} has been recorded.`,
            url: "/dashboard",
          }),
        }).catch((e) => console.error("perf push err", e))
      : Promise.resolve();

    const notifRows = [
      ...Array.from(managerIds).map((uid) => ({
        user_id: uid,
        type: "gig_cancellation",
        title: "Gig Cancellation",
        message: `${performerName} cancelled ${venueDisplay} on ${gigDate}${reason ? ` — ${reason}` : ""}`,
        data: { gig_id, performer_id, reason },
      })),
      ...(performer_id
        ? [{
            user_id: performer_id,
            type: "gig_cancellation_confirmed",
            title: "Cancellation Confirmed",
            message: `Your cancellation for ${venueDisplay} on ${gigDate} has been recorded.`,
            data: { gig_id, reason },
          }]
        : []),
    ];
    if (notifRows.length) {
      await supabase.from("notifications").insert(notifRows as any);
    }

    await Promise.allSettled([...mgrPushPromises, performerPushPromise]);

    return new Response(
      JSON.stringify({ success: true, managersNotified: managerEmails.length, pushSent: managerIds.size + (performer_id ? 1 : 0) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("notify-gig-cancellation error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
