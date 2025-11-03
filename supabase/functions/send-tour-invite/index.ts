import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TourInviteRequest {
  recipientEmail: string;
  tourName: string;
  inviteToken: string;
  tourManagerName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, tourName, inviteToken, tourManagerName }: TourInviteRequest = await req.json();

    console.log("Sending tour invite to:", recipientEmail);

    const configured = Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "";
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const base = (configured || origin).toString().replace(/\/$/, "");
    const inviteUrl = `${base}/tour-invite/${inviteToken}`;

    const emailResponse = await resend.emails.send({
      from: "Gig Manager <invites@giggme.com>",
      to: [recipientEmail],
      subject: `You're invited to join ${tourName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Tour Invitation</h1>
          <p>Hello!</p>
          <p>${tourManagerName} has invited you to join the crew for <strong>${tourName}</strong>.</p>
          <p>Click the button below to accept this invitation:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${inviteUrl}">${inviteUrl}</a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This invitation link will expire in 7 days.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-tour-invite function:", error);
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
