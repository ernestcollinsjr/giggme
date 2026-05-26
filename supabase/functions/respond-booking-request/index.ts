import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { bookingRequestId, action } = await req.json();
    if (!bookingRequestId || !['accept', 'decline'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: br } = await admin.from('booking_requests').select('*').eq('id', bookingRequestId).maybeSingle();
    if (!br) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (br.performer_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (br.status !== 'pending') return new Response(JSON.stringify({ error: `Already ${br.status}` }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (new Date(br.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: 'Request has expired' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const { error: updErr } = await admin.from('booking_requests').update({ status: newStatus, responded_at: new Date().toISOString() }).eq('id', bookingRequestId);
    if (updErr) throw updErr;

    // Email booker
    if (br.booker_email) {
      const accent = action === 'accept' ? '#059669' : '#dc2626';
      const title = action === 'accept' ? 'Booking Request Accepted' : 'Booking Request Declined';
      const body = action === 'accept'
        ? `<strong>${br.performer_name || 'The performer'}</strong> accepted your booking request. You can follow up directly via reply or in the app.`
        : `<strong>${br.performer_name || 'The performer'}</strong> declined your booking request. You may want to reach out to another performer.`;

      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="padding:20px 24px;background:${accent};color:#fff;">
            <div style="font-size:13px;opacity:.85;">GigGme</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">${title}</div>
          </div>
          <div style="padding:20px 24px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">${body}</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">Date(s)</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${br.dates_text}${br.time_text ? ' ' + br.time_text : ''}</td></tr>
              <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Venue</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${br.venue}</td></tr>
            </table>
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
          reply_to: br.performer_email,
          subject: `${title}: ${br.venue}`,
          html,
        }),
      }).catch((e) => console.error('Resend error', e));
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
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
