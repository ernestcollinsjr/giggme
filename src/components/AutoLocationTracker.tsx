import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AutoLocationTrackerProps {
  userId: string;
  isEnabled: boolean;
}

export const AutoLocationTracker = ({ userId, isEnabled }: AutoLocationTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!isEnabled || !navigator.geolocation) return;

    let watchId: number;

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
            
            console.log("Location auto-updated:", position.coords.latitude, position.coords.longitude);
          } catch (error) {
            console.error("Failed to update location:", error);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            toast({
              variant: "destructive",
              title: "Location tracking disabled",
              description: "Please enable location access to share your location with the band leader.",
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 60000, // Update every minute
        }
      );
    };

    startTracking();

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setIsTracking(false);
      }
    };
  }, [userId, isEnabled]);

  if (!isTracking) return null;

  return (
    <div className="fixed bottom-20 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
      <div className="w-2 h-2 bg-green-400 rounded-full" />
      <span className="text-sm">Location tracking active</span>
    </div>
  );
};