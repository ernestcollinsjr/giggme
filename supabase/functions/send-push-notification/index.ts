import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// VAPID keys for web push
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

// Helper to convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Send push notification using Web Push protocol
async function sendWebPush(subscription: any, payload: string) {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys.p256dh;
  const auth = subscription.keys.auth;

  console.log('Sending push to endpoint:', endpoint);

  // For now, use a simple fetch to the push service
  // In production, you'd want to use proper VAPID signing
  const response = await fetch(endpoint, {
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
    throw new Error(`Push failed: ${response.status} ${text}`);
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, title, body, url, data } = await req.json();

    console.log('Sending push notification to user:', user_id);

    // Get user's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', user_id)
      .eq('platform', 'web');

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

    const payload = JSON.stringify({
      title: title || 'Notification',
      body: body || '',
      url: url || '/',
      ...data,
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
