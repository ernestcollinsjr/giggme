import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendRiderRequest {
  recipientEmail: string;
  recipientName?: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, recipientName, userId }: SendRiderRequest = await req.json();

    if (!recipientEmail || !userId) {
      throw new Error("Recipient email and user ID are required");
    }

    console.log("Sending rider requirements for user:", userId, "to:", recipientEmail);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email, bio, instrument, rider_notes")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error:", profileError);
      throw new Error("Could not fetch user profile");
    }

    console.log("Profile fetched:", profile.name);

    // Build email content
    const riderContent = profile.rider_notes || "No specific rider requirements provided.";
    const instrumentInfo = profile.instrument ? `Primary Instrument: ${profile.instrument}` : "";
    const bioInfo = profile.bio || "No bio available.";

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Rider Requirements <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `Rider Requirements - ${profile.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
              Rider Requirements
            </h1>
            
            <div style="margin: 20px 0;">
              <h2 style="color: #4F46E5; font-size: 18px;">Artist/Musician Information</h2>
              <p><strong>Name:</strong> ${profile.name}</p>
              <p><strong>Email:</strong> ${profile.email}</p>
              ${instrumentInfo ? `<p><strong>${instrumentInfo}</strong></p>` : ''}
            </div>

            <div style="margin: 20px 0;">
              <h2 style="color: #4F46E5; font-size: 18px;">Bio</h2>
              <p style="white-space: pre-wrap;">${bioInfo}</p>
            </div>

            <div style="margin: 20px 0; padding: 20px; background-color: #F3F4F6; border-left: 4px solid #4F46E5; border-radius: 4px;">
              <h2 style="color: #4F46E5; font-size: 18px; margin-top: 0;">Rider Requirements</h2>
              <p style="white-space: pre-wrap; margin-bottom: 0;">${riderContent}</p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 14px;">
              <p>This email was sent from the Band Management Platform.</p>
              ${recipientName ? `<p>Sent to: ${recipientName}</p>` : ''}
            </div>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(errorData.message || "Failed to send email");
    }

    const emailData = await emailResponse.json();

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Rider requirements sent successfully",
      emailId: emailData.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-rider function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);