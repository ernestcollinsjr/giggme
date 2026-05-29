import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface GigNotificationParams {
  gigId: string;
  memberIds: string[];
  venueName: string | null;
  venue: string;
  gigDate: Date;
  bandId?: string | null;
  responseDeadline?: Date;
  notes?: string | null;
  attire?: string | null;
  rehearsalInfo?: {
    date: Date;
    time: string;
    venue: string;
  } | null;
}

export async function sendGigPushNotifications({
  gigId,
  memberIds,
  venueName,
  venue,
  gigDate,
  bandId,
  responseDeadline,
  notes,
  attire,
  rehearsalInfo,
}: GigNotificationParams): Promise<void> {
  const displayVenue = venueName || venue;
  const formattedDate = gigDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Get member profiles for emails including timezone
  const { data: memberProfiles } = await supabase
    .from('profiles')
    .select('id, name, email, timezone')
    .in('id', memberIds);

  // Get band name and leader name
  let bandName = 'Your Group';
  let bandLeaderName = 'Group Leader';
  
  if (bandId) {
    const { data: band } = await supabase
      .from('groups')
      .select('name, band_leader_id')
      .eq('id', bandId)
      .single();
    
    if (band) {
      bandName = band.name;
      
      const { data: leaderProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', band.band_leader_id)
        .single();
      
      if (leaderProfile) {
        bandLeaderName = leaderProfile.name;
      }
    }
  }

  // Send push notification to each member
  const notificationPromises = memberIds.map(async (memberId) => {
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: memberId,
          title: '🎸 New Gig Invitation!',
          body: `You've been invited to a gig at ${displayVenue} on ${formattedDate}`,
          url: '/dashboard',
          data: {
            type: 'gig_invitation',
            gig_id: gigId,
          },
        },
      });
    } catch (error) {
      console.error(`Failed to send push notification to ${memberId}:`, error);
    }
  });

  // Send email invitations to each member
  if (memberProfiles && memberProfiles.length > 0 && responseDeadline) {
    const emailPromises = memberProfiles.map(async (member) => {
      try {
        const gigTime = format(gigDate, 'h:mm a');
        const gigDateFormatted = format(gigDate, 'EEEE, MMMM d, yyyy');
        
        const emailBody: Record<string, unknown> = {
          recipientEmail: member.email,
          recipientName: member.name,
          recipientTimezone: member.timezone || 'America/Chicago',
          venueName: venueName || '',
          venueAddress: venue,
          gigDate: gigDateFormatted,
          gigTime: gigTime,
          responseDeadline: responseDeadline.toISOString(),
          bandLeaderName: bandLeaderName,
          bandName: bandName,
          notes: notes || undefined,
          attire: attire || undefined,
          gigId: gigId,
          memberId: member.id,
        };
        
        // Add rehearsal info if present
        if (rehearsalInfo) {
          emailBody.rehearsalInfo = {
            date: format(rehearsalInfo.date, 'EEEE, MMMM d, yyyy'),
            time: rehearsalInfo.time,
            venue: rehearsalInfo.venue,
          };
        }

        await supabase.functions.invoke('send-gig-invite', {
          body: emailBody,
        });
        
        console.log(`Gig invite email sent to ${member.email}`);
      } catch (error) {
        console.error(`Failed to send email to ${member.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);
  }

  // Also create in-app notifications for members
  const inAppNotifications = memberIds.map((memberId) => ({
    user_id: memberId,
    title: 'New Gig Invitation',
    message: `You've been invited to a gig at ${displayVenue} on ${formattedDate}. Please respond.`,
    type: 'gig_invitation',
    related_id: gigId,
  }));

  try {
    await supabase.from('notifications').insert(inAppNotifications);
  } catch (error) {
    console.error('Failed to create in-app notifications for members:', error);
  }

  // If there's a band, also notify booking managers who manage this band
  if (bandId) {
    try {
      const { data: bookingManagerBands } = await supabase
        .from('booking_manager_bands')
        .select('booking_manager_id')
        .eq('band_id', bandId);

      if (bookingManagerBands && bookingManagerBands.length > 0) {
        const bmNotificationPromises = bookingManagerBands.map(async (bmBand) => {
          try {
            // Send push notification to booking manager
            await supabase.functions.invoke('send-push-notification', {
              body: {
                user_id: bmBand.booking_manager_id,
                title: '🎸 New Gig Created',
                body: `A new gig has been scheduled at ${displayVenue} on ${formattedDate}`,
                url: '/booking-manager',
                data: {
                  type: 'gig_created',
                  gig_id: gigId,
                },
              },
            });
          } catch (error) {
            console.error(`Failed to send push to booking manager ${bmBand.booking_manager_id}:`, error);
          }
        });

        // Create in-app notifications for booking managers
        const bmInAppNotifications = bookingManagerBands.map((bmBand) => ({
          user_id: bmBand.booking_manager_id,
          title: 'New Gig Created',
          message: `A new gig has been scheduled at ${displayVenue} on ${formattedDate}`,
          type: 'gig_created',
          related_id: gigId,
        }));

        await supabase.from('notifications').insert(bmInAppNotifications);
        await Promise.allSettled(bmNotificationPromises);
      }
    } catch (error) {
      console.error('Failed to notify booking managers:', error);
    }
  }

  await Promise.allSettled(notificationPromises);
}
