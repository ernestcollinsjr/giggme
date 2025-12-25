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

interface NotificationPrefs {
  sms_enabled: boolean;
  push_enabled: boolean;
  reminder_1_day: boolean;
  reminder_day_of: boolean;
}

interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
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

    const hasTwilio = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;
    
    if (!hasTwilio) {
      console.log('Twilio credentials not configured - will only send push notifications');
    }

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    if (reminder_type === 'check') {
      const oneDayEvents = await fetchEvents(supabase, event_type, oneDayFromNow, fifteenMinutesFromNow, 24);
      const oneHourEvents = await fetchEvents(supabase, event_type, oneHourFromNow, fifteenMinutesFromNow, 1);
      
      for (const event of oneDayEvents) {
        await sendReminders(
          supabase, 
          event, 
          event_type, 
          '1 day', 
          hasTwilio ? { accountSid: twilioAccountSid!, authToken: twilioAuthToken!, phoneNumber: twilioPhoneNumber! } : null
        );
      }
      
      for (const event of oneHourEvents) {
        await sendReminders(
          supabase, 
          event, 
          event_type, 
          '1 hour', 
          hasTwilio ? { accountSid: twilioAccountSid!, authToken: twilioAuthToken!, phoneNumber: twilioPhoneNumber! } : null
        );
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

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-sms-reminders function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

// deno-lint-ignore no-explicit-any
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

// deno-lint-ignore no-explicit-any
async function getUserNotificationPrefs(
  supabase: any,
  userId: string
): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('sms_enabled, push_enabled, reminder_1_day, reminder_day_of')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Default preferences
    return {
      sms_enabled: true,
      push_enabled: true,
      reminder_1_day: true,
      reminder_day_of: true,
    };
  }

  const prefs = data as { sms_enabled?: boolean; push_enabled?: boolean; reminder_1_day?: boolean; reminder_day_of?: boolean };
  return {
    sms_enabled: prefs.sms_enabled ?? true,
    push_enabled: prefs.push_enabled ?? true,
    reminder_1_day: prefs.reminder_1_day ?? true,
    reminder_day_of: prefs.reminder_day_of ?? true,
  };
}

// deno-lint-ignore no-explicit-any
async function sendReminders(
  supabase: any,
  event: EventReminder,
  eventType: string,
  timeframe: string,
  twilioConfig: { accountSid: string; authToken: string; phoneNumber: string } | null
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
      // deno-lint-ignore no-explicit-any
      ?.map((gm: any) => gm.profiles)
      // deno-lint-ignore no-explicit-any
      .filter((p: any): p is Profile => p !== null) || [];
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

    members = (profiles || []) as Profile[];
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
  
  const smsMessage = `🎵 Reminder: ${eventType === 'gig' ? 'Gig' : 'Rehearsal'} in ${timeframe}!\n\n` +
    `📅 ${eventDate}\n` +
    `📍 ${venueName}${timeText}\n\n` +
    `See you there!`;

  const pushTitle = `${eventType === 'gig' ? 'Gig' : 'Rehearsal'} in ${timeframe}!`;
  const pushBody = `${eventDate} at ${venueName}${timeText}`;

  for (const member of members) {
    try {
      // Get user's notification preferences
      const prefs = await getUserNotificationPrefs(supabase, member.id);
      
      // Check if user wants reminders for this timeframe
      const wantsReminder = timeframe === '1 day' ? prefs.reminder_1_day : prefs.reminder_day_of;
      
      if (!wantsReminder) {
        console.log(`User ${member.name} has disabled ${timeframe} reminders`);
        continue;
      }

      // Send SMS if enabled and Twilio is configured
      if (prefs.sms_enabled && twilioConfig && member.phone_number) {
        try {
          await sendTwilioSMS(
            member.phone_number,
            smsMessage,
            twilioConfig.accountSid,
            twilioConfig.authToken,
            twilioConfig.phoneNumber
          );
          console.log(`SMS sent to ${member.name} (${member.phone_number})`);
        } catch (smsError) {
          console.error(`Failed to send SMS to ${member.name}:`, smsError);
        }
      }

      // Send push notification if enabled
      if (prefs.push_enabled) {
        try {
          await sendPushNotification(supabase, member.id, pushTitle, pushBody, event.id, eventType);
          console.log(`Push notification sent to ${member.name}`);
        } catch (pushError) {
          console.error(`Failed to send push to ${member.name}:`, pushError);
        }
      }
    } catch (error) {
      console.error(`Failed to process notifications for ${member.name}:`, error);
    }
  }
}

// deno-lint-ignore no-explicit-any
async function sendPushNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  eventId: string,
  eventType: string
): Promise<void> {
  // Get user's push tokens
  const { data: tokens, error: tokensError } = await supabase
    .from('push_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', 'web');

  if (tokensError) {
    console.error('Error fetching push tokens:', tokensError);
    return;
  }

  if (!tokens || tokens.length === 0) {
    console.log(`No push tokens found for user ${userId}`);
    return;
  }

  const payload = JSON.stringify({
    title,
    body,
    url: eventType === 'gig' ? '/dashboard' : '/rehearsals',
    eventId,
    eventType,
  });

  for (const tokenRecord of tokens as PushToken[]) {
    try {
      const subscription = JSON.parse(tokenRecord.token);
      
      // Send to the push endpoint
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'TTL': '86400',
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Push failed:', response.status, errorText);
        
        // Remove stale tokens
        if (response.status === 404 || response.status === 410) {
          await supabase.from('push_tokens').delete().eq('id', tokenRecord.id);
          console.log('Removed stale push token:', tokenRecord.id);
        }
      } else {
        console.log(`Push sent successfully to token ${tokenRecord.id}`);
      }
    } catch (error) {
      console.error(`Error sending push to token ${tokenRecord.id}:`, error);
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
