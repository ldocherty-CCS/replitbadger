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

let loadCallbacks: (() => void)[] = [];
let loadingPromise: Promise<void> | null = null;

function isGoogleMapsLoaded(): boolean {
  return !!(window as any).google?.maps;
}

function hasGoogleMapsScript(): boolean {
  return !!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
}

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (isGoogleMapsLoaded()) {
    return Promise.resolve();
  }

  if (loadingPromise) return loadingPromise;

  if (hasGoogleMapsScript()) {
    loadingPromise = new Promise<void>((resolve) => {
      let attempts = 0;
      const check = () => {
        if (isGoogleMapsLoaded()) {
          loadingPromise = null;
          resolve();
        } else if (attempts++ > 100) {
          loadingPromise = null;
          console.error("Google Maps script found but API never loaded");
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
    return loadingPromise;
  }

  loadingPromise = new Promise<void>((resolve) => {
    loadCallbacks.push(resolve);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      loadingPromise = null;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks = [];
    };
    script.onerror = () => {
      loadingPromise = null;
      console.error("Failed to load Google Maps script");
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks = [];
    };
    document.head.appendChild(script);
  });

  return loadingPromise;
}

export function useGoogleMapsReady() {
  const [isReady, setIsReady] = useState(isGoogleMapsLoaded);
  const { data: mapsConfig } = useQuery<{ key: string }>({
    queryKey: ["/api/config/maps-key"],
  });

  useEffect(() => {
    if (isReady) return;
    if (!mapsConfig?.key) return;
    loadGoogleMapsScript(mapsConfig.key).then(() => {
      setIsReady(true);
    });
  }, [mapsConfig?.key, isReady]);

  return isReady;
}

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue || "");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const selectingRef = useRef(false);

  const displayValue = value !== undefined ? value : internalValue;
  const isReady = useGoogleMapsReady();

  useEffect(() => {
    if (!isReady) return;
    if (!serviceRef.current) {
      serviceRef.current = new google.maps.places.AutocompleteService();
    }
    if (!placesRef.current) {
      const div = document.createElement("div");
      placesRef.current = new google.maps.places.PlacesService(div);
    }
  }, [isReady]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPredictions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    serviceRef.current.getPlacePredictions(
      {
        input,
        types: ["address"],
        componentRestrictions: { country: "us" },
      },
      (results, status) => {
        setIsSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(
            results.map((r) => ({
              placeId: r.place_id,
              description: r.description,
              mainText: r.structured_formatting.main_text,
              secondaryText: r.structured_formatting.secondary_text,
            }))
          );
          setShowDropdown(true);
          setActiveIndex(-1);
        } else {
          setPredictions([]);
          setShowDropdown(false);
        }
      }
    );
  }, []);

  const selectPrediction = useCallback((prediction: Prediction) => {
    selectingRef.current = true;
    setShowDropdown(false);
    setPredictions([]);

    if (!placesRef.current) {
      if (value === undefined) setInternalValue(prediction.description);
      onChange?.(prediction.description);
      selectingRef.current = false;
      return;
    }

    placesRef.current.getDetails(
      { placeId: prediction.placeId, fields: ["formatted_address", "geometry"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const addr = place.formatted_address || prediction.description;
          const result: PlaceResult = {
            address: addr,
            lat: place.geometry?.location?.lat() || 0,
            lng: place.geometry?.location?.lng() || 0,
          };
          if (value === undefined) setInternalValue(result.address);
          onChange?.(result.address);
          onPlaceSelect?.(result);
        } else {
          if (value === undefined) setInternalValue(prediction.description);
          onChange?.(prediction.description);
        }
        selectingRef.current = false;
      }
    );
  }, [value, onChange, onPlaceSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (value === undefined) {
      setInternalValue(val);
    }
    onChange?.(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < predictions.length) {
        selectPrediction(predictions[activeIndex]);
      } else if (predictions.length > 0) {
        selectPrediction(predictions[0]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleFocus = () => {
    if (predictions.length > 0 && !selectingRef.current) {
      setShowDropdown(true);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={cn("pl-8", className)}
        name={name}
        id={id}
        autoComplete="off"
        data-testid={testId}
      />
      {(!isReady || isSearching) && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
      )}

      {showDropdown && predictions.length > 0 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg overflow-hidden"
          data-testid="address-suggestions"
        >
          {predictions.map((p, idx) => (
            <button
              key={p.placeId}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors",
                idx === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted/60"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPrediction(p);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              data-testid={`address-suggestion-${idx}`}
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.mainText}</div>
                <div className="text-xs text-muted-foreground truncate">{p.secondaryText}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
