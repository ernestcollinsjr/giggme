import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  request_id: string;
  band_id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  notify_via: ('email' | 'sms')[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      request_id, 
      band_id, 
      title, 
      description, 
      start_date, 
      end_date,
      notify_via = ['email', 'sms']
    }: NotificationRequest = await req.json();

    console.log(`Processing availability request notification for ${request_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: band, error: bandError } = await supabase
      .from('bands')
      .select('name')
      .eq('id', band_id)
      .single();

    if (bandError) {
      console.error('Error fetching band:', bandError);
      throw new Error('Band not found');
    }

    const { data: members, error: membersError } = await supabase
      .from('band_members')
      .select('member_id, profiles:member_id(id, name, email, phone_number)')
      .eq('band_id', band_id);

    if (membersError) {
      console.error('Error fetching band members:', membersError);
      throw new Error('Failed to fetch band members');
    }

    console.log(`Found ${members?.length || 0} band members to notify`);

    const results = { emails_sent: 0, emails_failed: 0, sms_sent: 0, sms_failed: 0 };

    const formattedStartDate = new Date(start_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const formattedEndDate = new Date(end_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://lovable.dev';

    if (notify_via.includes('email')) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        
        for (const member of members || []) {
          const profile = (member.profiles as unknown) as { id: string; name: string; email: string; phone_number: string | null } | null;
          if (profile?.email) {
            try {
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">📅 Availability Request from ${band.name}</h2>
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">${title}</h3>
                    ${description ? `<p style="color: #666;">${description}</p>` : ''}
                    <p style="margin-bottom: 0;"><strong>Date Range:</strong> ${formattedStartDate} - ${formattedEndDate}</p>
                  </div>
                  <p>Hi ${profile.name},</p>
                  <p>Your band leader is looking for availability for upcoming gigs. Please log in and submit your available dates.</p>
                  <div style="margin: 30px 0;">
                    <a href="${siteUrl}/dashboard" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Submit Your Availability</a>
                  </div>
                  <p style="color: #666; font-size: 14px;">Thanks for being part of ${band.name}!</p>
                </div>
              `;
              await resend.emails.send({
                from: 'Band Manager <onboarding@resend.dev>',
                to: [profile.email],
                subject: `📅 ${band.name}: Availability Request - ${title}`,
                html: emailHtml,
              });
              console.log(`Email sent to ${profile.name}`);
              results.emails_sent++;
            } catch (error) {
              console.error(`Failed to send email:`, error);
              results.emails_failed++;
            }
          }
        }
      }
    }

    if (notify_via.includes('sms')) {
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        const smsMessage = `📅 ${band.name}: Availability Request\n\n${title}\n\nDate Range: ${formattedStartDate.split(',')[0]} - ${formattedEndDate.split(',')[0]}\n\nPlease log in to submit your available dates.`;

        for (const member of members || []) {
          const profile = (member.profiles as unknown) as { id: string; name: string; email: string; phone_number: string | null } | null;
          if (profile?.phone_number) {
            try {
              await sendTwilioSMS(profile.phone_number, smsMessage, twilioAccountSid, twilioAuthToken, twilioPhoneNumber);
              console.log(`SMS sent to ${profile.name}`);
              results.sms_sent++;
            } catch (error) {
              console.error(`Failed to send SMS:`, error);
              results.sms_failed++;
            }
          }
        }
      }
    }

    console.log('Notification results:', results);

    return new Response(
      JSON.stringify({ success: true, results, message: `Sent ${results.emails_sent} emails and ${results.sms_sent} SMS notifications` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in notify-availability-request function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

async function sendTwilioSMS(to: string, body: string, accountSid: string, authToken: string, from: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.append('To', to);
  formData.append('From', from);
  formData.append('Body', body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio API error: ${response.status} - ${errorText}`);
  }
}

serve(handler);
