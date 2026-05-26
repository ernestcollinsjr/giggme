import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find pending requests past expiry
    const { data: expired, error } = await admin
      .from('booking_requests')
      .select('*')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .limit(100);

    if (error) throw error;
    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ success: true, expired: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let count = 0;
    for (const br of expired) {
      const { error: updErr } = await admin
        .from('booking_requests')
        .update({ status: 'expired', expired_notified_at: new Date().toISOString() })
        .eq('id', br.id)
        .eq('status', 'pending'); // guard
      if (updErr) {
        console.error('Failed to expire', br.id, updErr);
        continue;
      }
      count++;

      if (RESEND_API_KEY && br.booker_email) {
        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
          <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="padding:20px 24px;background:#b45309;color:#fff;">
              <div style="font-size:13px;opacity:.85;">GigGme</div>
              <div style="font-size:20px;font-weight:700;margin-top:4px;">Booking Request Expired</div>
            </div>
            <div style="padding:20px 24px;">
              <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">Your booking request to <strong>${br.performer_name || 'the performer'}</strong> for <strong>${br.venue}</strong> expired after 2 hours with no response. We recommend booking another performer.</p>
              <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">Date(s)</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${br.dates_text}${br.time_text ? ' ' + br.time_text : ''}</td></tr>
                <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Venue</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${br.venue}</td></tr>
              </table>
              <div style="margin-top:24px;text-align:center;">
                <a href="https://giggme.com/find-artists" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">Find Another Performer</a>
              </div>
              <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Sent via GigGme</p>
            </div>
          </div>
        </body></html>`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'GigGme <bookings@giggme.com>',
            to: [br.booker_email],
            subject: `Booking request expired: ${br.venue}`,
            html,
          }),
        }).catch((e) => console.error('Resend expire email failed', e));
      }
    }

    return new Response(JSON.stringify({ success: true, expired: count }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
