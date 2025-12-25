import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for expired gig response deadlines...');

    // Find all pending gig_members where deadline has passed and replacement not yet triggered
    const { data: expiredMembers, error: fetchError } = await supabase
      .from('gig_members')
      .select(`
        id,
        gig_id,
        member_id,
        response_deadline,
        gigs!inner(
          id,
          user_id,
          band_id,
          date,
          venue_name
        )
      `)
      .eq('status', 'pending')
      .eq('replacement_triggered', false)
      .not('response_deadline', 'is', null)
      .lt('response_deadline', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired members:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredMembers?.length || 0} expired response deadlines`);

    const results = [];

    for (const expiredMember of expiredMembers || []) {
      console.log(`Processing expired member ${expiredMember.member_id} for gig ${expiredMember.gig_id}`);

      // Mark the current member as replacement triggered
      const { error: updateError } = await supabase
        .from('gig_members')
        .update({
          replacement_triggered: true,
          replacement_reason: 'Response deadline expired',
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', expiredMember.id);

      if (updateError) {
        console.error(`Error updating expired member ${expiredMember.id}:`, updateError);
        continue;
      }

      // Find a replacement from band members who aren't already on this gig
      const gig = expiredMember.gigs as any;
      
      if (gig.band_id) {
        // Get all band members not already assigned to this gig
        const { data: bandMembers, error: bandError } = await supabase
          .from('band_members')
          .select('member_id')
          .eq('band_id', gig.band_id);

        if (bandError) {
          console.error('Error fetching band members:', bandError);
          continue;
        }

        // Get existing gig members
        const { data: existingGigMembers, error: existingError } = await supabase
          .from('gig_members')
          .select('member_id')
          .eq('gig_id', expiredMember.gig_id);

        if (existingError) {
          console.error('Error fetching existing gig members:', existingError);
          continue;
        }

        const existingMemberIds = existingGigMembers?.map(m => m.member_id) || [];
        const availableReplacements = bandMembers?.filter(
          m => !existingMemberIds.includes(m.member_id)
        ) || [];

        if (availableReplacements.length > 0) {
          // Pick the first available replacement
          const replacement = availableReplacements[0];
          
          // Calculate new deadline (same duration as original)
          const deadlineHours = 2; // Default 2 hours for replacement
          const newDeadline = new Date();
          newDeadline.setHours(newDeadline.getHours() + deadlineHours);

          // Create new gig_member entry for replacement
          const { data: newMember, error: insertError } = await supabase
            .from('gig_members')
            .insert({
              gig_id: expiredMember.gig_id,
              member_id: replacement.member_id,
              status: 'pending',
              response_deadline: newDeadline.toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error inserting replacement member:', insertError);
            continue;
          }

          // Update original member to show who replaced them
          await supabase
            .from('gig_members')
            .update({ replaced_by: replacement.member_id })
            .eq('id', expiredMember.id);

          // Create notification for the replacement member
          await supabase
            .from('notifications')
            .insert({
              user_id: replacement.member_id,
              title: 'New Gig Request',
              message: `You've been requested for a gig at ${gig.venue_name || 'a venue'} on ${new Date(gig.date).toLocaleDateString()}. Please respond within ${deadlineHours} hours.`,
              type: 'gig_request',
              related_id: expiredMember.gig_id
            });

          // Notify the original member that they were replaced
          await supabase
            .from('notifications')
            .insert({
              user_id: expiredMember.member_id,
              title: 'Gig Request Expired',
              message: `Your response deadline for the gig at ${gig.venue_name || 'a venue'} has passed. A replacement has been found.`,
              type: 'gig_expired',
              related_id: expiredMember.gig_id
            });

          // Notify the band leader
          await supabase
            .from('notifications')
            .insert({
              user_id: gig.user_id,
              title: 'Auto-Replacement Triggered',
              message: `A member didn't respond in time for ${gig.venue_name || 'the gig'}. A replacement request has been sent automatically.`,
              type: 'replacement_triggered',
              related_id: expiredMember.gig_id
            });

          results.push({
            gig_id: expiredMember.gig_id,
            expired_member_id: expiredMember.member_id,
            replacement_member_id: replacement.member_id,
            status: 'replaced'
          });

          console.log(`Successfully replaced member ${expiredMember.member_id} with ${replacement.member_id}`);
        } else {
          // No replacements available - notify band leader
          await supabase
            .from('notifications')
            .insert({
              user_id: gig.user_id,
              title: 'No Replacement Available',
              message: `A member didn't respond for ${gig.venue_name || 'the gig'} and no automatic replacement was available. Please find a replacement manually.`,
              type: 'no_replacement',
              related_id: expiredMember.gig_id
            });

          results.push({
            gig_id: expiredMember.gig_id,
            expired_member_id: expiredMember.member_id,
            status: 'no_replacement_available'
          });

          console.log(`No replacement available for member ${expiredMember.member_id}`);
        }
      }
    }

    console.log('Deadline check complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in check-response-deadlines:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
