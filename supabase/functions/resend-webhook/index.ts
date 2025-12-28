import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event: ResendWebhookEvent = await req.json();
    
    console.log("Received Resend webhook event:", event.type, event.data?.email_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailId = event.data?.email_id;
    if (!emailId) {
      console.log("No email_id in event, skipping");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Map Resend event types to our status and timestamp fields
    let updateData: Record<string, unknown> = {};
    
    switch (event.type) {
      case 'email.delivered':
        updateData = { 
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        };
        break;
      case 'email.opened':
        updateData = { 
          status: 'opened',
          opened_at: new Date().toISOString(),
        };
        break;
      case 'email.clicked':
        updateData = { 
          status: 'clicked',
          clicked_at: new Date().toISOString(),
        };
        break;
      case 'email.bounced':
        updateData = { status: 'bounced' };
        break;
      case 'email.complained':
        updateData = { status: 'complained' };
        break;
      default:
        console.log("Unhandled event type:", event.type);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    // Update the tracking record
    const { error } = await supabase
      .from('email_tracking')
      .update(updateData)
      .eq('resend_email_id', emailId);

    if (error) {
      console.error("Failed to update tracking record:", error);
    } else {
      console.log("Updated email tracking for:", emailId, "with status:", updateData.status);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in resend-webhook function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);