import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BandMember {
  id: string;
  name: string;
  photo_urls: string[];
  instrument: string | null;
  bio: string | null;
  phone_number: string | null;
  hasAcceptedGigs?: boolean;
  joinedAt?: string;
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
        // Get official band members from band_members table
        const { data: bandMembers, error: bandMembersError } = await supabase
          .from("band_members")
          .select("member_id, joined_at")
          .eq("band_id", bandId);

        if (bandMembersError) throw bandMembersError;

        if (!bandMembers || bandMembers.length === 0) {
          setMembers([]);
          setLoading(false);
          return;
        }

        const memberIds = bandMembers.map((bm) => bm.member_id);

        // Fetch profiles for these members
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", memberIds);

        if (profilesError) throw profilesError;

        // Show green indicator ONLY on the day of a performer's accepted gig,
        // from 12:00 AM until the gig's end_time has passed.
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const { data: acceptedMembers } = await supabase
          .from("gig_members")
          .select(`
            member_id,
            gigs!inner (
              band_id,
              date,
              end_time
            )
          `)
          .eq("gigs.band_id", bandId)
          .eq("status", "accepted")
          .gte("gigs.date", startOfToday.toISOString())
          .lte("gigs.date", endOfToday.toISOString());

        const activeMemberIds = new Set<string>();
        (acceptedMembers || []).forEach((am: any) => {
          const gig = am.gigs;
          if (!gig) return;
          const gigDate = new Date(gig.date);
          // Determine the gig's end moment
          let endMoment = new Date(gigDate.getFullYear(), gigDate.getMonth(), gigDate.getDate(), 23, 59, 59);
          if (gig.end_time) {
            const match = String(gig.end_time).match(/^(\d{1,2}):(\d{2})/);
            if (match) {
              const h = parseInt(match[1], 10);
              const m = parseInt(match[2], 10);
              endMoment = new Date(gigDate.getFullYear(), gigDate.getMonth(), gigDate.getDate(), h, m, 0);
            }
          }
          if (now >= startOfToday && now <= endMoment) {
            activeMemberIds.add(am.member_id);
          }
        });

        // Create a map of member_id to joined_at
        const joinedAtMap = new Map(bandMembers.map(bm => [bm.member_id, bm.joined_at]));

        // Add acceptance status and joined date to profiles
        const membersWithStatus = profiles?.map(profile => ({
          ...profile,
          hasAcceptedGigs: activeMemberIds.has(profile.id),
          joinedAt: joinedAtMap.get(profile.id)
        })) || [];


        setMembers(membersWithStatus);
      } catch (error: any) {
        console.error("Error fetching group members:", error);
        toast({
          variant: "destructive",
          title: "Failed to load group members",
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
          <p className="text-xs">Invite group members to gigs to build your roster</p>
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
              {member.joinedAt && (
                <p className="text-[9px] text-muted-foreground/70 mt-0.5 flex items-center gap-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {format(new Date(member.joinedAt), "MMM d, yyyy")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
