import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventReminder {
  id: string;
  date: string;
  venue: string;
  venue_name?: string;
  loading_time?: string;
  end_time?: string;
  sound_check_time?: string;
}

interface Profile {
  id: string;
  name: string;
  phone_number: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_type, reminder_type } = await req.json();
    
    console.log(`Processing ${event_type} reminders of type ${reminder_type}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    if (reminder_type === 'check') {
      const oneDayEvents = await fetchEvents(supabase, event_type, oneDayFromNow, fifteenMinutesFromNow, 24);
      const oneHourEvents = await fetchEvents(supabase, event_type, oneHourFromNow, fifteenMinutesFromNow, 1);
      
      for (const event of oneDayEvents) {
        await sendReminders(supabase, event, event_type, '1 day', twilioAccountSid, twilioAuthToken, twilioPhoneNumber);
      }
      
      for (const event of oneHourEvents) {
        await sendReminders(supabase, event, event_type, '1 hour', twilioAccountSid, twilioAuthToken, twilioPhoneNumber);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          one_day_reminders: oneDayEvents.length,
          one_hour_reminders: oneHourEvents.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'No reminders to send' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-sms-reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

async function fetchEvents(
  supabase: any,
  eventType: string,
  targetTime: Date,
  buffer: Date,
  hoursAhead: number
): Promise<EventReminder[]> {
  const table = eventType === 'gig' ? 'gigs' : 'rehearsals';
  const startTime = new Date(targetTime.getTime() - buffer.getTime());
  const endTime = new Date(targetTime.getTime() + buffer.getTime());
  
  console.log(`Fetching ${table} between ${startTime.toISOString()} and ${endTime.toISOString()}`);
  
  const { data, error } = await supabase
    .from(table)
    .select('id, date, venue, venue_name, loading_time, end_time, sound_check_time')
    .gte('date', startTime.toISOString())
    .lte('date', endTime.toISOString());

  if (error) {
    console.error(`Error fetching ${table}:`, error);
    return [];
  }

  console.log(`Found ${data?.length || 0} ${table} needing ${hoursAhead}hr reminders`);
  return data || [];
}

async function sendReminders(
  supabase: any,
  event: EventReminder,
  eventType: string,
  timeframe: string,
  accountSid: string,
  authToken: string,
  fromNumber: string
) {
  console.log(`Sending ${timeframe} reminders for ${eventType} ${event.id}`);
  
  let members: Profile[] = [];
  
  if (eventType === 'gig') {
    const { data: gigMembers, error: gigError } = await supabase
      .from('gig_members')
      .select('member_id, profiles!gig_members_member_id_fkey(id, name, phone_number)')
      .eq('gig_id', event.id)
      .eq('status', 'accepted');

    if (gigError) {
      console.error('Error fetching gig members:', gigError);
      return;
    }

    members = gigMembers
      ?.map((gm: any) => gm.profiles)
      .filter((p: any) => p && p.phone_number) || [];
  } else {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, phone_number, user_roles!inner(role)')
      .eq('user_roles.role', 'band_member')
      .not('phone_number', 'is', null);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
      return;
    }

    members = profiles || [];
  }

  console.log(`Found ${members.length} members to notify`);

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const venueName = event.venue_name || event.venue;
  const timeInfo = event.loading_time || event.sound_check_time || event.end_time || '';
  const timeText = timeInfo ? ` at ${timeInfo}` : '';
  
  const message = `🎵 Reminder: ${eventType === 'gig' ? 'Gig' : 'Rehearsal'} in ${timeframe}!\n\n` +
    `📅 ${eventDate}\n` +
    `📍 ${venueName}${timeText}\n\n` +
    `See you there!`;

  for (const member of members) {
    try {
      await sendTwilioSMS(
        member.phone_number,
        message,
        accountSid,
        authToken,
        fromNumber
      );
      console.log(`SMS sent to ${member.name} (${member.phone_number})`);
    } catch (error) {
      console.error(`Failed to send SMS to ${member.name}:`, error);
    }
  }
}

async function sendTwilioSMS(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  from: string
): Promise<void> {
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

  const result = await response.json();
  console.log('Twilio response:', result);
}

serve(handler);
