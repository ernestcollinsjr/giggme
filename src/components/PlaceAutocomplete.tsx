import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useLoadScript } from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [effectiveKey, setEffectiveKey] = useState<string>(apiKey || "");

  useEffect(() => {
    if (!apiKey) {
      supabase.functions
        .invoke("gmaps-key")
        .then(({ data, error }) => {
          if (error) {
            console.warn("[PlaceAutocomplete] Failed to fetch Maps API key from backend", error);
            return;
          }
          if (data?.apiKey) {
            setEffectiveKey(data.apiKey as string);
            console.log("Google Maps API Key status:", "Loaded (via backend)");
          }
        })
        .catch((e) => console.warn("[PlaceAutocomplete] Key fetch error", e));
    }
  }, [apiKey]);
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: effectiveKey || "",
    libraries,
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

useEffect(() => {
    if (!isLoaded || !inputRef.current || disableAutocomplete) return;

    try {
      // Initialize autocomplete
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
        fields: ["name", "formatted_address", "place_id", "geometry"],
      });

      // Listen for place selection
      const listener = autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (place && place.name) {
          const placeName = place.name;
          const address = place.formatted_address;
          const fullText = address ? `${placeName}, ${address}` : placeName;
          
          setInputValue(fullText);
          onChangeRef.current(fullText, place);
        }
      });

      return () => {
        if (listener) {
          google.maps.event.removeListener(listener);
        }
      };
    } catch (e) {
      // If initialization fails (e.g., key restrictions), fall back to plain input
      console.warn("[PlaceAutocomplete] Autocomplete disabled due to error:", e);
    }
  }, [isLoaded, disableAutocomplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChangeRef.current(newValue);
  };

  // Always render a single input to preserve focus while Maps loads/errors
  return (
    <Input
      ref={inputRef}
      value={inputValue}
      onChange={handleInputChange}
      placeholder={isLoaded ? placeholder : loadError ? placeholder : "Loading venue..."}
      className={className}
      autoComplete="off"
    />
  );
};
