/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onPlaceSelect?: (result: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  name?: string;
  id?: string;
  defaultValue?: string;
  "data-testid"?: string;
}

let googleMapsScriptLoaded = false;
let googleMapsScriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (googleMapsScriptLoaded && (window as any).google?.maps?.places) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);

    if (googleMapsScriptLoading) return;
    googleMapsScriptLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsScriptLoaded = true;
      googleMapsScriptLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleMapsScriptLoading = false;
      console.error("Failed to load Google Maps script");
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address...",
  className,
  name,
  id,
  defaultValue,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue || "");

  const displayValue = value !== undefined ? value : internalValue;

  const { data: mapsConfig } = useQuery<{ key: string }>({
    queryKey: ["/api/config/maps-key"],
  });

  useEffect(() => {
    if (!mapsConfig?.key) return;

    loadGoogleMapsScript(mapsConfig.key).then(() => {
      setIsReady(true);
    });
  }, [mapsConfig?.key]);

  const initAutocomplete = useCallback(() => {
    if (!isReady || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "geometry"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        const result: PlaceResult = {
          address: place.formatted_address,
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        };

        if (value === undefined) {
          setInternalValue(result.address);
        }
        onChange?.(result.address);
        onPlaceSelect?.(result);
      }
    });

    autocompleteRef.current = autocomplete;
  }, [isReady, onChange, onPlaceSelect, value]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  useEffect(() => {
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (value === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);
  };

  return (
    <div className="relative">
      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn("pl-8", className)}
        name={name}
        id={id}
        autoComplete="off"
        data-testid={testId}
      />
      {!isReady && mapsConfig?.key && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
      )}
    </div>
  );
}
