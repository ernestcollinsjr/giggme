import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header - returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false, product_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      logStep("Auth failed or no email - returning unsubscribed", { error: userError?.message });
      return new Response(JSON.stringify({ subscribed: false, product_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false, product_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    // Prefer trialing/active subscriptions
    const relevant = subscriptions.data.find((s) =>
      ["trialing", "active", "past_due"].includes(s.status)
    );
    const hasActiveSub = !!relevant;
    let productId: string | null = null;
    let priceId: string | null = null;
    let amount: number | null = null;
    let currency: string | null = null;
    let interval: string | null = null;
    let subscriptionEnd: string | null = null;
    let status: string | null = null;
    let trialEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    if (relevant) {
      subscriptionEnd = new Date(relevant.current_period_end * 1000).toISOString();
      status = relevant.status;
      trialEnd = relevant.trial_end ? new Date(relevant.trial_end * 1000).toISOString() : null;
      cancelAtPeriodEnd = relevant.cancel_at_period_end;
      const item = relevant.items.data[0];
      productId = item.price.product as string;
      priceId = item.price.id;
      amount = item.price.unit_amount;
      currency = item.price.currency;
      interval = item.price.recurring?.interval ?? null;
      logStep("Subscription found", { id: relevant.id, status, priceId, trialEnd, subscriptionEnd });
    } else {
      logStep("No active/trialing subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      price_id: priceId,
      amount,
      currency,
      interval,
      subscription_end: subscriptionEnd,
      status,
      trial_end: trialEnd,
      is_trial: status === "trialing",
      cancel_at_period_end: cancelAtPeriodEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });


  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage, subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
