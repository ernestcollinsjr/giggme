import { supabase } from "@/integrations/supabase/client";

/**
 * Waits for an authenticated session, retrying briefly to avoid a race
 * condition on fresh page loads where getSession() can return null before
 * the session is restored from storage / refreshed.
 *
 * Returns the user if authenticated, or null after timing out.
 */
export async function waitForUser(timeoutMs = 2500) {
  // Try immediate read first
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  // Otherwise wait for onAuthStateChange to fire (INITIAL_SESSION/SIGNED_IN/TOKEN_REFRESHED)
  return new Promise<any>((resolve) => {
    let resolved = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user && !resolved) {
        resolved = true;
        subscription.unsubscribe();
        resolve(s.user);
      }
    });

    setTimeout(async () => {
      if (resolved) return;
      // One last check before giving up
      const { data: { session: finalSession } } = await supabase.auth.getSession();
      resolved = true;
      subscription.unsubscribe();
      resolve(finalSession?.user ?? null);
    }, timeoutMs);
  });
}
