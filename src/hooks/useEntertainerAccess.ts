import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EntertainerAccess {
  loading: boolean;
  isEntertainer: boolean;
  isSubscribed: boolean;
  hasAccess: boolean;
}

/**
 * Returns whether the current user is an entertainer with an active subscription.
 * Non-entertainers always have access (hasAccess === true). Entertainers must be
 * subscribed (status='active' and not expired) to have access.
 */
export const useEntertainerAccess = (): EntertainerAccess => {
  const [state, setState] = useState<EntertainerAccess>({
    loading: true,
    isEntertainer: false,
    isSubscribed: false,
    hasAccess: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setState({ loading: false, isEntertainer: false, isSubscribed: false, hasAccess: false });
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleSet = new Set((roles ?? []).map((r) => r.role as string));
      // Only "entertainer" requires a paid subscription. Members (BM-invited
      // roster users), artists, tour_managers, etc. are not gated here.
      const isEntertainer = roleSet.has("entertainer");

      // Non-entertainers (BMs, admins, super_admins) bypass the gate.
      if (!isEntertainer) {
        if (!cancelled) setState({ loading: false, isEntertainer: false, isSubscribed: false, hasAccess: true });
        return;
      }

      const { data: sub } = await supabase
        .from("entertainer_subscribers")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      const active = !!sub
        && sub.status === "active"
        && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());

      if (!cancelled) {
        setState({
          loading: false,
          isEntertainer: true,
          isSubscribed: active,
          hasAccess: active,
        });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
};
