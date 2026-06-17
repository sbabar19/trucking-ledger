import { useEffect, useRef, useState } from 'react';
import type { Coordinates } from '../types';
import { searchLocationSuggestions, type LocationSuggestion } from '../lib/mapboxGeocoding';

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
  const [searchError, setSearchError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeout = useRef<number | null>(null);
  const canSearch = isFocused && Boolean(accessToken) && value.trim().length >= 3;

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
          setSearchError('');
          setIsOpen(true);
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          setSuggestions([]);
          setSearchError(error instanceof Error ? error.message : 'Location suggestions are unavailable');
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

  useEffect(() => () => {
    if (blurTimeout.current !== null) {
      window.clearTimeout(blurTimeout.current);
    }
  }, []);

  const statusText = coordinates ? formatCoordinates(coordinates) : isActive ? 'Ready for map pick' : 'Type to search';
  const showSuggestions = canSearch && isOpen && (suggestions.length > 0 || isSearching || Boolean(searchError));

  return (
    <div className="location-input-wrap">
      <label className="location-input-label" htmlFor={id}>
        <span>{label}</span>
        <span className={coordinates ? 'location-status location-status-ready' : 'location-status'}>{statusText}</span>
      </label>
      <input
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
            setSearchError('');
          }
          setIsOpen(true);
        }}
        placeholder={label}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showSuggestions ? 'true' : 'false'}
        aria-controls={`${id}-suggestions`}
      />
      {showSuggestions ? (
        <div className="location-suggestions" id={`${id}-suggestions`} role="listbox">
          {isSearching ? <div className="location-suggestion-hint">Searching Mapbox...</div> : null}
          {searchError ? <div className="location-suggestion-hint location-suggestion-error">{searchError}</div> : null}
          {suggestions.map((suggestion) => (
            <button
              key={`${suggestion.label}-${suggestion.coordinates[0]}-${suggestion.coordinates[1]}`}
              type="button"
              className="location-suggestion-item"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelectSuggestion(suggestion);
                setIsFocused(false);
                setIsOpen(false);
                setSuggestions([]);
              }}
            >
              <strong>{suggestion.label}</strong>
              <span>{suggestion.subtitle}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatCoordinates(coordinates: Coordinates): string {
  return `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
}
