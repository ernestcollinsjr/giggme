import { supabase } from "@/integrations/supabase/client";

interface GigNotificationParams {
  gigId: string;
  memberIds: string[];
  venueName: string | null;
  venue: string;
  gigDate: Date;
  bandId?: string | null;
}

export async function sendGigPushNotifications({
  gigId,
  memberIds,
  venueName,
  venue,
  gigDate,
  bandId,
}: GigNotificationParams): Promise<void> {
  const displayVenue = venueName || venue;
  const formattedDate = gigDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

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
