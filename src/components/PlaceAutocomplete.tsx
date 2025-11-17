import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useMapsLoader } from "@/hooks/useMapsLoader";

const libraries: ("places")[] = ["places"];

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string, placeDetails?: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
  disableAutocomplete?: boolean;
}

export const PlaceAutocomplete = ({
  value,
  onChange,
  placeholder,
  className,
  disableAutocomplete,
}: PlaceAutocompleteProps) => {
  const onChangeRef = useRef(onChange);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [effectiveKey, setEffectiveKey] = useState<string>(apiKey || "");
  const [keyReady, setKeyReady] = useState<boolean>(!!apiKey);

  useEffect(() => {
    if (!apiKey) {
      supabase.functions
        .invoke("gmaps-key")
        .then(({ data, error }) => {
          if (error) {
            console.warn("[PlaceAutocomplete] Failed to fetch Maps API key from backend", error);
            setKeyReady(true);
            return;
          }
          if (data?.apiKey) {
            setEffectiveKey(data.apiKey as string);
            setKeyReady(true);
            console.log("Google Maps API Key status:", "Loaded (via backend)");
          }
        })
        .catch((e) => {
          console.warn("[PlaceAutocomplete] Key fetch error", e);
          setKeyReady(true);
        });
    } else {
      setKeyReady(true);
    }
  }, [apiKey]);

  const { ready: mapsReady, error: mapsErr } = useMapsLoader(keyReady && effectiveKey ? effectiveKey : undefined, libraries);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const initializedRef = useRef(false);
  const [googleBroken, setGoogleBroken] = useState(false);
  // If loader reports an error, fall back to plain input and keep it enabled
  useEffect(() => {
    if (!mapsErr && !googleBroken) return;
    if (inputRef.current) {
      inputRef.current.disabled = false;
      inputRef.current.setAttribute("aria-disabled", "false");
      (inputRef.current as any).readOnly = false;
    }
    setGoogleBroken(true);
  }, [mapsErr, googleBroken]);
  const resolveTextToPlace = async (text: string) => {
    if (!text || !(window as any).google) return;
    try {
      const svc = new google.maps.places.AutocompleteService();
      const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
        svc.getPlacePredictions({ input: text, types: ["establishment", "geocode"] }, (preds) => {
          resolve(preds || []);
        });
      });
      let placeResult: google.maps.places.PlaceResult | null = null;
      if (predictions.length > 0) {
        const placeId = predictions[0].place_id!;
        const ps = new google.maps.places.PlacesService(document.createElement("div"));
        placeResult = await new Promise((resolve) => {
          ps.getDetails(
            { placeId, fields: ["name", "formatted_address", "place_id", "geometry", "vicinity", "address_components"] },
            (res) => resolve(res || null)
          );
        });
      } else {
        // Geocode as last resort
        const geocoder = new google.maps.Geocoder();
        const geocodeRes = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
          geocoder.geocode({ address: text }, (res, status) => {
            resolve(status === "OK" ? res || null : null);
          });
        });
        if (geocodeRes && geocodeRes.length) {
          placeResult = {
            name: text,
            formatted_address: geocodeRes[0].formatted_address,
            geometry: { location: geocodeRes[0].geometry.location } as any,
            place_id: geocodeRes[0].place_id,
          } as google.maps.places.PlaceResult;
        }
      }
      if (placeResult) {
        const name = placeResult.name ?? "";
        const formatted = placeResult.formatted_address ?? "";
        const textOut = formatted || name || text;
        setInputValue(textOut);
        onChangeRef.current(textOut, placeResult);
      }
    } catch (err) {
      console.warn("[PlaceAutocomplete] Fallback resolve failed", err);
    }
  };

  useEffect(() => {
    if (!mapsReady || !inputRef.current || disableAutocomplete || initializedRef.current) return;
    try {
      console.debug("[PlaceAutocomplete] Initializing Google Autocomplete");
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
        fields: [
          "name",
          "formatted_address",
          "place_id",
          "geometry",
          "vicinity",
          "address_components",
        ],
      });
      autocompleteRef.current = autocomplete;
      initializedRef.current = true;
      // Ensure the input stays enabled
      if (inputRef.current) {
        inputRef.current.disabled = false;
        inputRef.current.setAttribute("aria-disabled", "false");
        (inputRef.current as any).readOnly = false;
      }

      // Prevent Enter key from submitting a surrounding form; if no Google selection, try fallback
      const keydownHandler = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const typed = (inputRef.current?.value || "").trim();
          // Immediately propagate typed text so parents never receive undefined
          setInputValue(typed);
          onChangeRef.current(typed);
          const gp = (autocomplete as any)?.getPlace?.();
          if (!gp || (!gp.place_id && !gp.formatted_address)) {
            // Try to resolve to a full place in the background
            resolveTextToPlace(typed);
          }
        }
      };
      inputRef.current.addEventListener("keydown", keydownHandler);

      const listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        console.debug("[PlaceAutocomplete] place_changed", place);
        if (!place) return;
        const name = place.name ?? "";
        const formatted = place.formatted_address ?? "";
        const description: string = ((place as any)?.description as string | undefined) ?? "";
        const text = formatted || name || description;
        const textOut = text || inputRef.current?.value || "";
        setInputValue(textOut);
        onChangeRef.current(textOut, place);
      });

      return () => {
        if (listener) {
          google.maps.event.removeListener(listener);
        }
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
          autocompleteRef.current = null;
        }
        if (inputRef.current) {
          inputRef.current.disabled = false;
          inputRef.current.setAttribute("aria-disabled", "false");
          (inputRef.current as any).readOnly = false;
          inputRef.current.removeEventListener("keydown", keydownHandler);
        }
        initializedRef.current = false;
      };
    } catch (e) {
      console.warn("[PlaceAutocomplete] Autocomplete init error:", e);
      setGoogleBroken(true);
      if (inputRef.current) {
        inputRef.current.disabled = false;
        inputRef.current.setAttribute("aria-disabled", "false");
        (inputRef.current as any).readOnly = false;
      }
    }
  }, [mapsReady, disableAutocomplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChangeRef.current(newValue);
  };

  // Always render a single input to preserve focus while Maps loads/errors
  if (!keyReady || !effectiveKey || !mapsReady || disableAutocomplete || googleBroken) {
    return (
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder ?? "Search venue"}
        className={className}
        autoComplete="off"
      />
    );
  }

  // Maps ready + autocomplete active
  return (
    <Input
      ref={inputRef}
      value={inputValue}
      onChange={handleInputChange}
      placeholder={placeholder ?? "Search venue"}
      className={className}
      autoComplete="off"
    />
  );
};
