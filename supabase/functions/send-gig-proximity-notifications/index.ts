import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for gigs starting within 1 hour...');

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fiftyFiveMinutesFromNow = new Date(now.getTime() + 55 * 60 * 1000);

    // Find gigs where the earliest time (loading, sound check, or show) is within 55-60 minutes
    // This window ensures we only send the notification once per gig
    const { data: upcomingGigs, error: gigsError } = await supabase
      .from('gigs')
      .select(`
        id,
        date,
        venue,
        venue_name,
        loading_time,
        sound_check_time,
        user_id,
        band_id
      `)
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', oneHourFromNow.toISOString().split('T')[0]);

    if (gigsError) {
      console.error('Error fetching gigs:', gigsError);
      throw gigsError;
    }

    console.log(`Found ${upcomingGigs?.length || 0} potential gigs today`);

    const notifications: any[] = [];

    for (const gig of upcomingGigs || []) {
      const gigDate = new Date(gig.date);
      
      // Determine the earliest time for this gig
      let earliestTime = gigDate;
      let timeLabel = "show time";
      
      if (gig.loading_time) {
        const [hours, minutes] = gig.loading_time.split(':').map(Number);
        earliestTime = new Date(gigDate);
        earliestTime.setHours(hours, minutes, 0, 0);
        timeLabel = "load-in";
      } else if (gig.sound_check_time) {
        const [hours, minutes] = gig.sound_check_time.split(':').map(Number);
        earliestTime = new Date(gigDate);
        earliestTime.setHours(hours, minutes, 0, 0);
        timeLabel = "sound check";
      }

      // Check if this gig's earliest time is within the 55-60 minute window
      if (earliestTime > fiftyFiveMinutesFromNow && earliestTime <= oneHourFromNow) {
        console.log(`Gig ${gig.id} at ${gig.venue_name || gig.venue} starts within 1 hour`);

        // Get all accepted members for this gig
        const { data: gigMembers, error: membersError } = await supabase
          .from('gig_members')
          .select('member_id, location_sharing_enabled')
          .eq('gig_id', gig.id)
          .eq('status', 'accepted');

        if (membersError) {
          console.error(`Error fetching members for gig ${gig.id}:`, membersError);
          continue;
        }

        // Enable location sharing for all members
        await supabase
          .from('gig_members')
          .update({ location_sharing_enabled: true })
          .eq('gig_id', gig.id)
          .eq('status', 'accepted');

        // Get push tokens for all members
        for (const member of gigMembers || []) {
          const { data: pushTokens } = await supabase
            .from('push_tokens')
            .select('token, platform')
            .eq('user_id', member.member_id);

          const venueName = gig.venue_name || gig.venue;
          const message = `Your ${timeLabel} at ${venueName} is in 1 hour! Location tracking is now active.`;

          // Create in-app notification
          await supabase
            .from('notifications')
            .insert({
              user_id: member.member_id,
              title: '🎵 Gig Starting Soon!',
              message: message,
              type: 'gig_reminder',
              related_id: gig.id,
            });

          // Send push notifications
          for (const tokenData of pushTokens || []) {
            try {
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  token: tokenData.token,
                  title: '🎵 Gig Starting Soon!',
                  body: message,
                  data: {
                    type: 'gig_proximity',
                    gig_id: gig.id,
                  },
                },
              });

              notifications.push({
                gig_id: gig.id,
                member_id: member.member_id,
                status: 'sent',
              });
            } catch (pushError) {
              console.error(`Push notification error for member ${member.member_id}:`, pushError);
            }
          }
        }

        // Also notify the band leader
        const { data: leaderTokens } = await supabase
          .from('push_tokens')
          .select('token, platform')
          .eq('user_id', gig.user_id);

        const leaderMessage = `Your gig at ${gig.venue_name || gig.venue} starts in 1 hour! Member location tracking is now active.`;

        await supabase
          .from('notifications')
          .insert({
            user_id: gig.user_id,
            title: '🎵 Gig Starting Soon!',
            message: leaderMessage,
            type: 'gig_reminder',
            related_id: gig.id,
          });

        for (const tokenData of leaderTokens || []) {
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                token: tokenData.token,
                title: '🎵 Gig Starting Soon!',
                body: leaderMessage,
                data: {
                  type: 'gig_proximity',
                  gig_id: gig.id,
                },
              },
            });
          } catch (pushError) {
            console.error(`Push notification error for leader:`, pushError);
          }
        }
      }
    }

    console.log(`Sent ${notifications.length} proximity notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
        details: notifications,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in send-gig-proximity-notifications:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
