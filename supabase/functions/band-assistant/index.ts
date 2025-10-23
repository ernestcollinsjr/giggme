import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    
    // Extract user ID from JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing authorization header");
    
    const token = authHeader.replace('Bearer ', '');
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Initialize Supabase client with service role for data access
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authentication token");
    
    const userId = user.id;

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const userRole = roleData?.role;

    // Fetch user context based on role
    let gigsRes, rehearsalsRes, setlistsRes, bandsRes;
    
    if (userRole === "band_leader") {
      [gigsRes, rehearsalsRes, setlistsRes, bandsRes] = await Promise.all([
        supabase.from("gigs").select("*").eq("user_id", userId).order("date", { ascending: true }).limit(10),
        supabase.from("rehearsals").select("*").eq("band_leader_id", userId).order("date", { ascending: true }).limit(5),
        supabase.from("setlists").select("*, setlist_songs(*)").eq("band_leader_id", userId).limit(5),
        supabase.from("bands").select("*").eq("band_leader_id", userId)
      ]);
    } else if (userRole === "band_member") {
      // For band members, fetch gig invites and general gigs/rehearsals
      const gigInvitesRes = await supabase
        .from("gig_members")
        .select("gig_id")
        .eq("member_id", userId);
      
      const gigIds = gigInvitesRes.data?.map(g => g.gig_id) || [];
      
      [gigsRes, rehearsalsRes, setlistsRes] = await Promise.all([
        gigIds.length > 0 
          ? supabase.from("gigs").select("*").in("id", gigIds).order("date", { ascending: true }).limit(10)
          : { data: [] },
        supabase.from("rehearsals").select("*").order("date", { ascending: true }).limit(5),
        supabase.from("setlists").select("*, setlist_songs(*)").limit(5)
      ]);
      bandsRes = { data: [] };
    } else {
      // Booking managers see all gigs
      [gigsRes, rehearsalsRes, setlistsRes] = await Promise.all([
        supabase.from("gigs").select("*").order("date", { ascending: true }).limit(10),
        supabase.from("rehearsals").select("*").order("date", { ascending: true }).limit(5),
        supabase.from("setlists").select("*, setlist_songs(*)").limit(5)
      ]);
      bandsRes = { data: [] };
    }

    const [profileRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single()
    ]);

    const upcomingGigs = gigsRes?.data || [];
    const upcomingRehearsals = rehearsalsRes?.data || [];
    const setlists = setlistsRes?.data || [];
    const profile = profileRes?.data;
    const bands = bandsRes?.data || [];

    // Build context for AI
    const roleLabel = 
      userRole === "band_leader" ? "band leader" :
      userRole === "band_member" ? "band member" :
      "booking manager";

    const contextParts = [
      `You are a helpful band management assistant for ${profile?.name || "the user"} (${roleLabel}).`,
    ];

    if (bands.length > 0) {
      contextParts.push(`\nYOUR BANDS:\n${bands.map(b => `- ${b.name}${b.description ? `: ${b.description}` : ""}`).join("\n")}`);
    }

    if (upcomingGigs.length > 0) {
      contextParts.push(`\nUPCOMING GIGS (${upcomingGigs.length}):\n${upcomingGigs.map(g => 
        `- ${new Date(g.date).toLocaleDateString()}: ${g.venue_name || g.venue}${g.notes ? ` (${g.notes})` : ""}`
      ).join("\n")}`);
    }

    if (upcomingRehearsals.length > 0) {
      contextParts.push(`\nUPCOMING REHEARSALS (${upcomingRehearsals.length}):\n${upcomingRehearsals.map(r => 
        `- ${new Date(r.date).toLocaleDateString()}: ${r.venue}${r.notes ? ` - ${r.notes}` : ""}`
      ).join("\n")}`);
    }

    if (setlists.length > 0) {
      contextParts.push(`\nSETLISTS (${setlists.length}):\n${setlists.map(s => 
        `- ${s.title}${s.description ? `: ${s.description}` : ""} (${s.setlist_songs?.length || 0} songs)`
      ).join("\n")}`);
    }

    const systemPrompt = contextParts.join("\n") + `

You can help with:
- Answering questions about gigs, rehearsals, and setlists
- Suggesting setlist orders based on venue type and show length
- Recommending rehearsal schedules before gigs
- Creating gig summaries and reminders
- Offering performance tips and band management advice

Keep responses concise and actionable. Always reference specific data when available.`;

    console.log("System prompt:", systemPrompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("band-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
