import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X } from "lucide-react";

interface AutoLocationTrackerProps {
  userId: string;
  isEnabled: boolean;
}

export const AutoLocationTracker = ({ userId, isEnabled }: AutoLocationTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isEnabled || !navigator.geolocation) return;

    let watchId: number;

    const requestPermission = async () => {
      try {
        // First, try to get current position to trigger permission request
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        
        // Permission granted, start tracking
        setPermissionDenied(false);
        setIsDismissed(false);
        startTracking();
      } catch (error: any) {
        console.error("Geolocation permission error:", error);
        if (error.code === 1) { // PERMISSION_DENIED
          setPermissionDenied(true);
          setIsTracking(false);
        }
      }
    };

    const startTracking = () => {
      setIsTracking(true);
      
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          try {
            await supabase
              .from("profiles")
              .update({
                location_lat: position.coords.latitude,
                location_lng: position.coords.longitude,
              })
              .eq("id", userId);
            
            if (import.meta.env.DEV) console.log("Location auto-updated");
          } catch (error) {
            console.error("Failed to update location:", error);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionDenied(true);
            setIsTracking(false);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 60000, // Update every minute
        }
      );
    };

    requestPermission();

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setIsTracking(false);
      }
    };
  }, [userId, isEnabled]);

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