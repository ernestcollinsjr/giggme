import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface BookingPayload {
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
  chatUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const p = (await req.json()) as BookingPayload;
    if (!p.performerEmail || !p.venue || !p.dates) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const row = (label: string, value?: string) =>
      value
        ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">${label}</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${value}</td></tr>`
        : '';

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:20px 24px;background:linear-gradient(135deg,#6d28d9,#2563eb);color:#fff;">
          <div style="font-size:13px;opacity:.85;">GigGme</div>
          <div style="font-size:20px;font-weight:700;margin-top:4px;">New Booking Request</div>
        </div>
        <div style="padding:20px 24px;">
          <p style="margin:0 0 12px;color:#111827;font-size:15px;">Hi${p.performerName ? ' ' + p.performerName : ''},</p>
          <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">You have received a new booking request${p.bookerName ? ' from <strong>' + p.bookerName + '</strong>' : ''}.</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            ${row('Date(s)', p.dates + (p.time ? ' ' + p.time : ''))}
            ${row('Venue', p.venue)}
            ${row('Venue Phone', p.venuePhone)}
            ${row('Budget', p.budget)}
            ${row('Contact Person', p.contactPerson)}
            ${row('Dress Code', p.dressCode)}
            ${row('Note', p.note)}
            ${row('From', p.bookerEmail)}
          </table>
          ${p.chatUrl ? `<div style="margin-top:20px;text-align:center;"><a href="${p.chatUrl}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">Reply in GigGme</a></div>` : ''}
          <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Sent via GigGme</p>
        </div>
      </div>
    </body></html>`;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GigGme <bookings@giggme.com>',
        to: [p.performerEmail],
        reply_to: p.bookerEmail,
        subject: `New booking request: ${p.venue} — ${p.dates}`,
        html,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('Resend error', resp.status, data);
      return new Response(JSON.stringify({ error: data }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
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
