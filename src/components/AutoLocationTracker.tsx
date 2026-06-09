import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X, CheckCircle2 } from "lucide-react";
import {
  isNativeGeofenceSupported,
  startVenueGeofencing,
  stopVenueGeofencing,
} from "@/lib/venueGeofence";

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
// Battery-friendly ping cadence. We poll on an interval instead of
// watchPosition (which fires on every sensor update and drains battery).
const PING_INTERVAL_FAR_MS = 4 * 60 * 1000;   // 4 min when far from venue
const PING_INTERVAL_NEAR_MS = 30 * 1000;      // 30s when within geofence radius
const GEOFENCE_RADIUS_METERS = 2000;          // switch to fast pings within 2km

export const AutoLocationTracker = ({ userId, isEnabled, venues = [] }: AutoLocationTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const arrivedGigsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isEnabled || !navigator.geolocation) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let lastNear = false;

    const handleArrival = async (venue: VenueTarget) => {
      if (arrivedGigsRef.current.has(venue.gigId)) return;
      arrivedGigsRef.current.add(venue.gigId);

      try {
        await supabase
          .from("gig_members")
          .update({ location_sharing_enabled: false })
          .eq("gig_id", venue.gigId)
          .eq("member_id", userId);

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

    const getPosition = (highAccuracy: boolean) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: 15000,
          maximumAge: 60000,
        });
      });

    const ping = async () => {
      if (cancelled) return;
      // Pause work entirely when tab is hidden — saves battery & quota.
      if (typeof document !== "undefined" && document.hidden) {
        scheduleNext(PING_INTERVAL_FAR_MS);
        return;
      }
      try {
        // Use high-accuracy only when we're close to a target venue.
        const position = await getPosition(lastNear);
        const { latitude, longitude } = position.coords;

        await supabase
          .from("profiles")
          .update({ location_lat: latitude, location_lng: longitude })
          .eq("id", userId);

        let near = false;
        for (const v of venues) {
          if (arrivedGigsRef.current.has(v.gigId)) continue;
          const d = distanceMeters(latitude, longitude, v.venueLat, v.venueLng);
          if (d <= ARRIVAL_RADIUS_METERS) {
            await handleArrival(v);
          } else if (d <= GEOFENCE_RADIUS_METERS) {
            near = true;
          }
        }
        lastNear = near;
        scheduleNext(near ? PING_INTERVAL_NEAR_MS : PING_INTERVAL_FAR_MS);
      } catch (error: any) {
        if (error?.code === 1) {
          setPermissionDenied(true);
          setIsTracking(false);
          return;
        }
        console.error("Geolocation ping error:", error);
        scheduleNext(PING_INTERVAL_FAR_MS);
      }
    };

    const scheduleNext = (ms: number) => {
      if (cancelled) return;
      timerId = setTimeout(ping, ms);
    };

    const onVisibility = () => {
      if (!document.hidden && !cancelled) {
        // Resume immediately when user returns to the tab.
        if (timerId) clearTimeout(timerId);
        ping();
      }
    };

    const start = async () => {
      try {
        await getPosition(true);
        setPermissionDenied(false);
        setIsDismissed(false);
        setIsTracking(true);
        ping();
        document.addEventListener("visibilitychange", onVisibility);
      } catch (error: any) {
        if (error?.code === 1) {
          setPermissionDenied(true);
          setIsTracking(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisibility);
      setIsTracking(false);
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
