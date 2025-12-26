import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledReminder {
  id: string;
  user_id: string;
  event_type: string;
  event_id: string | null;
  event_name: string;
  event_date: string;
  reminder_times: string[];
  is_relative: boolean;
  custom_datetime: string | null;
  target_member_ids: string[];
  target_groups: string[];
  message: string | null;
  status: string;
}

interface Profile {
  id: string;
  name: string;
  phone_number: string | null;
}

interface NotificationPrefs {
  sms_enabled: boolean;
  push_enabled: boolean;
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
    console.log('Processing scheduled reminders...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Twilio config
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const hasTwilio = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;

    if (!hasTwilio) {
      console.log('Twilio credentials not configured - will only send push notifications');
    }

    const now = new Date();
    const remindersToProcess: ScheduledReminder[] = [];

    // Fetch all active reminders
    const { data: allReminders, error: remindersError } = await supabase
      .from('scheduled_reminders')
      .select('*')
      .eq('status', 'active');

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      throw remindersError;
    }

    console.log(`Found ${allReminders?.length || 0} active reminders`);

    // Check each reminder to see if any reminder time has passed
    for (const reminder of (allReminders as ScheduledReminder[]) || []) {
      const eventDate = new Date(reminder.event_date);
      
      // Handle custom datetime reminders
      if (!reminder.is_relative && reminder.custom_datetime) {
        const customTime = new Date(reminder.custom_datetime);
        if (now >= customTime && customTime > new Date(now.getTime() - 15 * 60 * 1000)) {
          // Custom time has arrived (within 15 min window)
          remindersToProcess.push(reminder);
          continue;
        }
      }

      // Handle relative reminders
      if (reminder.is_relative && reminder.reminder_times) {
        for (const timeStr of reminder.reminder_times) {
          const reminderTime = calculateReminderTime(eventDate, timeStr);
          
          // Check if reminder time is within the processing window (now to 15 min ago)
          if (reminderTime && now >= reminderTime && reminderTime > new Date(now.getTime() - 15 * 60 * 1000)) {
            remindersToProcess.push(reminder);
            break; // Only process once per reminder
          }
        }
      }
    }

    console.log(`${remindersToProcess.length} reminders need to be sent`);

    let successCount = 0;
    let failCount = 0;

