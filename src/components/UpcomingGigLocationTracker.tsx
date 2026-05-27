import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation, AlertCircle, ExternalLink, CheckCircle2, Car, Flag, Send } from "lucide-react";
import { format, parseISO, differenceInMinutes, isToday } from "date-fns";
import { toast } from "sonner";
import { AutoLocationTracker } from "./AutoLocationTracker";

// Haversine distance in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface TravelProgressProps {
  name: string;
  progress: number; // 0..1
  distanceKm: number | null;
  arrived: boolean;
}

const TravelProgress = ({ name, progress, distanceKm, arrived }: TravelProgressProps) => {
  const pct = arrived ? 100 : Math.max(0, Math.min(100, Math.round(progress * 100)));
  const dots = 12;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{name}</span>
        <span>
          {arrived
            ? "Arrived"
            : distanceKm != null
              ? `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away`
              : "On the way"}
        </span>
      </div>
      <div className="relative h-6">
        {/* dotted road */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between">
          {Array.from({ length: dots }).map((_, i) => {
            const dotPct = (i / (dots - 1)) * 100;
            const passed = dotPct <= pct;
            return (
              <div
                key={i}
                className={`h-1 w-1 rounded-full transition-colors ${
                  passed ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            );
          })}
        </div>
        {/* car marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pct}%` }}
        >
          <div
            className={`p-1 rounded-full shadow-sm ${
              arrived ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {arrived ? <CheckCircle2 className="h-3 w-3" /> : <Car className="h-3 w-3" />}
          </div>
        </div>
        {/* venue flag */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
          <div className="p-1 rounded-full bg-muted text-muted-foreground">
            <Flag className="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
};

type TravelStatus = "not_started" | "in_transit" | "arrived";
interface TravelRow {
  gig_id: string;
  user_id: string;
  status: TravelStatus;
  started_at: string | null;
  arrived_at: string | null;
  profile?: { name?: string | null } | null;
}

interface UpcomingGig {
  id: string;
  date: string;
  venue: string;
  venue_name: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  loading_time: string | null;
  sound_check_time: string | null;
  location_sharing_enabled: boolean;
  gig_owner_id?: string | null;
}

interface UpcomingGigLocationTrackerProps {
  userId: string;
  userRole: "band_member" | "band_leader" | "artist" | "booking_manager" | "tour_manager" | "super_admin";
}

export const UpcomingGigLocationTracker = ({ userId, userRole }: UpcomingGigLocationTrackerProps) => {
  const [upcomingGigs, setUpcomingGigs] = useState<UpcomingGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [travelByGig, setTravelByGig] = useState<Record<string, TravelRow[]>>({});
  const [locByUser, setLocByUser] = useState<Record<string, { lat: number; lng: number }>>({});
  // Per-gig flag: user tapped Navigate but we don't have location permission yet
  const [needsPermission, setNeedsPermission] = useState<Record<string, boolean>>({});
  // Persist the starting distance (per user+gig) so we can compute progress %
  const startDistRef = useRef<Record<string, number>>({});

  // Ask the browser for a one-shot position to trigger the permission prompt.
  // Returns true if we got a fix (permission granted), false otherwise.
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) return false;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      // Seed profile location so the car appears on the road immediately
      try {
        await supabase
          .from("profiles")
          .update({
            location_lat: pos.coords.latitude,
            location_lng: pos.coords.longitude,
          })
          .eq("id", userId);
      } catch {/* ignore */}
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  const fetchTravelStatus = useCallback(async (gigIds: string[]) => {
    if (gigIds.length === 0) return;
    const { data } = await supabase
      .from("gig_travel_status")
      .select("gig_id, user_id, status, started_at, arrived_at")
      .in("gig_id", gigIds);

    const userIds = Array.from(new Set((data || []).map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, name, location_lat, location_lng")
          .in("id", userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const locs: Record<string, { lat: number; lng: number }> = {};
    (profiles || []).forEach((p: any) => {
      if (p.location_lat != null && p.location_lng != null) {
        locs[p.id] = { lat: p.location_lat, lng: p.location_lng };
      }
    });
    setLocByUser(locs);

    const grouped: Record<string, TravelRow[]> = {};
    (data || []).forEach((row: any) => {
      grouped[row.gig_id] ??= [];
      grouped[row.gig_id].push({ ...row, profile: profileMap.get(row.user_id) || null });
    });
    setTravelByGig(grouped);
  }, []);

  useEffect(() => {
    fetchUpcomingGigs();
    const interval = setInterval(fetchUpcomingGigs, 60000);
    return () => clearInterval(interval);
  }, [userId, userRole]);

  useEffect(() => {
    const ids = upcomingGigs.map((g) => g.id);
    fetchTravelStatus(ids);
    if (ids.length === 0) return;
    const channel = supabase
      .channel(`gig-travel-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gig_travel_status" },
        () => fetchTravelStatus(ids),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [upcomingGigs, fetchTravelStatus, userId]);

  // Poll profile locations every 30s while anyone is in-transit, so the
  // car marker on the road moves as their phone updates location.
  useEffect(() => {
    const ids = upcomingGigs.map((g) => g.id);
    if (ids.length === 0) return;
    const anyInTransit = Object.values(travelByGig)
      .flat()
      .some((r) => r.status === "in_transit");
    if (!anyInTransit) return;
    const t = setInterval(() => fetchTravelStatus(ids), 30000);
    return () => clearInterval(t);
  }, [upcomingGigs, travelByGig, fetchTravelStatus]);

  const updateTravelStatus = async (gig: UpcomingGig, status: TravelStatus) => {
    const source = gig.location_sharing_enabled !== undefined && "loading_time" in gig && gig.venue_lat === null && gig.venue_lng === null
      ? "booking_request"
      : "gig";
    const payload: any = {
      gig_id: gig.id,
      user_id: userId,
      source,
      status,
    };
    if (status === "in_transit") payload.started_at = new Date().toISOString();
    if (status === "arrived") payload.arrived_at = new Date().toISOString();

    await supabase
      .from("gig_travel_status")
      .upsert(payload, { onConflict: "gig_id,user_id" });
    fetchTravelStatus(upcomingGigs.map((g) => g.id));
  };

  const fetchUpcomingGigs = async () => {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (userRole === "band_member" || userRole === "artist") {
        // Performer: tracking window starts 90 min (1.5 hr) before earliest time
        const { data: gigMembers, error } = await supabase
          .from("gig_members")
          .select(`
            gig_id,
            location_sharing_enabled,
            gigs!inner (
              id,
              user_id,
              date,
              venue,
              venue_name,
              venue_lat,
              venue_lng,
              loading_time,
              sound_check_time
            )
          `)
          .eq("member_id", userId)
          .eq("status", "accepted");

        if (error) throw error;

        const gigsWithinWindow = (gigMembers || []).filter((gm: any) => {
          const gig = gm.gigs;
          const gigDate = parseISO(gig.date);
          let earliestTime = gigDate;
          if (gig.loading_time) {
            const [hours, minutes] = gig.loading_time.split(':').map(Number);
            earliestTime = new Date(gigDate);
            earliestTime.setHours(hours, minutes, 0, 0);
          } else if (gig.sound_check_time) {
            const [hours, minutes] = gig.sound_check_time.split(':').map(Number);
            earliestTime = new Date(gigDate);
            earliestTime.setHours(hours, minutes, 0, 0);
          }
          const minutesUntil = differenceInMinutes(earliestTime, now);
          // Show from 90 min before until 2 hours after start
          return minutesUntil > -120 && minutesUntil <= 90;
        }).map((gm: any) => ({
          id: gm.gigs.id,
          date: gm.gigs.date,
          venue: gm.gigs.venue,
          venue_name: gm.gigs.venue_name,
          venue_lat: gm.gigs.venue_lat,
          venue_lng: gm.gigs.venue_lng,
          loading_time: gm.gigs.loading_time,
          sound_check_time: gm.gigs.sound_check_time,
          location_sharing_enabled: gm.location_sharing_enabled || false,
          gig_owner_id: gm.gigs.user_id,
        }));

        setUpcomingGigs(gigsWithinWindow);
      } else if (userRole === "band_leader" || userRole === "booking_manager" || userRole === "tour_manager") {
        // Manager: visibility starts 1 hr before driver leaves = 150 min before event
        // Collect owner IDs: the manager themselves + any managed artists/bands
        const ownerIds = new Set<string>([userId]);

        if (userRole === "booking_manager") {
          const [{ data: mgrArtists }, { data: mgrBands }] = await Promise.all([
            supabase
              .from("booking_manager_artists")
              .select("artist_id")
              .eq("booking_manager_id", userId),
            supabase
              .from("booking_manager_bands")
              .select("band_id")
              .eq("booking_manager_id", userId),
          ]);
          (mgrArtists || []).forEach((r: any) => r.artist_id && ownerIds.add(r.artist_id));
          (mgrBands || []).forEach((r: any) => r.band_id && ownerIds.add(r.band_id));
        }

        const { data: gigs, error } = await supabase
          .from("gigs")
          .select("*")
          .in("user_id", Array.from(ownerIds));

        if (error) throw error;

        const { data: bookingRequests } = await supabase
          .from("booking_requests")
          .select("id, performer_id, event_date, dates_text, venue, status")
          .eq("booker_id", userId)
          .eq("status", "accepted");

        const requestGigs = (bookingRequests || []).map((request: any) => {
          const rawVenue = request.venue || "";
          const separator = rawVenue.includes(" — ") ? " — " : rawVenue.includes(" - ") ? " - " : null;
          const [venueName, venueAddress] = separator ? rawVenue.split(separator, 2) : [null, rawVenue];

          return {
            id: request.id,
            user_id: request.performer_id,
            date: request.event_date || request.dates_text,
            venue: venueAddress || rawVenue,
            venue_name: venueName,
            venue_lat: null,
            venue_lng: null,
            loading_time: null,
            sound_check_time: null,
          };
        }).filter((gig: any) => Boolean(gig.date));

        const gigsWithinWindow = [...(gigs || []), ...requestGigs].filter((gig: any) => {
          const gigDate = parseISO(gig.date);
          let earliestTime = gigDate;
          if (gig.loading_time) {
            const [hours, minutes] = gig.loading_time.split(':').map(Number);
            earliestTime = new Date(gigDate);
            earliestTime.setHours(hours, minutes, 0, 0);
          } else if (gig.sound_check_time) {
            const [hours, minutes] = gig.sound_check_time.split(':').map(Number);
            earliestTime = new Date(gigDate);
            earliestTime.setHours(hours, minutes, 0, 0);
          }
          const minutesUntil = differenceInMinutes(earliestTime, now);
          const isGigToday = isToday(gigDate) || isToday(earliestTime);
          return isGigToday || (minutesUntil > -120 && minutesUntil <= 150);
        }).map((gig: any) => ({
          id: gig.id,
          date: gig.date,
          venue: gig.venue,
          venue_name: gig.venue_name,
          venue_lat: gig.venue_lat,
          venue_lng: gig.venue_lng,
          loading_time: gig.loading_time,
          sound_check_time: gig.sound_check_time,
          location_sharing_enabled: true,
          gig_owner_id: gig.user_id,
        }));

        setUpcomingGigs(gigsWithinWindow);
      }
    } catch (error) {
      console.error("Error fetching upcoming gigs:", error);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (lat: number, lng: number, name?: string) => {
    const query = name ? encodeURIComponent(name) : `${lat},${lng}`;
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const openVenueInMaps = (gig: UpcomingGig) => {
    if (gig.venue_lat != null && gig.venue_lng != null) {
      openInMaps(gig.venue_lat, gig.venue_lng, gig.venue_name || gig.venue);
      return;
    }

    const query = encodeURIComponent(gig.venue_name || gig.venue);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const getTimeUntilGig = (gig: UpcomingGig) => {
    const now = new Date();
    const gigDate = parseISO(gig.date);
    
    // Get the earliest time for the gig
    let earliestTime = gigDate;
    if (gig.loading_time) {
      const [hours, minutes] = gig.loading_time.split(':').map(Number);
      earliestTime = new Date(gigDate);
      earliestTime.setHours(hours, minutes, 0, 0);
    } else if (gig.sound_check_time) {
      const [hours, minutes] = gig.sound_check_time.split(':').map(Number);
      earliestTime = new Date(gigDate);
      earliestTime.setHours(hours, minutes, 0, 0);
    }
    
    const minutesUntil = differenceInMinutes(earliestTime, now);
    
    if (minutesUntil < 0) {
      return { text: "In progress", urgent: true, started: true };
    } else if (minutesUntil <= 15) {
      return { text: `${minutesUntil} min`, urgent: true, started: false };
    } else if (minutesUntil <= 60) {
      return { text: `${minutesUntil} min`, urgent: false, started: false };
    } else {
      return { text: format(earliestTime, "h:mm a"), urgent: false, started: false };
    }
  };

  if (loading || upcomingGigs.length === 0) {
    return null;
  }

  const isMember = userRole === "band_member" || userRole === "artist";

  return (
    <div className="space-y-3">
      {/* Auto Location Tracker for band members */}
      {isMember && upcomingGigs.some(g => g.location_sharing_enabled) && (
        <AutoLocationTracker
          userId={userId}
          isEnabled={upcomingGigs.some(g => g.location_sharing_enabled)}
          venues={upcomingGigs
            .filter(g => g.location_sharing_enabled && g.venue_lat != null && g.venue_lng != null)
            .map(g => ({
              gigId: g.id,
              gigOwnerId: g.gig_owner_id ?? null,
              venueLat: g.venue_lat as number,
              venueLng: g.venue_lng as number,
              venueName: g.venue_name ?? g.venue,
            }))}
        />
      )}

      {upcomingGigs.map((gig) => {
        const timeInfo = getTimeUntilGig(gig);
        
        return (
          <Card 
            key={gig.id} 
            className={`border-2 ${
              timeInfo.urgent 
                ? 'border-destructive/50 bg-destructive/5 animate-pulse-subtle' 
                : 'border-primary/50 bg-primary/5'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-full ${
                    timeInfo.urgent ? 'bg-destructive/20' : 'bg-primary/20'
                  }`}>
                    {timeInfo.started ? (
                      <Navigation className={`h-5 w-5 ${
                        timeInfo.urgent ? 'text-destructive' : 'text-primary'
                      }`} />
                    ) : (
                      <AlertCircle className={`h-5 w-5 ${
                        timeInfo.urgent ? 'text-destructive' : 'text-primary'
                      }`} />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">
                        {gig.venue_name || gig.venue}
                      </h3>
                      <Badge 
                        variant={timeInfo.urgent ? "destructive" : "default"}
                        className="text-xs"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {timeInfo.text}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{gig.venue}</span>
                      {gig.location_sharing_enabled && isMember && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          <Navigation className="h-2.5 w-2.5 mr-0.5" />
                          Tracking
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {(() => {
                  const myRow = (travelByGig[gig.id] || []).find((r) => r.user_id === userId);
                  const myStatus: TravelStatus = myRow?.status || "not_started";
                  return (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button
                        size="sm"
                        variant={timeInfo.urgent ? "destructive" : "default"}
                        onClick={async () => {
                          updateTravelStatus(gig, "in_transit");
                          openVenueInMaps(gig);
                          if (isMember) {
                            const granted = await requestLocationPermission();
                            setNeedsPermission((p) => ({ ...p, [gig.id]: !granted }));
                          }
                        }}
                        className="gap-1.5"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {myStatus === "in_transit" ? "Re-open Maps" : "Navigate"}
                        </span>
                      </Button>
                      {myStatus === "in_transit" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateTravelStatus(gig, "arrived")}
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="hidden sm:inline">I've arrived</span>
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Permission nudge — performer tapped Navigate but we don't have GPS yet */}
              {isMember && needsPermission[gig.id] && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 text-muted-foreground">
                    Share your location so your team can see your progress.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={async () => {
                      const granted = await requestLocationPermission();
                      setNeedsPermission((p) => ({ ...p, [gig.id]: !granted }));
                    }}
                  >
                    Enable
                  </Button>
                  <button
                    onClick={() => setNeedsPermission((p) => ({ ...p, [gig.id]: false }))}
                    className="p-0.5 hover:bg-accent rounded transition-colors"
                    aria-label="Dismiss"
                  >
                    <span className="text-muted-foreground text-base leading-none">×</span>
                  </button>
                </div>
              )}

              {/* Travel progress for everyone on the gig */}
              {(travelByGig[gig.id]?.length ?? 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
                  {travelByGig[gig.id]!.map((row) => {
                    const name = row.profile?.name || (row.user_id === userId ? "You" : "Someone");
                    const isArrived = row.status === "arrived";
                    const loc = locByUser[row.user_id];
                    const hasVenue = gig.venue_lat != null && gig.venue_lng != null;
                    const key = `${gig.id}:${row.user_id}`;

                    let progress = 0;
                    let distKm: number | null = null;
                    if (isArrived) {
                      progress = 1;
                      distKm = 0;
                    } else if (row.status === "in_transit" && hasVenue && loc) {
                      const d = distanceMeters(loc.lat, loc.lng, gig.venue_lat!, gig.venue_lng!);
                      distKm = d / 1000;
                      // Capture starting distance the first time we see this user in transit
                      if (startDistRef.current[key] == null || d > startDistRef.current[key]) {
                        startDistRef.current[key] = d;
                      }
                      const start = startDistRef.current[key] || d;
                      progress = start > 0 ? 1 - d / start : 0;
                      // If within 150m, treat as essentially arrived visually
                      if (d <= 150) progress = 0.98;
                    }

                    return (
                      <TravelProgress
                        key={row.user_id}
                        name={name}
                        progress={progress}
                        distanceKm={distKm}
                        arrived={isArrived}
                      />
                    );
                  })}
                </div>
              )}

              {/* Show member location map for band leaders */}
              {!isMember && timeInfo.started && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => window.location.href = `/bookings?gig=${gig.id}`}
                  >
                    <Navigation className="h-4 w-4" />
                    View Member Locations
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
