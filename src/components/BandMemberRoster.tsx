import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Music } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BandMember {
  id: string;
  name: string;
  photo_urls: string[];
  instrument: string | null;
  bio: string | null;
  phone_number: string | null;
  hasAcceptedGigs?: boolean;
}

interface BandMemberRosterProps {
  bandId: string | null;
}

export const BandMemberRoster = ({ bandId }: BandMemberRosterProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bandId) {
      setLoading(false);
      return;
    }

    const fetchBandMembers = async () => {
      try {
        // Get all unique members who have been invited to gigs for this band
        const { data: gigMembers, error: gigMembersError } = await supabase
          .from("gig_members")
          .select(`
            member_id,
            gigs!inner (
              id,
              band_id
            )
          `)
          .eq("gigs.band_id", bandId);

        if (gigMembersError) throw gigMembersError;

        // Get unique member IDs
        const uniqueMemberIds = [...new Set(gigMembers?.map((gm: any) => gm.member_id) || [])];

        if (uniqueMemberIds.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }

        // Fetch profiles for these members
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", uniqueMemberIds);

        if (profilesError) throw profilesError;

        // Check which members have accepted gigs for this band
        const { data: acceptedMembers } = await supabase
          .from("gig_members")
          .select(`
            member_id,
            gigs!inner (
              band_id
            )
          `)
          .eq("gigs.band_id", bandId)
          .eq("status", "accepted");

        const acceptedMemberIds = new Set(acceptedMembers?.map((am: any) => am.member_id) || []);

        // Add acceptance status to profiles
        const membersWithStatus = profiles?.map(profile => ({
          ...profile,
          hasAcceptedGigs: acceptedMemberIds.has(profile.id)
        })) || [];

        setMembers(membersWithStatus);
      } catch (error: any) {
        console.error("Error fetching band members:", error);
        toast({
          variant: "destructive",
          title: "Failed to load band members",
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBandMembers();
  }, [bandId, toast]);

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-4">Loading roster...</div>
    );
  }

  if (!bandId) {
    return null;
  }

  return (
    <div>
      {members.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">Invite band members to gigs to build your roster</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className={`flex flex-col items-center p-2 border rounded-md hover:shadow-sm transition-all ${
                member.hasAcceptedGigs
                  ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10"
                  : "border-red-500/50 bg-red-50/30 dark:bg-red-950/10"
              }`}
            >
              <Avatar className={`h-10 w-10 mb-1 border ${
                member.hasAcceptedGigs ? "border-green-500" : "border-red-500"
              }`}>
                <AvatarImage
                  src={member.photo_urls?.[0] || ""}
                  alt={member.name}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <h4 className="font-medium text-xs text-center line-clamp-1 w-full px-1">
                {member.name}
              </h4>
              {member.hasAcceptedGigs ? (
                <Badge className="bg-green-600 hover:bg-green-700 text-[10px] h-4 px-1.5 mt-1 animate-pulse shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]">
                  ✓
                </Badge>
              ) : (
                <Badge className="bg-red-600 hover:bg-red-700 text-[10px] h-4 px-1.5 mt-1">
                  ?
                </Badge>
              )}
              {member.instrument && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate w-full text-center">
                  {member.instrument}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
