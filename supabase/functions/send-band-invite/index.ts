import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BandInviteRequest {
  recipientEmail: string;
  recipientName?: string;
  bandName: string;
  inviteToken: string;
  bandLeaderName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, recipientName, bandName, inviteToken, bandLeaderName }: BandInviteRequest = await req.json();

    console.log("Sending band invite to:", recipientEmail, recipientName);

    // Always use the production domain for invite links so recipients never land
    // on Lovable preview/login URLs, even if environment settings are incorrect.
    const base = "https://giggme.com";
    const inviteUrl = `${base}/band-invite/${inviteToken}`;

    const greeting = recipientName ? `Hello ${recipientName}!` : "Hello!";

    const emailResponse = await resend.emails.send({
      from: "Giggme <invites@giggme.com>",
      to: [recipientEmail],
      subject: `You're invited to join ${bandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Group Invitation</h1>
          <p>${greeting}</p>
          <p>${bandLeaderName} has invited you to join <strong>${bandName}</strong>.</p>
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
    console.error("Error in send-band-invite function:", error);
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
