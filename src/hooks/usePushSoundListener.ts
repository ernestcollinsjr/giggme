import { useEffect } from "react";
import { useSoundPreference, SoundType } from "@/hooks/useSoundPreference";

/**
 * Listens for PUSH_SOUND messages dispatched from the service worker (sw.js)
 * when a web push arrives, and plays the user's chosen sound while the app
 * is open. Background pushes use the OS notification sound (browser-controlled).
 * Native iOS/Android use the sound field in the APNs/FCM payload directly.
 */
export const usePushSoundListener = () => {
  const { playTestSound, isMuted } = useSoundPreference();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "PUSH_SOUND") return;
      if (isMuted) return;
      const sound = data.sound as SoundType | undefined;
      playTestSound(sound);
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [playTestSound, isMuted]);
};
