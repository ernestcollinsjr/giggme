import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessagePayload {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { message_id, sender_id, recipient_id, content }: MessagePayload = await req.json();

    console.log('Processing message notification:', { message_id, sender_id, recipient_id });

    // Skip if no recipient (group message)
    if (!recipient_id) {
      console.log('Skipping - no recipient (group message)');
      return new Response(
        JSON.stringify({ success: true, message: 'Group message - no notification sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender's profile for the notification
    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('name, photo_urls')
      .eq('id', sender_id)
      .single();

    if (senderError) {
      console.error('Error fetching sender profile:', senderError);
    }

    const senderName = senderProfile?.name || 'Someone';

    // Check recipient's notification preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', recipient_id)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('Error fetching notification preferences:', prefsError);
    }

    // Default to enabled if no preferences set
    const pushEnabled = prefs?.push_enabled !== false;

    if (!pushEnabled) {
      console.log('Push notifications disabled for recipient');
      return new Response(
        JSON.stringify({ success: true, message: 'Push notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recipient's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', recipient_id)
      .eq('platform', 'web');

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No push tokens found for recipient');
      return new Response(
        JSON.stringify({ success: false, message: 'No push tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Truncate content for notification
    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content;

    const payload = JSON.stringify({
      title: `New message from ${senderName}`,
      body: truncatedContent,
      url: '/chat',
      data: {
        type: 'direct_message',
        message_id,
        sender_id,
      },
    });

    console.log('Sending push notification with payload:', payload);

    const results = [];

    for (const tokenRecord of tokens) {
      try {
        const subscription = JSON.parse(tokenRecord.token);
        
        // Send push notification
        const response = await fetch(subscription.endpoint, {
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
          
          results.push({ success: false, tokenId: tokenRecord.id, error: text });
        } else {
          results.push({ success: true, tokenId: tokenRecord.id });
          console.log('Push sent successfully to token:', tokenRecord.id);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error sending to token:', tokenRecord.id, error);
        results.push({ success: false, tokenId: tokenRecord.id, error: errorMessage });
      }
    }

    // Also create an in-app notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: recipient_id,
        title: 'New Message',
        message: `${senderName} sent you a message`,
        type: 'direct_message',
        related_id: message_id,
      });

    if (notifError) {
      console.error('Error creating in-app notification:', notifError);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in notify-new-message:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});