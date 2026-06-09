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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { bookingRequestId } = await req.json();
    if (!bookingRequestId) {
      return new Response(JSON.stringify({ error: 'Missing bookingRequestId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: br, error: fetchErr } = await admin
      .from('booking_requests')
      .select('*')
      .eq('id', bookingRequestId)
      .maybeSingle();

    if (fetchErr || !br) {
      return new Response(JSON.stringify({ error: 'Booking request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (br.booker_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (br.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Request is already ${br.status}` }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extend expiry by 2 hours from now
    const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { error: updErr } = await admin
      .from('booking_requests')
      .update({ expires_at: newExpiresAt })
      .eq('id', bookingRequestId);
    if (updErr) throw updErr;

    const rawAppUrl = 'https://giggme.com';
    const respondUrl = `${rawAppUrl}/booking-request/${br.id}`;
    const acceptUrl = `${SUPABASE_URL}/functions/v1/public-respond-booking-request?token=${br.response_token}&action=accept`;
    const declineUrl = `${SUPABASE_URL}/functions/v1/public-respond-booking-request?token=${br.response_token}&action=decline`;
    const expiresIn = '2 hours';

    const row = (label: string, value?: string) =>
      value
        ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">${label}</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${value}</td></tr>`
        : '';

    const performerHtml = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:20px 24px;background:linear-gradient(135deg,#6d28d9,#2563eb);color:#fff;">
          <div style="font-size:13px;opacity:.85;">GigGme</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;">New Book Performer</div>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 12px;color:#111827;font-size:15px;">Hi${br.performer_name ? ' ' + br.performer_name : ''},</p>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">You have received a new book performer${br.booker_name ? ' from <strong>' + br.booker_name + '</strong>' : ''}. Please respond within <strong>${expiresIn}</strong> or it will be automatically declined.</p>
          <div style="margin:0 0 20px;text-align:center;">
            <a href="${acceptUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;margin:0 6px 8px;">✓ Accept</a>
            <a href="${declineUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;margin:0 6px 8px;">✗ Decline</a>
            <div style="margin-top:10px;"><a href="${respondUrl}" style="color:#6d28d9;font-size:13px;text-decoration:underline;">View details in GigGme</a></div>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${row('Date(s)', br.dates_text + (br.time_text ? ' ' + br.time_text : ''))}
            ${row('Venue', br.venue)}
            ${row('Venue Phone', br.venue_phone)}
            ${row('Budget', br.budget)}
            ${row('Contact Person', br.contact_person)}
            ${row('Dress Code', br.dress_code)}
            ${row('Note', br.note)}
            ${row('From', br.booker_email || undefined)}
          </table>
          <p style="margin:16px 0 0;color:#6b7280;font-size:12px;text-align:center;">Request expires in ${expiresIn}.</p>
          <p style="margin:20px 0 0;color:#9ca3af;font-size:11px;">Sent via GigGme · Ref ${br.id}</p>
        </div>
      </div>
    </body></html>`;

    const perfResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GigGme <bookings@giggme.com>',
        to: [br.performer_email],
        reply_to: br.booker_email || user.email,
        subject: `New book performer: ${br.venue} — ${br.dates_text}`,
        html: performerHtml,
      }),
    });
    const perfData = await perfResp.json();
    if (!perfResp.ok) console.error('Resend (performer) error', perfResp.status, perfData);

    return new Response(JSON.stringify({ success: true, expiresAt: newExpiresAt }), {
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
