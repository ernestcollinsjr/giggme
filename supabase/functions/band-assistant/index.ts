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

    // Proactive analysis: detect scheduling conflicts and rehearsal gaps
    const proactiveAlerts: string[] = [];
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const allEvents = [
      ...upcomingGigs.map((g: any) => ({ type: "gig", date: g.date, label: g.venue_name || g.venue })),
      ...upcomingRehearsals.map((r: any) => ({ type: "rehearsal", date: r.date, label: r.venue })),
    ].filter(e => e.date && new Date(e.date) >= now);

    const byDay = new Map<string, typeof allEvents>();
    for (const ev of allEvents) {
      const key = new Date(ev.date).toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(ev);
    }
    for (const [day, events] of byDay) {
      if (events.length > 1) {
        proactiveAlerts.push(
          `⚠️ CONFLICT on ${day}: ${events.map(e => `${e.type} (${e.label})`).join(" + ")}`
        );
      }
    }

    const soonGigs = upcomingGigs.filter((g: any) => {
      const d = new Date(g.date).getTime();
      return d >= now.getTime() && d <= now.getTime() + 14 * dayMs;
    });
    for (const gig of soonGigs) {
      const gigTime = new Date(gig.date).getTime();
      const hasRehearsal = upcomingRehearsals.some((r: any) => {
        const rt = new Date(r.date).getTime();
        return rt >= gigTime - 10 * dayMs && rt <= gigTime;
      });
      if (!hasRehearsal) {
        proactiveAlerts.push(
          `🎯 No rehearsal scheduled before gig on ${new Date(gig.date).toLocaleDateString()} at ${gig.venue_name || gig.venue} — suggest one.`
        );
      }
    }

    if (setlists.length === 0 && soonGigs.length > 0) {
      proactiveAlerts.push(`📋 ${soonGigs.length} gig(s) coming up but no setlists found — suggest creating one.`);
    }

    if (proactiveAlerts.length > 0) {
      contextParts.push(`\nPROACTIVE ALERTS (raise these unprompted when relevant):\n${proactiveAlerts.join("\n")}`);
    }

    const systemPrompt = contextParts.join("\n") + `

You are a PROACTIVE band management assistant — don't just answer questions, anticipate problems and surface them.

ON EVERY RESPONSE:
1. If PROACTIVE ALERTS are listed above, lead with the most urgent one (conflicts > missing rehearsals > missing setlists), even if the user didn't ask about it.
2. Cross-check dates for scheduling conflicts (two events on the same day, or within 2 hours of each other).
3. For any gig within 14 days, verify a rehearsal is scheduled in the prior 10 days. If not, recommend a specific rehearsal date and time.
4. Flag gigs missing key info: venue, setlist, or band member assignments.
5. Suggest setlist refinements when a gig is within 7 days (length, opener/closer, energy curve).

TONE:
- Direct and concise. No filler ("Great question!", "I'd be happy to...").
- Use ⚠️ for conflicts, 🎯 for action items, ✅ for confirmations.
- Always reference specific dates, venues, and names from the user's data — never generic advice.
- End every response with ONE clear next-step suggestion the user can act on.

You can help with: gig/rehearsal/setlist questions, conflict detection, rehearsal scheduling, setlist ordering by venue type and show length, gig summaries and reminders, and performance/band management advice.`;

    // System prompt intentionally not logged (contains user PII)

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
