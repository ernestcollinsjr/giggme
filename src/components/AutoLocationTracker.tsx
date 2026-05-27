import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X, CheckCircle2 } from "lucide-react";

interface VenueTarget {
  gigId: string;
  gigOwnerId?: string | null;
  venueLat: number;
  venueLng: number;
  venueName?: string | null;
}

interface AutoLocationTrackerProps {
  userId: string;
  isEnabled: boolean;
  /** Optional venue targets — when the user gets within ~150m, sharing turns off and the gig owner is notified. */
  venues?: VenueTarget[];
}

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

const ARRIVAL_RADIUS_METERS = 150;

export const AutoLocationTracker = ({ userId, isEnabled, venues = [] }: AutoLocationTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const arrivedGigsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isEnabled || !navigator.geolocation) return;

    let watchId: number;

    const handleArrival = async (venue: VenueTarget) => {
      if (arrivedGigsRef.current.has(venue.gigId)) return;
      arrivedGigsRef.current.add(venue.gigId);

      try {
        // Turn off sharing for this gig member
        await supabase
          .from("gig_members")
          .update({ location_sharing_enabled: false })
          .eq("gig_id", venue.gigId)
          .eq("member_id", userId);

        // Notify the gig owner (manager / band leader)
        if (venue.gigOwnerId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", userId)
            .maybeSingle();

          await supabase.from("notifications").insert({
            user_id: venue.gigOwnerId,
            type: "arrival",
            title: "Performer arrived",
            message: `${profile?.name ?? "Performer"} has arrived at ${venue.venueName ?? "the venue"}.`,
            related_id: venue.gigId,
          });
        }

        setArrivedAt(venue.venueName ?? "the venue");
      } catch (err) {
        console.error("Failed to record arrival:", err);
      }
    };

    const requestPermission = async () => {
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        setPermissionDenied(false);
        setIsDismissed(false);
        startTracking();
      } catch (error: any) {
        console.error("Geolocation permission error:", error);
        if (error.code === 1) {
          setPermissionDenied(true);
          setIsTracking(false);
        }
      }
    };

    const startTracking = () => {
      setIsTracking(true);

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await supabase
              .from("profiles")
              .update({ location_lat: latitude, location_lng: longitude })
              .eq("id", userId);
          } catch (error) {
            console.error("Failed to update location:", error);
          }

          // Arrival check
          for (const v of venues) {
            if (arrivedGigsRef.current.has(v.gigId)) continue;
            const d = distanceMeters(latitude, longitude, v.venueLat, v.venueLng);
            if (d <= ARRIVAL_RADIUS_METERS) {
              await handleArrival(v);
            }
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionDenied(true);
            setIsTracking(false);
          }
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
      );
    };

    requestPermission();

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setIsTracking(false);
      }
    };
  }, [userId, isEnabled, JSON.stringify(venues.map(v => v.gigId))]);

  if (arrivedAt) {
    return (
      <div className="fixed bottom-20 right-4 bg-primary/90 backdrop-blur-sm text-primary-foreground px-3 py-2 rounded-lg shadow-md flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4" />
        <span>Arrived at {arrivedAt} — tracking off</span>
      </div>
    );
  }

  if (permissionDenied && !isDismissed) {
    return (
      <div className="fixed bottom-20 right-4 bg-muted/95 backdrop-blur-sm text-foreground px-3 py-2 rounded-lg shadow-md max-w-xs border border-border flex items-center gap-2 text-sm animate-in slide-in-from-right-5">
        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1">Location access needed for sharing</span>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-accent rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (!isTracking) return null;

  return (
    <div className="fixed bottom-20 right-4 bg-primary/90 backdrop-blur-sm text-primary-foreground px-3 py-1.5 rounded-full shadow-md flex items-center gap-2 text-sm">
      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
      <span>Tracking location</span>
    </div>
  );
};
