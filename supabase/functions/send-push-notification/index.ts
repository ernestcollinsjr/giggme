import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID keys for web push
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

// Send push notification using Web Push protocol
async function sendWebPush(subscription: any, payload: string) {
  console.log('Sending push to endpoint:', subscription.endpoint);
  return webpush.sendNotification(subscription, payload, { TTL: 86400 });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    webpush.setVapidDetails('mailto:notify@giggme.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { user_id, title, body, url, data } = await req.json();

    console.log('Sending push notification to user:', user_id);

    // Get user's notification preferences (sound choice + mute state)
    const ALLOWED_SOUNDS = new Set(['chime', 'bell', 'ding']);
    const DEFAULT_SOUND = 'chime';
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('sound_muted, sound_type')
      .eq('user_id', user_id)
      .maybeSingle();

    const rawSound = (prefs as any)?.sound_type ?? DEFAULT_SOUND;
    const soundType = ALLOWED_SOUNDS.has(rawSound) ? rawSound : DEFAULT_SOUND;
    const muted = (prefs as any)?.sound_muted === true;

    // Get user's push tokens (all platforms; we tailor the payload below)
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', user_id);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No push tokens found for user');
      return new Response(
        JSON.stringify({ success: false, message: 'No push tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Web payload — service worker reads `sound` to play the matching tone.
    // (Web Push spec has no native sound field; the SW plays /sounds/<type>.mp3.)
    const webPayload = JSON.stringify({
      title: title || 'Notification',
      body: body || '',
      url: url || '/',
      sound: muted ? null : soundType,
      ...data,
    });

    // Native payload — APNs + FCM read the sound from these standard fields.
    const nativePayload = JSON.stringify({
      notification: {
        title: title || 'Notification',
        body: body || '',
        // Android: filename in res/raw, no extension. "default" = system sound.
        sound: muted ? 'default' : soundType,
      },
      data: {
        url: url || '/',
        sound: muted ? '' : soundType,
        ...data,
      },
      apns: {
        payload: {
          aps: {
            alert: { title: title || 'Notification', body: body || '' },
            // iOS: filename in app bundle, extension required.
            sound: muted ? 'default' : `${soundType}.caf`,
          },
        },
      },
      android: {
        notification: {
          sound: muted ? 'default' : soundType,
        },
      },
    });

    const results = [];

    for (const tokenRecord of tokens) {
      try {
        const subscription = JSON.parse(tokenRecord.token);
        await sendWebPush(subscription, payload);
        results.push({ success: true, tokenId: tokenRecord.id });
        console.log('Push sent successfully to token:', tokenRecord.id);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error sending to token:', tokenRecord.id, error);
        results.push({ success: false, tokenId: tokenRecord.id, error: errorMessage });
        
        // If push fails with 404 or 410, remove the stale token
        if (errorMessage.includes('404') || errorMessage.includes('410')) {
          await supabase.from('push_tokens').delete().eq('id', tokenRecord.id);
          console.log('Removed stale token:', tokenRecord.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
