import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyAcceptedRequest {
  invitationId: string;
  acceptedByName: string;
  acceptedByEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invitationId, acceptedByName, acceptedByEmail }: NotifyAcceptedRequest = await req.json();

    console.log("Notifying band leader about accepted invitation:", invitationId);

    // Create Supabase client to fetch band leader info
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get invitation details with band info
    const { data: invitation, error: invitationError } = await supabase
      .from("band_invitations")
      .select(`
        id,
        email,
        recipient_name,
        band_id,
        invited_by,
        bands (
          name,
          band_leader_id
        )
      `)
      .eq("id", invitationId)
      .single();

    if (invitationError || !invitation) {
      console.error("Error fetching invitation:", invitationError);
      throw new Error("Invitation not found");
    }

    // Handle bands as object from single relation
    const bandData = invitation.bands as unknown as { name: string; band_leader_id: string };

    // Get band leader's profile
    const { data: bandLeader, error: leaderError } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", bandData.band_leader_id)
      .single();

    if (leaderError || !bandLeader) {
      console.error("Error fetching band leader:", leaderError);
      throw new Error("Band leader not found");
    }

    const memberName = acceptedByName || invitation.recipient_name || acceptedByEmail;
    const bandName = bandData.name;

    const configured = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "";
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const base = (configured || origin).toString().replace(/\/$/, "");
    const dashboardUrl = `${base}/dashboard`;

    const emailResponse = await resend.emails.send({
      from: "Giggme <notifications@giggme.com>",
      to: [bandLeader.email],
      subject: `🎉 ${memberName} accepted your invitation to ${bandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Great News! 🎉</h1>
          <p>Hello ${bandLeader.name}!</p>
          <p><strong>${memberName}</strong> has accepted your invitation to join <strong>${bandName}</strong>.</p>
          <p>They are now waiting to be added to the band. Head to your dashboard to complete the process:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" 
               style="background-color: #22c55e; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Once on your dashboard, go to your band's Team tab and click "Add to Band" next to their name.
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated notification from Giggme.
          </p>
        </div>
      `,
    });

    console.log("Notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-invitation-accepted function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
