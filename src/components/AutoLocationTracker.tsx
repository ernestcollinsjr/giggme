import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MapPin, AlertCircle } from "lucide-react";

interface AutoLocationTrackerProps {
  userId: string;
  isEnabled: boolean;
}

export const AutoLocationTracker = ({ userId, isEnabled }: AutoLocationTrackerProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

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
        startTracking();
      } catch (error: any) {
        console.error("Geolocation permission error:", error);
        if (error.code === 1) { // PERMISSION_DENIED
          setPermissionDenied(true);
          setIsTracking(false);
          toast({
            variant: "destructive",
            title: "Location permission needed",
            description: "Please click 'Allow' when your browser asks for location access, then try again.",
          });
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
            
            console.log("Location auto-updated:", position.coords.latitude, position.coords.longitude);
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

  const handleRetryPermission = () => {
    setPermissionDenied(false);
    // Trigger permission request by reloading the component
    window.location.reload();
  };

  if (permissionDenied) {
    return (
      <div className="fixed bottom-20 right-4 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg max-w-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm mb-1">Location Access Blocked</p>
            <p className="text-xs mb-3 opacity-90">
              To share your location, click the location icon in your browser's address bar and allow location access.
            </p>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={handleRetryPermission}
              className="w-full"
            >
              <MapPin className="h-3 w-3 mr-2" />
              Retry After Enabling
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isTracking) return null;

  return (
    <div className="fixed bottom-20 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
      <div className="w-2 h-2 bg-green-400 rounded-full" />
      <span className="text-sm">Location tracking active</span>
    </div>
  );
};