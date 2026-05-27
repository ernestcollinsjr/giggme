import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const html = (title: string, body: string, accent = '#059669') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<div style="max-width:520px;margin:48px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="padding:24px;background:${accent};color:#fff;">
    <div style="font-size:13px;opacity:.85;">GigGme</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px;">${title}</div>
  </div>
  <div style="padding:24px;color:#374151;font-size:15px;line-height:1.55;">${body}</div>
</div></body></html>`;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  if (!token || (action !== 'accept' && action !== 'decline')) {
    return new Response(html('Invalid Link', 'This link is missing required information.', '#dc2626'), { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: br } = await admin.from('booking_requests').select('*').eq('response_token', token).maybeSingle();
    if (!br) return new Response(html('Not Found', 'This booking request could not be found.', '#dc2626'), { status: 404, headers: { 'Content-Type': 'text/html' } });

    if (br.status !== 'pending') {
      return new Response(html(`Already ${br.status}`, `This request was already <strong>${br.status}</strong>.`, '#6b7280'), { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    if (new Date(br.expires_at).getTime() < Date.now()) {
      return new Response(html('Request Expired', 'This request has expired. Please ask the booker to resend it.', '#dc2626'), { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const { error: updErr } = await admin.from('booking_requests').update({ status: newStatus, responded_at: new Date().toISOString() }).eq('id', br.id);
    if (updErr) throw updErr;

    // Notify booker via email
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && br.booker_email) {
      const accent = action === 'accept' ? '#059669' : '#dc2626';
      const title = action === 'accept' ? 'Booking Request Accepted' : 'Booking Request Declined';
      const body = action === 'accept'
        ? `<strong>${br.performer_name || 'The performer'}</strong> accepted your booking request.`
        : `<strong>${br.performer_name || 'The performer'}</strong> declined your booking request.`;
      const emailHtml = `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="padding:20px 24px;background:${accent};color:#fff;"><div style="font-size:13px;opacity:.85;">GigGme</div><div style="font-size:20px;font-weight:700;margin-top:4px;">${title}</div></div>
          <div style="padding:20px 24px;"><p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">${body}</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">Date(s)</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${br.dates_text}${br.time_text ? ' ' + br.time_text : ''}</td></tr>
              <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Venue</td><td style="padding:8px 12px;color:#111827;font-size:14px;">${br.venue}</td></tr>
            </table></div></div></body></html>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'GigGme <bookings@giggme.com>', to: [br.booker_email], reply_to: br.performer_email, subject: `${title}: ${br.venue}`, html: emailHtml }),
      }).catch((e) => console.error('Resend error', e));
    }

    const accent = action === 'accept' ? '#059669' : '#dc2626';
    const title = action === 'accept' ? 'Request Accepted ✓' : 'Request Declined';
    const body = action === 'accept'
      ? `Thanks! You've accepted the booking at <strong>${br.venue}</strong> on <strong>${br.dates_text}</strong>. The booker has been notified.`
      : `You've declined the booking at <strong>${br.venue}</strong>. The booker has been notified.`;
    return new Response(html(title, body, accent), { status: 200, headers: { 'Content-Type': 'text/html' } });
  } catch (err) {
    console.error(err);
    return new Response(html('Something went wrong', err instanceof Error ? err.message : 'Unknown error', '#dc2626'), { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
});
