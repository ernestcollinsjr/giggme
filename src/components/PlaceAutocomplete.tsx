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
  const [keyReady, setKeyReady] = useState<boolean>(!!apiKey);

  useEffect(() => {
    if (!apiKey) {
      supabase.functions
        .invoke("gmaps-key")
        .then(({ data, error }) => {
          if (error) {
            console.warn("[PlaceAutocomplete] Failed to fetch Maps API key from backend", error);
            setKeyReady(true); // Proceed anyway to show error
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
          setKeyReady(true); // Proceed anyway
        });
    } else {
      setKeyReady(true);
    }
  }, [apiKey]);
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: keyReady && effectiveKey ? effectiveKey : undefined,
    libraries,
    id: 'google-maps-script',
  });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

useEffect(() => {
    if (!isLoaded || !inputRef.current || disableAutocomplete) return;

    try {
      // Initialize autocomplete
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["establishment", "geocode"],
        fields: ["name", "formatted_address", "place_id", "geometry", "vicinity", "address_components"],
      });
      autocompleteRef.current = autocomplete;

      // Listen for place selection
      const listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place) return;
        
        const name = place.name ?? "";
        const formatted = place.formatted_address ?? "";
        const description: string = ((place as any)?.description as string | undefined) ?? "";
        const text = formatted || name || description;

        if (text) {
          setInputValue(text);
          onChangeRef.current(text, place);
        }
      });

      return () => {
        if (listener) {
          google.maps.event.removeListener(listener);
        }
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(inputRef.current!);
        }
      };
    } catch (e) {
      console.warn("[PlaceAutocomplete] Autocomplete disabled due to error:", e);
    }
  }, [isLoaded, disableAutocomplete]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChangeRef.current(newValue);
  };

  // Always render a single input to preserve focus while Maps loads/errors
  // But only enable autocomplete once we have a valid key
  if (!keyReady || !effectiveKey) {
    return (
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Loading Maps..."
        className={className}
        autoComplete="off"
      />
    );
  }

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
