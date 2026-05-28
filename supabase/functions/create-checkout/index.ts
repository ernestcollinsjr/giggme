import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("Price ID is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Pricing tiers with trial periods
    const SUBSCRIPTION_CONFIG: Record<string, { trialDays?: number }> = {
      // Musicians/Entertainers - $10.99/mo, 14-day free trial
      "price_1SLNn8EPiAZgF8MeCFVMdvWR": { trialDays: 14 },
      // Band Manager - $14/mo, 7-day free trial
      "price_1Sfl1yEPiAZgF8MerV2S8Hcf": { trialDays: 7 },
      // Booking Agent - $26/mo, 7-day free trial
      "price_1Sfl29EPiAZgF8Me7Z7r8ty8": { trialDays: 7 },
      // Venue Owner - $26/mo, 14-day free trial
      "price_1Sj4nrEPiAZgF8MeCOUpkIfg": { trialDays: 14 },
      // Entertainer Basic - $8/mo, 7-day free trial
      "price_1TcATOEPiAZgF8Me2TkOBbG0": { trialDays: 7 },
      // Featured Entertainer - $14/mo, 7-day free trial
      "price_1TcATsEPiAZgF8MeuJY76UlD": { trialDays: 7 },
    };

    // One-time payment prices (no trial, payment mode)
    const ONE_TIME_PRICES = [
      "price_1Sj4o1EPiAZgF8MeVAfYLZ1h", // One-Time Booking - $49
    ];

    const isOneTime = ONE_TIME_PRICES.includes(priceId);
    const trialDays = SUBSCRIPTION_CONFIG[priceId]?.trialDays;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isOneTime ? "payment" : "subscription",
      subscription_data: !isOneTime && trialDays ? { trial_period_days: trialDays } : undefined,
      success_url: `${req.headers.get("origin")}/dashboard?checkout=success`,
      cancel_url: `${req.headers.get("origin")}/pricing?checkout=canceled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
