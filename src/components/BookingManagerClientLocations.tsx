import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MemberLocation {
  member_id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  last_location_update: string;
}

interface ActiveGig {
  id: string;
  date: string;
  venue: string;
  venue_name?: string;
  band_name: string;
  band_id: string;
  status: string;
}

export const BookingManagerClientLocations = () => {
  const [activeGigs, setActiveGigs] = useState<ActiveGig[]>([]);
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManagedBandsGigs();
  }, []);

  useEffect(() => {
    if (selectedGigId) {
      fetchMemberLocations(selectedGigId);

      // Set up realtime subscription for the selected gig
      const channel = supabase
        .channel(`booking-manager-gig-${selectedGigId}-locations-${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
          },
          () => {
            fetchMemberLocations(selectedGigId);
          }
        )
        .subscribe();

      // Refresh every 30 seconds
      const interval = setInterval(() => fetchMemberLocations(selectedGigId), 30000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, [selectedGigId]);

  const fetchManagedBandsGigs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user ?? null;
      if (!user) return;

      // Get bands managed by this booking manager
      const { data: managedBands, error: bandsError } = await supabase
        .from("booking_manager_bands")
        .select(`
          band_id,
          bands!inner (
            id,
            name,
            band_leader_id
          )
        `)
        .eq("booking_manager_id", user.id);

      if (bandsError) throw bandsError;

      if (!managedBands || managedBands.length === 0) {
        setActiveGigs([]);
        setLoading(false);
        return;
      }

      const bandIds = managedBands.map((mb: any) => mb.band_id);

      // Get active/upcoming gigs for these bands
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const { data: gigs, error: gigsError } = await supabase
        .from("gigs")
        .select("id, date, venue, venue_name, status, band_id")
        .in("band_id", bandIds)
        .gte("date", oneDayAgo.toISOString())
        .order("date", { ascending: true });

      if (gigsError) throw gigsError;

      // Map gigs with band names
      const gigsWithBands = gigs?.map((gig: any) => {
        const band = managedBands.find((mb: any) => mb.band_id === gig.band_id);
        return {
          ...gig,
          band_name: band?.bands?.name || "Unknown Group",
        };
      }) || [];

      setActiveGigs(gigsWithBands);
      
      // Auto-select first gig if available
      if (gigsWithBands.length > 0) {
        setSelectedGigId(gigsWithBands[0].id);
      }
    } catch (error) {
      console.error("Error fetching managed groups gigs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberLocations = async (gigId: string) => {
    try {
      const { data: members, error } = await supabase
        .from("gig_members")
        .select(`
          member_id,
          location_sharing_enabled
        `)
        .eq("gig_id", gigId)
        .eq("status", "accepted")
        .eq("location_sharing_enabled", true);

      if (error) throw error;

      if (!members || members.length === 0) {
        setLocations([]);
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
      })) || [];

      setLocations(formattedLocations);
    } catch (error) {
      console.error("Error fetching member locations:", error);
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
          <CardTitle>Client Locations</CardTitle>
          <CardDescription>Loading your clients' gig information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (activeGigs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Client Locations</CardTitle>
          <CardDescription>
            No active gigs found for your managed groups. Add groups to your roster to see their gig locations.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedGig = activeGigs.find(g => g.id === selectedGigId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Client Gig Locations
          </CardTitle>
          <CardDescription>
            Track your clients' locations during active gigs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Gig</label>
            <div className="grid gap-2">
              {activeGigs.map((gig) => (
                <button
                  key={gig.id}
                  onClick={() => setSelectedGigId(gig.id)}
                  className={`p-3 border rounded-lg text-left transition-all ${
                    selectedGigId === gig.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{gig.band_name}</span>
                        <Badge variant={gig.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                          {gig.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(gig.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <p className="text-sm">{gig.venue_name || gig.venue}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedGig && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-3">
                Band Member Locations - {selectedGig.band_name}
              </h3>
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No group members are currently sharing their location for this gig.
                </p>
              ) : (
                <div className="space-y-2">
                  {locations.map((location) => (
                    <div
                      key={location.member_id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-background"
                    >
                      <div>
                        <p className="font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">
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
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
