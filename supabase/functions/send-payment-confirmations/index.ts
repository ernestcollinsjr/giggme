// Sends "payment confirmation" emails to performers at 5pm on the scheduled due_date.
// Designed to be invoked by pg_cron hourly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const PUBLIC_SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://giggme.com').replace(/\/$/, '');
const FROM = 'GigGme <noreply@giggme.com>';
const SEND_HOUR_LOCAL = 17; // 5 PM
const TZ = 'America/New_York';

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
}

function nowInTZHour(tz: string): { hour: number; ymd: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { hour: parseInt(parts.hour, 10), ymd: `${parts.year}-${parts.month}-${parts.day}` };
}

function htmlEmail(opts: {
  performerName: string; managerName: string; amount: number | null;
  venue: string; eventDate: string; confirmUrl: string;
}) {
  const amt = opts.amount != null ? `$${Number(opts.amount).toFixed(2)}` : 'your payment';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;">
        <div style="font-size:13px;opacity:.85;">GigGme</div>
        <div style="font-size:18px;font-weight:600;margin-top:2px;">Payment confirmation</div>
      </div>
      <div style="padding:20px 24px;color:#111827;">
        <p style="margin:0 0 12px 0;font-size:14px;">Hi ${opts.performerName || 'there'},</p>
        <p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;">
          ${opts.managerName || 'Your manager'} scheduled ${amt} to be sent today for your performance.
          Please confirm that you have received it.
        </p>
        <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:120px;">Amount</td><td style="padding:8px 12px;font-size:14px;">${amt}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Venue</td><td style="padding:8px 12px;font-size:14px;">${opts.venue || '—'}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Event date</td><td style="padding:8px 12px;font-size:14px;">${opts.eventDate}</td></tr>
        </table>
        <div style="text-align:center;margin:24px 0;">
          <a href="${opts.confirmUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">I received this payment</a>
        </div>
        <p style="margin:20px 0 0 0;font-size:12px;color:#6b7280;">If you did not receive payment, contact your manager directly.</p>
      </div>
    </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { hour, ymd } = nowInTZHour(TZ);

  // Only run during the 5pm hour (allow up to 8pm catch-up window for missed runs)
  if (hour < SEND_HOUR_LOCAL || hour > 20) {
    return new Response(JSON.stringify({ skipped: true, hour }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: rows, error } = await supabase
    .from('booking_manager_payments')
    .select('id, booking_manager_id, artist_id, source, source_id, amount, due_date')
    .lte('due_date', ymd)
    .is('confirmation_sent_at', null)
    .is('confirmed_at', null)
    .neq('status', 'paid');

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  let sent = 0, errors = 0;
  for (const r of rows || []) {
    try {
      const [{ data: performer }, { data: manager }] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', r.artist_id).maybeSingle(),
        supabase.from('profiles').select('name').eq('id', r.booking_manager_id).maybeSingle(),
      ]);
      if (!performer?.email) { errors++; continue; }

      // event details
      let venue = '', eventDate = '';
      if (r.source === 'booking_request') {
        const { data: br } = await supabase.from('booking_requests')
          .select('venue, event_date').eq('id', r.source_id).maybeSingle();
        venue = br?.venue || ''; eventDate = br?.event_date ? new Date(br.event_date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : '';
      } else if (r.source === 'gig') {
        const { data: g } = await supabase.from('gigs')
          .select('venue, venue_name, date').eq('id', r.source_id).maybeSingle();
        venue = g?.venue_name || g?.venue || '';
        eventDate = g?.date ? new Date(g.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : '';
      }

      const token = crypto.randomUUID();
      const confirmUrl = `${SUPABASE_URL}/functions/v1/confirm-payment-received?token=${token}`;

      await sendEmail(
        performer.email,
        'Please confirm your payment',
        htmlEmail({
          performerName: performer.name || '',
          managerName: manager?.name || '',
          amount: r.amount, venue, eventDate, confirmUrl,
        }),
      );

      await supabase.from('booking_manager_payments').update({
        confirmation_token: token,
        confirmation_sent_at: new Date().toISOString(),
        recipient_email_at_send: performer.email,
      }).eq('id', r.id);
      sent++;
    } catch (e) {
      console.error('confirmation send failed', r.id, e);
      errors++;
    }
  }
  return new Response(JSON.stringify({ sent, errors, checked: rows?.length || 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