    for (const reminder of remindersToProcess) {
      try {
        await sendReminderNotifications(
          supabase,
          reminder,
          hasTwilio ? { accountSid: twilioAccountSid!, authToken: twilioAuthToken!, phoneNumber: twilioPhoneNumber! } : null
        );
        
        // Mark reminder as sent or update if it has more reminder times
        const remainingTimes = getRemainingReminderTimes(reminder, now);
        
        if (remainingTimes.length === 0 && !reminder.custom_datetime) {
          // All reminder times processed, mark as sent
          await supabase
            .from('scheduled_reminders')
            .update({ status: 'sent' })
            .eq('id', reminder.id);
          console.log(`Marked reminder ${reminder.id} as sent`);
        }
        
        successCount++;
      } catch (error) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: remindersToProcess.length,
        succeeded: successCount,
        failed: failCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-scheduled-reminders function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

function calculateReminderTime(eventDate: Date, timeStr: string): Date | null {
  const lowerTime = timeStr.toLowerCase();
  
  if (lowerTime === '1_week') {
    return new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (lowerTime === '1_day') {
    return new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  } else if (lowerTime === '4_hours') {
    return new Date(eventDate.getTime() - 4 * 60 * 60 * 1000);
  } else if (lowerTime === '1_hour') {
    return new Date(eventDate.getTime() - 60 * 60 * 1000);
  } else if (lowerTime === '30_min') {
    return new Date(eventDate.getTime() - 30 * 60 * 1000);
  }
  
  return null;
}

function getRemainingReminderTimes(reminder: ScheduledReminder, now: Date): string[] {
  if (!reminder.is_relative || !reminder.reminder_times) return [];
  
  const eventDate = new Date(reminder.event_date);
  
  return reminder.reminder_times.filter(timeStr => {
    const reminderTime = calculateReminderTime(eventDate, timeStr);
    return reminderTime && reminderTime > now;
  });
}

// deno-lint-ignore no-explicit-any
async function sendReminderNotifications(
  supabase: any,
  reminder: ScheduledReminder,
  twilioConfig: { accountSid: string; authToken: string; phoneNumber: string } | null
) {
  console.log(`Sending notifications for reminder: ${reminder.event_name}`);
  
  // Get target members
  const targetIds = reminder.target_member_ids || [];
  
  if (targetIds.length === 0) {
    console.log('No target members specified');
    return;
  }

  // Fetch member profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, phone_number')
    .in('id', targetIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return;
  }

  const members = (profiles || []) as Profile[];
  console.log(`Found ${members.length} members to notify`);

  // Format the message
  const eventDate = new Date(reminder.event_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const customMessage = reminder.message || '';
  
  const smsMessage = `🔔 Reminder: ${reminder.event_name}\n\n` +
    `📅 ${eventDate}\n` +
    (customMessage ? `\n${customMessage}\n` : '') +
    `\nType: ${formatEventType(reminder.event_type)}`;

  const pushTitle = `Reminder: ${reminder.event_name}`;
  const pushBody = customMessage || `${formatEventType(reminder.event_type)} on ${eventDate}`;

  for (const member of members) {
    try {
      // Get user's notification preferences
      const prefs = await getUserNotificationPrefs(supabase, member.id);

      // Send SMS if enabled
      if (prefs.sms_enabled && twilioConfig && member.phone_number) {
        try {
          await sendTwilioSMS(
            member.phone_number,
            smsMessage,
            twilioConfig.accountSid,
            twilioConfig.authToken,
            twilioConfig.phoneNumber
          );
          console.log(`SMS sent to ${member.name}`);
        } catch (smsError) {
          console.error(`Failed to send SMS to ${member.name}:`, smsError);
        }
      }

      // Send push notification if enabled
      if (prefs.push_enabled) {
        try {
          await sendPushNotification(supabase, member.id, pushTitle, pushBody, reminder.id);
          console.log(`Push notification sent to ${member.name}`);
        } catch (pushError) {
          console.error(`Failed to send push to ${member.name}:`, pushError);
        }
      }

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id: member.id,
        title: pushTitle,
        message: pushBody,
        type: 'reminder',
        related_id: reminder.event_id || reminder.id,
      });
      console.log(`In-app notification created for ${member.name}`);

    } catch (error) {
      console.error(`Failed to process notifications for ${member.name}:`, error);
    }
  }
}

function formatEventType(eventType: string): string {
  switch (eventType) {
    case 'gig': return 'Gig';
    case 'rehearsal': return 'Rehearsal';
    case 'tour_date': return 'Tour Date';
    case 'custom': return 'Event';
    default: return eventType.charAt(0).toUpperCase() + eventType.slice(1);
  }
}

// deno-lint-ignore no-explicit-any
async function getUserNotificationPrefs(supabase: any, userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('sms_enabled, push_enabled')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { sms_enabled: true, push_enabled: true };
  }

  const prefs = data as { sms_enabled?: boolean; push_enabled?: boolean };
  return {
    sms_enabled: prefs.sms_enabled ?? true,
    push_enabled: prefs.push_enabled ?? true,
  };
}

// deno-lint-ignore no-explicit-any
async function sendPushNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  reminderId: string
): Promise<void> {
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
    url: '/schedule-reminder',
    reminderId,
  });

  for (const tokenRecord of tokens as PushToken[]) {
    try {
      const subscription = JSON.parse(tokenRecord.token);
      
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

  console.log('Twilio SMS sent successfully');
}

serve(handler);
