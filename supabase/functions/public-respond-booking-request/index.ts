import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const APP_URL = 'https://giggme.com';

const redirect = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_URL}/booking-response?${qs}` },
  });
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const action = url.searchParams.get('action');

  if (!token || (action !== 'accept' && action !== 'decline')) {
    return redirect({ status: 'invalid' });
  }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: br } = await admin.from('booking_requests').select('*').eq('response_token', token).maybeSingle();
    if (!br) return redirect({ status: 'invalid' });

    if (br.status !== 'pending') {
      return redirect({ status: 'already', venue: br.venue || '', date: br.dates_text || '' });
    }
    if (new Date(br.expires_at).getTime() < Date.now()) {
      return redirect({ status: 'expired' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const { error: updErr } = await admin
      .from('booking_requests')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('id', br.id);
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
        body: JSON.stringify({
          from: 'GigGme <bookings@giggme.com>',
          to: [br.booker_email],
          reply_to: br.performer_email,
          subject: `${title}: ${br.venue}`,
          html: emailHtml,
        }),
      }).catch((e) => console.error('Resend error', e));
    }

    return redirect({
      status: newStatus,
      venue: br.venue || '',
      date: br.dates_text || '',
    });
  } catch (err) {
    console.error(err);
    return redirect({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
  }
});
