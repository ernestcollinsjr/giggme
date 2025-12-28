import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GigInviteRequest {
  recipientEmail: string;
  recipientName: string;
  venueName: string;
  venueAddress: string;
  gigDate: string;
  gigTime: string;
  responseDeadline: string;
  bandLeaderName: string;
  bandName: string;
  notes?: string;
  attire?: string;
  rehearsalInfo?: {
    date: string;
    time: string;
    venue: string;
  };
  gigId?: string;
  memberId?: string;
}

function formatCountdown(deadlineDate: Date): string {
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return "Expired";
  }
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours >= 24) {
    const days = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    return `${days} day${days > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }
  
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}, ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
  }
  
  return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      recipientName,
      venueName,
      venueAddress,
      gigDate,
      gigTime,
      responseDeadline,
      bandLeaderName,
      bandName,
      notes,
      attire,
      rehearsalInfo,
      gigId,
      memberId,
    }: GigInviteRequest = await req.json();

    console.log("Sending gig invite to:", recipientEmail);

    const deadlineDate = new Date(responseDeadline);
    const countdownText = formatCountdown(deadlineDate);
    const formattedDeadline = deadlineDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const displayVenue = venueName || venueAddress;

    // Build rehearsal section if included
    const rehearsalSection = rehearsalInfo ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">📋 Rehearsal Scheduled</h3>
        <p style="margin: 5px 0; color: #78350f;"><strong>Date:</strong> ${rehearsalInfo.date}</p>
        <p style="margin: 5px 0; color: #78350f;"><strong>Time:</strong> ${rehearsalInfo.time}</p>
        <p style="margin: 5px 0; color: #78350f;"><strong>Location:</strong> ${rehearsalInfo.venue}</p>
      </div>
    ` : '';

    const emailResponse = await resend.emails.send({
      from: "Giggme <gigs@giggme.com>",
      to: [recipientEmail],
      subject: `🎸 Gig Invite: ${displayVenue} - Respond in ${countdownText}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <!-- Countdown Banner -->
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">⏰ RESPOND WITHIN</p>
            <h1 style="margin: 10px 0; font-size: 32px; font-weight: bold;">${countdownText}</h1>
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">Deadline: ${formattedDeadline}</p>
          </div>
          
          <!-- Main Content -->
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            
            <h2 style="color: #1f2937; margin: 0 0 20px 0;">Hey ${recipientName}! 🎵</h2>
            
            <p style="color: #4b5563; margin: 0 0 20px 0;">
              <strong>${bandLeaderName}</strong> from <strong>${bandName}</strong> has invited you to perform at an upcoming gig!
            </p>
            
            <!-- Gig Details Card -->
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">📍 Gig Details</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 120px;"><strong>Venue:</strong></td>
                  <td style="padding: 8px 0; color: #1f2937;">${displayVenue}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Address:</strong></td>
                  <td style="padding: 8px 0; color: #1f2937;">${venueAddress}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0; color: #1f2937;">${gigDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Show Time:</strong></td>
                  <td style="padding: 8px 0; color: #1f2937;">${gigTime}</td>
                </tr>
                ${attire ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;"><strong>Attire:</strong></td>
                  <td style="padding: 8px 0; color: #1f2937;">${attire}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            ${rehearsalSection}
            
            ${notes ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h4 style="color: #1e40af; margin: 0 0 10px 0;">📝 Notes</h4>
              <p style="color: #1e3a8a; margin: 0;">${notes}</p>
            </div>
            ` : ''}
            
            <!-- Response Reminder -->
            <div style="background-color: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
              <p style="color: #dc2626; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">
                ⏰ Time Remaining: ${countdownText}
              </p>
              <p style="color: #7f1d1d; margin: 0; font-size: 14px;">
                Please respond by ${formattedDeadline}
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${Deno.env.get("PUBLIC_SITE_URL") || "https://giggme.com"}/dashboard" 
                 style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                View & Respond to Gig
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0 0 0;">
              Log in to accept or decline this gig invitation.
            </p>
            
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              This invitation was sent via Giggme. 
              <a href="${Deno.env.get("PUBLIC_SITE_URL") || "https://giggme.com"}/notifications" style="color: #6b7280;">Manage notification preferences</a>
            </p>
          </div>
          
        </body>
        </html>
      `,
    });

    console.log("Gig invite email sent successfully:", emailResponse);

    // Track the email if we have gig and member IDs
    const resendEmailId = (emailResponse as { data?: { id?: string } })?.data?.id;
    if (gigId && memberId && resendEmailId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          await supabase.from('email_tracking').insert({
            gig_id: gigId,
            member_id: memberId,
            email: recipientEmail,
            resend_email_id: resendEmailId,
            status: 'sent',
          });
          
          console.log("Email tracking record created for:", resendEmailId);
        }
      } catch (trackingError) {
        console.error("Failed to create email tracking record:", trackingError);
      }
    }

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-gig-invite function:", error);
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