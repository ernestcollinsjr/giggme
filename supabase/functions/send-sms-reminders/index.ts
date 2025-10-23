import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderRequest {
  event_type: 'gig' | 'rehearsal';
  reminder_type: 'check'; // Will check which reminders need to be sent
}

interface Gig {
  id: string;
  date: string;
  venue: string;
  venue_name: string;
  loading_time: string;
}

interface Rehearsal {
  id: string;
  date: string;
  venue: string;
  end_time: string;
}

interface Member {
  member_id: string;
  name: string;
  phone_number: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_type, reminder_type }: ReminderRequest = await req.json();

    console.log(`Checking ${event_type} reminders...`);

    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Calculate time windows (with 15-minute buffer since cron runs every 15 minutes)
    const oneDayWindowStart = new Date(oneDayFromNow.getTime() - 7.5 * 60 * 1000);
    const oneDayWindowEnd = new Date(oneDayFromNow.getTime() + 7.5 * 60 * 1000);
    const oneHourWindowStart = new Date(oneHourFromNow.getTime() - 7.5 * 60 * 1000);
    const oneHourWindowEnd = new Date(oneHourFromNow.getTime() + 7.5 * 60 * 1000);

    let events: any[] = [];

    if (event_type === 'gig') {
      // Fetch gigs needing reminders
      const { data: oneDayGigs } = await supabase
        .from('gigs')
        .select('id, date, venue, venue_name, loading_time')
        .gte('date', oneDayWindowStart.toISOString())
        .lte('date', oneDayWindowEnd.toISOString());

      const { data: oneHourGigs } = await supabase
        .from('gigs')
        .select('id, date, venue, venue_name, loading_time')
        .gte('date', oneHourWindowStart.toISOString())
        .lte('date', oneHourWindowEnd.toISOString());

      if (oneDayGigs) {
        for (const gig of oneDayGigs) {
          await sendGigReminders(supabase, gig, '1 day');
        }
      }

      if (oneHourGigs) {
        for (const gig of oneHourGigs) {
          await sendGigReminders(supabase, gig, '1 hour');
        }
      }

      events = [...(oneDayGigs || []), ...(oneHourGigs || [])];
    } else {
      // Fetch rehearsals needing reminders
      const { data: oneDayRehearsals } = await supabase
        .from('rehearsals')
        .select('id, date, venue, end_time')
        .gte('date', oneDayWindowStart.toISOString())
        .lte('date', oneDayWindowEnd.toISOString());

      const { data: oneHourRehearsals } = await supabase
        .from('rehearsals')
        .select('id, date, venue, end_time')
        .gte('date', oneHourWindowStart.toISOString())
        .lte('date', oneHourWindowEnd.toISOString());

      if (oneDayRehearsals) {
        for (const rehearsal of oneDayRehearsals) {
          await sendRehearsalReminders(supabase, rehearsal, '1 day');
        }
      }

      if (oneHourRehearsals) {
        for (const rehearsal of oneHourRehearsals) {
          await sendRehearsalReminders(supabase, rehearsal, '1 hour');
        }
      }

      events = [...(oneDayRehearsals || []), ...(oneHourRehearsals || [])];
    }

    console.log(`Processed ${events.length} ${event_type}(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: events.length,
        event_type 
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error: any) {
    console.error('Error processing reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
};

async function sendGigReminders(supabase: any, gig: Gig, timeframe: string) {
  console.log(`Sending ${timeframe} reminder for gig ${gig.id}`);

  // Get all members invited to this gig who have accepted
  const { data: members } = await supabase
    .from('gig_members')
    .select(`
      member_id,
      profiles!gig_members_member_id_fkey (
        name,
        phone_number
      )
    `)
    .eq('gig_id', gig.id)
    .eq('status', 'accepted');

  if (!members || members.length === 0) {
    console.log('No accepted members for this gig');
    return;
  }

  const formattedDate = new Date(gig.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  for (const member of members) {
    const profile = member.profiles;
    if (!profile?.phone_number) {
      console.log(`Member ${member.member_id} has no phone number`);
      continue;
    }

    const venueName = gig.venue_name || gig.venue;
    const timeInfo = gig.loading_time ? ` Load-in: ${gig.loading_time}` : '';
    
    const message = `🎸 Gig Reminder: ${timeframe} until your gig at ${venueName} on ${formattedDate}.${timeInfo} Break a leg!`;

    await sendSMS(profile.phone_number, message);
  }
}

async function sendRehearsalReminders(supabase: any, rehearsal: Rehearsal, timeframe: string) {
  console.log(`Sending ${timeframe} reminder for rehearsal ${rehearsal.id}`);

  // Get all band members (using band_leader_id from rehearsals)
  const { data: rehearsalData } = await supabase
    .from('rehearsals')
    .select('band_id, band_leader_id')
    .eq('id', rehearsal.id)
    .single();

  if (!rehearsalData) {
    console.log('Rehearsal not found');
    return;
  }

  // Get all profiles with band_member or band_leader role
  const { data: members } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      profiles!user_roles_user_id_fkey (
        name,
        phone_number
      )
    `)
    .in('role', ['band_member', 'band_leader']);

  if (!members || members.length === 0) {
    console.log('No band members found');
    return;
  }

  const formattedDate = new Date(rehearsal.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  for (const member of members) {
    const profile = member.profiles;
    if (!profile?.phone_number) {
      console.log(`Member ${member.user_id} has no phone number`);
      continue;
    }

    const timeInfo = rehearsal.end_time ? ` Ends at: ${rehearsal.end_time}` : '';
    
    const message = `🎵 Rehearsal Reminder: ${timeframe} until rehearsal at ${rehearsal.venue} on ${formattedDate}.${timeInfo} See you there!`;

    await sendSMS(profile.phone_number, message);
  }
}

async function sendSMS(phoneNumber: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !twilioPhone) {
    console.error('Twilio credentials not configured');
    return;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', twilioPhone);
    formData.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Twilio API error:', errorData);
      throw new Error(`Twilio API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`SMS sent successfully to ${phoneNumber}:`, data.sid);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

serve(handler);
