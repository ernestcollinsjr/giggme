import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

interface BookingPayload {
  performerId: string;
  performerEmail: string;
  performerName?: string;
  bookerName?: string;
  bookerEmail?: string;
  dates: string;
  time?: string;
  venue: string;
  venuePhone?: string;
  budget?: string;
  contactPerson?: string;
  dressCode?: string;
  note?: string;
  appUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Authenticate caller (the booker)
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

    const p = (await req.json()) as BookingPayload;
    if (!p.performerEmail || !p.venue || !p.dates || !p.performerId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create booking_request row (2h expiry from DB default)
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: bookingRequest, error: insertErr } = await admin
      .from('booking_requests')
      .insert({
        booker_id: user.id,
        performer_id: p.performerId,
        booker_name: p.bookerName,
        booker_email: p.bookerEmail || user.email,
        performer_name: p.performerName,
        performer_email: p.performerEmail,
        dates_text: p.dates,
        time_text: p.time,
        venue: p.venue,
        venue_phone: p.venuePhone,
        budget: p.budget,
        contact_person: p.contactPerson,
        dress_code: p.dressCode,
        note: p.note,
      })
      .select()
      .single();

    if (insertErr || !bookingRequest) {
      console.error('Insert booking_request failed', insertErr);
      throw new Error('Could not create booking request');
    }

    const appUrl = p.appUrl || 'https://giggme.com';
    const respondUrl = `${appUrl}/booking-request/${bookingRequest.id}`;
    const expiresIn = '2 minutes';

    const row = (label: string, value?: string) =>
      value
        ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">${label}</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${value}</td></tr>`
        : '';

    const performerHtml = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:20px 24px;background:linear-gradient(135deg,#6d28d9,#2563eb);color:#fff;">
          <div style="font-size:13px;opacity:.85;">GigGme</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;">New Booking Request</div>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 12px;color:#111827;font-size:15px;">Hi${p.performerName ? ' ' + p.performerName : ''},</p>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">You have received a new booking request${p.bookerName ? ' from <strong>' + p.bookerName + '</strong>' : ''}. Please respond within <strong>${expiresIn}</strong> or it will be automatically declined.</p>
          <div style="margin:0 0 20px;text-align:center;">
            <a href="${respondUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Accept or Decline</a>
            <div style="margin-top:10px;color:#6b7280;font-size:12px;">Or open this link: <a href="${respondUrl}" style="color:#6d28d9;">${respondUrl}</a></div>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${row('Date(s)', p.dates + (p.time ? ' ' + p.time : ''))}
            ${row('Venue', p.venue)}
            ${row('Venue Phone', p.venuePhone)}
            ${row('Budget', p.budget)}
            ${row('Contact Person', p.contactPerson)}
            ${row('Dress Code', p.dressCode)}
            ${row('Note', p.note)}
            ${row('From', p.bookerEmail || user.email || undefined)}
          </table>
          <p style="margin:16px 0 0;color:#6b7280;font-size:12px;text-align:center;">Request expires in ${expiresIn}.</p>
          <p style="margin:20px 0 0;color:#9ca3af;font-size:11px;">Sent via GigGme · Ref ${bookingRequest.id}</p>
        </div>
      </div>
    </body></html>`;

    // Send to performer
    const perfResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'GigGme <bookings@giggme.com>',
        to: [p.performerEmail],
        reply_to: p.bookerEmail || user.email,
        subject: `New booking request: ${p.venue} — ${p.dates}`,
        html: performerHtml,
      }),
    });
    const perfData = await perfResp.json();
    if (!perfResp.ok) console.error('Resend (performer) error', perfResp.status, perfData);

    // Confirmation to booker
    const bookerEmail = p.bookerEmail || user.email;
    if (bookerEmail) {
      const bookerHtml = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="padding:20px 24px;background:linear-gradient(135deg,#6d28d9,#2563eb);color:#fff;">
            <div style="font-size:13px;opacity:.85;">GigGme</div>
            <div style="font-size:20px;font-weight:700;margin-top:4px;">Booking Request Sent</div>
          </div>
          <div style="padding:20px 24px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">Your booking request to <strong>${p.performerName || 'the performer'}</strong> has been sent. They have <strong>${expiresIn}</strong> to respond. If they don't reply in time, we'll let you know so you can book someone else.</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              ${row('Date(s)', p.dates + (p.time ? ' ' + p.time : ''))}
              ${row('Venue', p.venue)}
              ${row('Budget', p.budget)}
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
          to: [bookerEmail],
          subject: `Booking request sent to ${p.performerName || 'performer'}`,
          html: bookerHtml,
        }),
      }).catch((e) => console.error('Booker confirm email failed', e));
    }

    return new Response(JSON.stringify({ success: true, bookingRequestId: bookingRequest.id, expiresAt: bookingRequest.expires_at }), {
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
