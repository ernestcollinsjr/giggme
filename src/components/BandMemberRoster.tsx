import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="border-border/50 shadow-lg">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading roster...</div>
        </CardContent>
      </Card>
    );
  }

  if (!bandId) {
    return null;
  }

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Band Roster
        </CardTitle>
        <CardDescription>
          {members.length === 0
            ? "No band members yet"
            : `${members.length} ${members.length === 1 ? "member" : "members"} in your roster`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Invite band members to gigs to build your roster</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {members.map((member) => (
              <div
                key={member.id}
                className={`flex flex-col items-center p-3 border-2 rounded-lg hover:shadow-md transition-all bg-card ${
                  member.hasAcceptedGigs
                    ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
                    : "border-red-500 bg-red-50/50 dark:bg-red-950/20"
                }`}
              >
                <Avatar className={`h-16 w-16 mb-2 border-2 ${
                  member.hasAcceptedGigs ? "border-green-500" : "border-red-500"
                }`}>
                  <AvatarImage
                    src={member.photo_urls?.[0] || ""}
                    alt={member.name}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <h4 className="font-semibold text-sm text-center mb-1 line-clamp-1">
                  {member.name}
                </h4>
                {member.hasAcceptedGigs ? (
                  <Badge className="bg-green-600 hover:bg-green-700 text-xs mb-1">
                    Accepted
                  </Badge>
                ) : (
                  <Badge className="bg-red-600 hover:bg-red-700 text-xs mb-1">
                    Pending
                  </Badge>
                )}
                {member.instrument && (
                  <Badge variant="secondary" className="text-xs">
                    <Music className="h-3 w-3 mr-1" />
                    {member.instrument}
                  </Badge>
                )}
                {member.phone_number && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {member.phone_number}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
