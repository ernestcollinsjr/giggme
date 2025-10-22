import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemberLocation {
  member_id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  last_location_update: string;
  venue: string;
}

interface MemberLocationsMapProps {
  gigId: string;
}

export const MemberLocationsMap = ({ gigId }: MemberLocationsMapProps) => {
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMemberLocations();

    // Set up realtime subscription
    const channel = supabase
      .channel(`gig-${gigId}-locations`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchMemberLocations();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchMemberLocations, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [gigId]);

  const fetchMemberLocations = async () => {
    try {
      const { data: members, error } = await supabase
        .from("gig_members")
        .select(`
          member_id,
          location_sharing_enabled,
          gigs!inner (
            id,
            date,
            venue,
            loading_time,
            sound_check_time
          )
        `)
        .eq("gigs.id", gigId)
        .eq("status", "accepted")
        .eq("location_sharing_enabled", true);

      if (error) throw error;

      if (!members || members.length === 0) {
        setLocations([]);
        setLoading(false);
        return;
      }

      const memberIds = members.map((m: any) => m.member_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, location_lat, location_lng, updated_at")
        .in("id", memberIds)
        .not("location_lat", "is", null)
        .not("location_lng", "is", null);

      if (profilesError) throw profilesError;

      const formattedLocations = profiles?.map((p: any) => ({
        member_id: p.id,
        name: p.name,
        location_lat: p.location_lat,
        location_lng: p.location_lng,
        last_location_update: p.updated_at,
        venue: members[0].gigs.venue,
      })) || [];

      setLocations(formattedLocations);
    } catch (error) {
      console.error("Error fetching member locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (lat: number, lng: number, name: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Member Locations</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (locations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Member Locations</CardTitle>
          <CardDescription>
            No members are currently sharing their location for this gig.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Member Locations
        </CardTitle>
        <CardDescription>
          Real-time locations of band members who accepted this gig
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {locations.map((location) => (
          <div
            key={location.member_id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div>
              <p className="font-medium">{location.name}</p>
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(location.last_location_update).toLocaleTimeString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInMaps(location.location_lat, location.location_lng, location.name)}
            >
              <Navigation className="h-4 w-4 mr-2" />
              View on Map
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};