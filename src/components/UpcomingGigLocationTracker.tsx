import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Navigation, AlertCircle, ExternalLink } from "lucide-react";
import { format, parseISO, differenceInMinutes, isToday } from "date-fns";
import { AutoLocationTracker } from "./AutoLocationTracker";

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

  useEffect(() => {
    fetchUpcomingGigs();
    
    // Check every minute for updates
    const interval = setInterval(fetchUpcomingGigs, 60000);
    
    return () => clearInterval(interval);
  }, [userId, userRole]);

  const fetchUpcomingGigs = async () => {
    try {
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

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
        const { data: gigs, error } = await supabase
          .from("gigs")
          .select("*")
          .eq("user_id", userId);

        if (error) throw error;

        const gigsWithinWindow = (gigs || []).filter((gig: any) => {
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
          return minutesUntil > -120 && minutesUntil <= 150;
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
                
                {gig.venue_lat && gig.venue_lng && (
                  <Button
                    size="sm"
                    variant={timeInfo.urgent ? "destructive" : "default"}
                    onClick={() => openInMaps(gig.venue_lat!, gig.venue_lng!, gig.venue_name || gig.venue)}
                    className="gap-1.5 flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="hidden sm:inline">Navigate</span>
                  </Button>
                )}
              </div>

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
