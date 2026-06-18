import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  searchLocationSuggestions,
  type LocationSuggestion,
} from "@/lib/mapboxGeocoding";
import type { Coordinates } from "@/types";
import { useEffect, useRef, useState } from "react";

interface LocationInputProps {
  id: string;
  label: string;
  value: string;
  coordinates: Coordinates | null;
  accessToken?: string;
  isActive: boolean;
  onActivate: () => void;
  onChange: (value: string) => void;
  onSelectSuggestion: (suggestion: LocationSuggestion) => void;
}

export function LocationInput({
  id,
  label,
  value,
  coordinates,
  accessToken,
  isActive,
  onActivate,
  onChange,
  onSelectSuggestion,
}: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeout = useRef<number | null>(null);
  const canSearch =
    isFocused && Boolean(accessToken) && value.trim().length >= 3;

  useEffect(() => {
    if (!canSearch || !accessToken) {
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsSearching(true);

      searchLocationSuggestions(value, accessToken, controller.signal)
        .then((results) => {
          setSuggestions(results);
          setSearchError("");
          setIsOpen(true);
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          setSuggestions([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Location suggestions are unavailable",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [accessToken, canSearch, value]);

  useEffect(
    () => () => {
      if (blurTimeout.current !== null) {
        window.clearTimeout(blurTimeout.current);
      }
    },
    [],
  );

  const statusText = coordinates
    ? formatCoordinates(coordinates)
    : isActive
      ? "Ready for map pick"
      : "Type to search";
  const showSuggestions =
    canSearch &&
    isOpen &&
    (suggestions.length > 0 || isSearching || Boolean(searchError));

  return (
    <Field>
      <FieldContent>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Badge variant={coordinates ? "default" : "secondary"}>
            {statusText}
          </Badge>
        </div>
      </FieldContent>
      <Popover open={showSuggestions} onOpenChange={(open) => !open && setIsOpen(false)}>
        <PopoverAnchor asChild>
          <Input
            id={id}
            value={value}
            onFocus={() => {
              setIsFocused(true);
              setIsOpen(true);
              onActivate();
            }}
            onBlur={() => {
              blurTimeout.current = window.setTimeout(() => {
                setIsFocused(false);
                setIsOpen(false);
              }, 120);
            }}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange(nextValue);
              if (nextValue.trim().length < 3) {
                setSuggestions([]);
                setIsSearching(false);
                setSearchError("");
              }
              setIsOpen(true);
            }}
            placeholder={label}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={showSuggestions ? "true" : "false"}
            aria-controls={`${id}-suggestions`}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-2rem)] p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <ScrollArea id={`${id}-suggestions`} className="h-64" role="listbox">
            <div className="flex flex-col gap-1">
              {isSearching ? (
                <FieldDescription className="px-3 py-2">
                  Searching Mapbox...
                </FieldDescription>
              ) : null}
              {searchError ? (
                <FieldDescription className="px-3 py-2 text-destructive">
                  {searchError}
                </FieldDescription>
              ) : null}
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.label}-${suggestion.coordinates[0]}-${suggestion.coordinates[1]}`}
                  type="button"
                  className="rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelectSuggestion(suggestion);
                    setIsFocused(false);
                    setIsOpen(false);
                    setSuggestions([]);
                  }}
                >
                  <span className="block font-medium">{suggestion.label}</span>
                  <span className="block text-muted-foreground">
                    {suggestion.subtitle}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function formatCoordinates(coordinates: Coordinates): string {
  return `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
}
