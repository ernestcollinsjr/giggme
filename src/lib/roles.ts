// Centralized role model.
//
// The app has 4 active roles. The DB enum keeps legacy values for backwards
// compatibility, but assignments and most checks should use ActiveRole.
import type { Database } from "@/integrations/supabase/types";

/** Every value the DB enum can return (includes legacy). */
export type AppRole = Database["public"]["Enums"]["app_role"];

/** The 5 roles actually used going forward. */
export type ActiveRole =
  | "super_admin"
  | "booking_manager"
  | "admin"
  | "entertainer"
  | "member";

export const ACTIVE_ROLES: ActiveRole[] = [
  "super_admin",
  "booking_manager",
  "admin",
  "entertainer",
  "member",
];

/** Map any (possibly-legacy) DB role to one of the active roles. */
export function normalizeRole(raw: AppRole | string | null | undefined): ActiveRole | null {
  if (!raw) return null;
  switch (raw) {
    case "super_admin":
    case "booking_manager":
    case "admin":
    case "entertainer":
    case "member":
      return raw;
    case "band_leader":
    case "venue_owner":
      return "booking_manager";
    case "band_member":
      return "member";
    case "artist":
    case "tour_manager":
      return "entertainer";
    default:
      return null;
  }
}

export const ROLE_LABELS: Record<ActiveRole, string> = {
  super_admin: "Super Admin",
  booking_manager: "Booking Manager",
  admin: "Admin",
  entertainer: "Entertainer",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<ActiveRole, string> = {
  super_admin: "Full control over the entire site and all users.",
  booking_manager:
    "Runs a roster of entertainers, books gigs, manages the workspace.",
  admin:
    "Granted by a Booking Manager to help manage their roster. Can edit, cannot delete the manager's account.",
  entertainer:
    "Subscription-based performer profile. Visible in public Discover.",
  member:
    "Invited by a Booking Manager into a named group. Sees their gigs/messages and edits their own profile. No subscription required, not listed publicly.",
};
