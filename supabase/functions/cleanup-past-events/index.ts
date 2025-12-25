import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get yesterday's date at midnight
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    const cutoffDate = yesterday.toISOString();

    console.log(`Cleaning up events before: ${cutoffDate}`);

    // Delete past gigs
    const { data: deletedGigs, error: gigsError } = await supabase
      .from("gigs")
      .delete()
      .lt("date", cutoffDate)
      .select("id");

    if (gigsError) {
      console.error("Error deleting past gigs:", gigsError);
    } else {
      console.log(`Deleted ${deletedGigs?.length || 0} past gigs`);
    }

    // Delete past rehearsals
    const { data: deletedRehearsals, error: rehearsalsError } = await supabase
      .from("rehearsals")
      .delete()
      .lt("date", cutoffDate)
      .select("id");

    if (rehearsalsError) {
      console.error("Error deleting past rehearsals:", rehearsalsError);
    } else {
      console.log(`Deleted ${deletedRehearsals?.length || 0} past rehearsals`);
    }

    // Delete past tour dates
    const { data: deletedTourDates, error: tourDatesError } = await supabase
      .from("tour_dates")
      .delete()
      .lt("date", cutoffDate)
      .select("id");

    if (tourDatesError) {
      console.error("Error deleting past tour dates:", tourDatesError);
    } else {
      console.log(`Deleted ${deletedTourDates?.length || 0} past tour dates`);
    }

    const summary = {
      gigs_deleted: deletedGigs?.length || 0,
      rehearsals_deleted: deletedRehearsals?.length || 0,
      tour_dates_deleted: deletedTourDates?.length || 0,
      cutoff_date: cutoffDate,
    };

    console.log("Cleanup complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
