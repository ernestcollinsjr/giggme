import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { normalizeRole, type ActiveRole } from "@/lib/roles";
import { usePushSoundListener } from "@/hooks/usePushSoundListener";

/**
 * Persistent layout: renders the desktop sidebar/topbar shell once and keeps it
 * mounted across route changes via <Outlet />. Per-page <AppShell> wrappers
 * detect the parent and become passthrough.
 */
export default function AppLayout() {
  const [role, setRole] = useState<ActiveRole | null>(null);

  useEffect(() => {
    let active = true;

    const loadRole = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!active) return;
      // Pick the highest-privilege role available
      const priority: ActiveRole[] = [
        "super_admin",
        "booking_manager",
        "admin",
        "entertainer",
        "member",
      ];
      const roles = (data || [])
        .map((r: any) => normalizeRole(r.role))
        .filter(Boolean) as ActiveRole[];
      const best = priority.find((p) => roles.includes(p)) ?? null;
      setRole(best);
    };

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) loadRole(user.id);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadRole(session.user.id);
      else setRole(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AppShell userRole={role}>
      <Outlet />
    </AppShell>
  );
}
