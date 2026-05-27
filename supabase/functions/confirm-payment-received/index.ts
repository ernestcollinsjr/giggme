// Performer clicks the link in the payment confirmation email.
// Marks the payment confirmed and emails the manager so they can close it out.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = 'GigGme <noreply@giggme.com>';

function page(title: string, body: string, ok = true) {
  const color = ok ? '#16a34a' : '#dc2626';
  return new Response(
    `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <div style="max-width:480px;margin:60px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;">
        <div style="font-size:48px;color:${color};margin-bottom:12px;">${ok ? '✓' : '✕'}</div>
        <h1 style="font-size:20px;margin:0 0 12px;color:#111827;">${title}</h1>
        <p style="font-size:14px;color:#4b5563;line-height:1.55;margin:0;">${body}</p>
      </div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function sendEmail(to: string, subject: string, html: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return page('Invalid link', 'Missing confirmation token.', false);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: row } = await supabase
    .from('booking_manager_payments')
    .select('id, booking_manager_id, artist_id, amount, confirmed_at, source, source_id')
    .eq('confirmation_token', token)
    .maybeSingle();

  if (!row) return page('Link not found', 'This confirmation link is invalid or expired.', false);
  if (row.confirmed_at) {
    return page('Already confirmed', 'You already confirmed this payment. Thanks!');
  }

  const nowIso = new Date().toISOString();
  await supabase.from('booking_manager_payments').update({
    confirmed_at: nowIso,
    paid_at: row.amount != null ? nowIso : null,
    status: 'paid',
  }).eq('id', row.id);

  // Notify the manager
  try {
    const [{ data: manager }, { data: performer }] = await Promise.all([
      supabase.from('profiles').select('name, email').eq('id', row.booking_manager_id).maybeSingle(),
      supabase.from('profiles').select('name').eq('id', row.artist_id).maybeSingle(),
    ]);
    if (manager?.email) {
      const amt = row.amount != null ? `$${Number(row.amount).toFixed(2)}` : 'the payment';
      await sendEmail(
        manager.email,
        `${performer?.name || 'Performer'} confirmed payment received`,
        `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
          <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <div style="padding:20px 24px;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;">
              <div style="font-size:13px;opacity:.85;">GigGme</div>
              <div style="font-size:18px;font-weight:600;margin-top:2px;">Payment closed out</div>
            </div>
            <div style="padding:20px 24px;color:#111827;font-size:14px;line-height:1.55;">
              <p style="margin:0 0 12px;">Hi ${manager.name || 'there'},</p>
              <p style="margin:0 0 12px;"><strong>${performer?.name || 'Your performer'}</strong> confirmed receipt of ${amt}.</p>
              <p style="margin:0;color:#6b7280;font-size:13px;">This payment has been marked as <strong>paid</strong> in your Payment Scheduler.</p>
            </div>
          </div></body></html>`,
      );
      await supabase.from('booking_manager_payments')
        .update({ manager_notified_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  } catch (e) {
    console.error('manager notify failed', e);
  }

  return page('Payment confirmed', 'Thanks! Your manager has been notified that you received the payment.');
});
