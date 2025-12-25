import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GigResponseRequest {
  gig_id: string;
  member_id: string;
  member_name: string;
  status: string;
}

// Send SMS via Twilio
async function sendSMS(to: string, message: string): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromPhone) {
    console.log("Twilio credentials not configured, skipping SMS");
    return false;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: fromPhone,
        Body: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Twilio SMS error:", error);
      return false;
    }

    console.log("SMS sent successfully to", to);
    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
}

// Send push notification
async function sendPushNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  url: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    // Get user's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'web');

    if (tokensError || !tokens || tokens.length === 0) {
      console.log('No push tokens found for user', userId);
      return false;
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      ...data,
    });

    for (const tokenRecord of tokens) {
      try {
        const subscription = JSON.parse(tokenRecord.token);
        const endpoint = subscription.endpoint;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
          },
          body: payload,
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('Push failed:', response.status, text);
          
          // Remove stale tokens
          if (response.status === 404 || response.status === 410) {
            await supabase.from('push_tokens').delete().eq('id', tokenRecord.id);
            console.log('Removed stale token:', tokenRecord.id);
          }
        } else {
          console.log('Push sent successfully to token:', tokenRecord.id);
        }
      } catch (error) {
        console.error('Error sending push to token:', tokenRecord.id, error);
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}

// Create in-app notification
async function createInAppNotification(
  supabase: any,
  userId: string,
  title: string,
  message: string,
  type: string,
  relatedId: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      related_id: relatedId,
    });

    if (error) {
      console.error('Failed to create in-app notification:', error);
      return false;
    }

    console.log('In-app notification created for user:', userId);
    return true;
  } catch (error) {
    console.error('Error creating in-app notification:', error);
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-gig-response function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { gig_id, member_id, member_name, status }: GigResponseRequest = await req.json();
    console.log(`Processing response: ${member_name} ${status} gig ${gig_id}`);

    // Get gig details
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("venue, venue_name, date, user_id")
      .eq("id", gig_id)
      .single();

    if (gigError || !gig) {
      console.error("Error fetching gig:", gigError);
      return new Response(
        JSON.stringify({ error: "Gig not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get band leader's contact info
    const { data: bandLeader, error: leaderError } = await supabase
      .from("profiles")
      .select("email, name, phone_number")
      .eq("id", gig.user_id)
      .single();

    if (leaderError || !bandLeader) {
      console.error("Error fetching band leader:", leaderError);
      return new Response(
        JSON.stringify({ error: "Band leader not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get band leader's notification preferences
    const { data: notifPrefs } = await supabase
      .from("notification_preferences")
      .select("email_enabled, sms_enabled, push_enabled")
      .eq("user_id", gig.user_id)
      .single();

    // Default to enabled if no preferences set
    const emailEnabled = notifPrefs?.email_enabled ?? true;
    const smsEnabled = notifPrefs?.sms_enabled ?? true;
    const pushEnabled = notifPrefs?.push_enabled ?? true;

    console.log(`Notification preferences - Email: ${emailEnabled}, SMS: ${smsEnabled}, Push: ${pushEnabled}`);

    const venueName = gig.venue_name || gig.venue;
    const gigDate = new Date(gig.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const shortDate = new Date(gig.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const statusEmoji = status === "accepted" ? "✅" : status === "declined" ? "❌" : "⏳";
    const statusText = status === "accepted" ? "accepted" : status === "declined" ? "declined" : "is pending on";
    const statusColor = status === "accepted" ? "#22c55e" : status === "declined" ? "#ef4444" : "#eab308";

    // Send push notification if enabled
    let pushSent = false;
    if (pushEnabled) {
      const pushTitle = `${statusEmoji} Gig RSVP Update`;
      const pushBody = `${member_name} has ${statusText} the gig at ${venueName} on ${shortDate}`;
      pushSent = await sendPushNotification(
        supabase,
        gig.user_id,
        pushTitle,
        pushBody,
        '/bookings',
        { type: 'gig_response', gig_id }
      );
    } else {
      console.log("Push notifications disabled for this user");
    }

    // Create in-app notification (always create)
    await createInAppNotification(
      supabase,
      gig.user_id,
      `${statusEmoji} Gig RSVP Update`,
      `${member_name} has ${statusText} the gig at ${venueName} on ${shortDate}`,
      'gig_response',
      gig_id
    );

    // Send email notification if enabled
    let emailSent = false;
    if (emailEnabled) {
      console.log(`Sending email to ${bandLeader.email}`);
      try {
        const emailResponse = await resend.emails.send({
          from: "GigSync <onboarding@resend.dev>",
          to: [bandLeader.email],
          subject: `${statusEmoji} ${member_name} has ${statusText} the gig at ${venueName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <h1 style="margin: 0 0 24px; font-size: 24px; color: #18181b;">Gig RSVP Update</h1>
                  
                  <div style="background-color: ${statusColor}15; border-left: 4px solid ${statusColor}; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                    <p style="margin: 0; font-size: 18px; color: #18181b;">
                      <strong>${member_name}</strong> has <strong style="color: ${statusColor};">${statusText}</strong> the gig
                    </p>
                  </div>
                  
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <h2 style="margin: 0 0 12px; font-size: 14px; text-transform: uppercase; color: #71717a; letter-spacing: 0.5px;">Gig Details</h2>
                    <p style="margin: 0 0 8px; font-size: 16px; color: #18181b;">
                      <strong>📍 Venue:</strong> ${venueName}
                    </p>
                    <p style="margin: 0; font-size: 16px; color: #18181b;">
                      <strong>📅 Date:</strong> ${gigDate}
                    </p>
                  </div>
                  
                  <p style="margin: 0; font-size: 14px; color: #71717a;">
                    You're receiving this email because you're the band leader for this gig.
                  </p>
                </div>
                
                <p style="text-align: center; margin-top: 20px; font-size: 12px; color: #a1a1aa;">
                  Sent by GigSync
                </p>
              </div>
            </body>
            </html>
          `,
        });
        console.log("Email sent successfully:", emailResponse);
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
      }
    } else {
      console.log("Email notifications disabled for this user");
    }

    // Send SMS notification if enabled and phone number is available
    let smsSent = false;
    if (smsEnabled && bandLeader.phone_number) {
      const smsMessage = `${statusEmoji} GigSync: ${member_name} has ${statusText} your gig at ${venueName} on ${shortDate}.`;
      smsSent = await sendSMS(bandLeader.phone_number, smsMessage);
    } else if (!smsEnabled) {
      console.log("SMS notifications disabled for this user");
    } else {
      console.log("No phone number available for band leader, skipping SMS");
    }

    return new Response(
      JSON.stringify({ success: true, emailSent, smsSent, pushSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-gig-response function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
