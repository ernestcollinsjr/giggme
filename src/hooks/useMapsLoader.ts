import { useEffect, useRef, useState } from "react";

// Singleton Google Maps JS loader
let mapsLoadPromise: Promise<void> | null = null;

function injectScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) {
      // Already injected
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.defer = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}

export const useMapsLoader = (apiKey?: string, libraries: string[] = ["places"]) => {
  const [ready, setReady] = useState<boolean>(typeof window !== "undefined" && !!(window as any).google);
  const [error, setError] = useState<Error | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!apiKey || ready || startedRef.current) return;
    startedRef.current = true;

    if (typeof (window as any).google !== "undefined") {
      setReady(true);
      return;
    }

    const params = new URLSearchParams({ key: apiKey, libraries: libraries.join(",") });
    const src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    if (!mapsLoadPromise) {
      mapsLoadPromise = injectScript(src, "google-maps-script");
    }

    mapsLoadPromise
      .then(() => setReady(true))
      .catch((e) => {
        console.warn("[useMapsLoader] Failed to load Google Maps script", e);
        setError(e instanceof Error ? e : new Error("Google Maps failed to load"));
      });
  }, [apiKey, libraries.join(","), ready]);

  return { ready, error } as const;
};
