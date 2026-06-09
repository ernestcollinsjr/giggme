// Native (Capacitor) geofencing for venue arrival.
//
// Uses @capacitor-community/background-geolocation to keep a low-power
// location stream alive while the app is backgrounded, and fires a local
// notification + DB-side arrival event when the user enters a venue's
// arrival radius. On the web (no Capacitor) this is a no-op — the in-app
// AutoLocationTracker handles foreground arrival there.

import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export interface GeofenceVenue {
  gigId: string;
  gigOwnerId?: string | null;
  venueLat: number;
  venueLng: number;
  venueName?: string | null;
}

const ARRIVAL_RADIUS_METERS = 150;

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

let watcherId: string | null = null;
const arrived = new Set<string>();

async function notifyArrival(userId: string, venue: GeofenceVenue) {
  if (arrived.has(venue.gigId)) return;
  arrived.add(venue.gigId);

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 1_000_000),
          title: "You've arrived",
          body: `You're at ${venue.venueName ?? "the venue"}. Tracking is turning off.`,
          smallIcon: "ic_stat_icon_config_sample",
        },
      ],
    });
  } catch (err) {
    console.warn("[geofence] local notification failed", err);
  }

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
  } catch (err) {
    console.error("[geofence] arrival update failed", err);
  }
}

export function isNativeGeofenceSupported() {
  return Capacitor.isNativePlatform();
}

export async function startVenueGeofencing(userId: string, venues: GeofenceVenue[]) {
  if (!isNativeGeofenceSupported()) return;
  await stopVenueGeofencing();
  if (venues.length === 0) return;

  // Reset arrival set for the new set of venues
  arrived.clear();

  const { BackgroundGeolocation } = await import(
    "@capacitor-community/background-geolocation"
  );

  watcherId = await BackgroundGeolocation.addWatcher(
    {
      // Shown in the persistent Android foreground-service notification
      backgroundMessage: "Tracking your trip to the venue",
      backgroundTitle: "GigGme is keeping an eye on your arrival",
      requestPermissions: true,
      // We want fairly accurate fixes near the venue; OS will throttle as needed
      distanceFilter: 50,
    },
    async (location, error) => {
      if (error) {
        if (error.code === "NOT_AUTHORIZED") {
          console.warn("[geofence] permission denied");
        } else {
          console.warn("[geofence] watcher error", error);
        }
        return;
      }
      if (!location) return;

      // Light DB ping so the manager map stays roughly fresh
      try {
        await supabase
          .from("profiles")
          .update({
            location_lat: location.latitude,
            location_lng: location.longitude,
          })
          .eq("id", userId);
      } catch {
        /* ignore */
      }

      for (const v of venues) {
        if (arrived.has(v.gigId)) continue;
        const d = distanceMeters(
          location.latitude,
          location.longitude,
          v.venueLat,
          v.venueLng,
        );
        if (d <= ARRIVAL_RADIUS_METERS) {
          await notifyArrival(userId, v);
        }
      }
    },
  );
}

export async function stopVenueGeofencing() {
  if (!watcherId) return;
  try {
    const { BackgroundGeolocation } = await import(
      "@capacitor-community/background-geolocation"
    );
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
  } catch {
    /* ignore */
  }
  watcherId = null;
}
