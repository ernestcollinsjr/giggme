import { supabase } from "@/integrations/supabase/client";

interface GigNotificationParams {
  gigId: string;
  memberIds: string[];
  venueName: string | null;
  venue: string;
  gigDate: Date;
}

export async function sendGigPushNotifications({
  gigId,
  memberIds,
  venueName,
  venue,
  gigDate,
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

  // Also create in-app notifications
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
    console.error('Failed to create in-app notifications:', error);
  }

  await Promise.allSettled(notificationPromises);
}
