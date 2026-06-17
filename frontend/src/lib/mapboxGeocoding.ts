import type { Coordinates } from '../types';

const GEOCODING_FORWARD_URL = 'https://api.mapbox.com/search/geocode/v6/forward';
const GEOCODING_REVERSE_URL = 'https://api.mapbox.com/search/geocode/v6/reverse';
const SEARCH_TYPES = 'address,street,place,locality,postcode,region';

export interface LocationSuggestion {
  label: string;
  subtitle: string;
  coordinates: Coordinates;
}

interface MapboxFeatureCollection {
  features?: MapboxFeature[];
}

interface MapboxFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

export async function searchLocationSuggestions(query: string, accessToken: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return [];
  }

  const searchParams = new URLSearchParams({
    q: trimmedQuery,
    access_token: accessToken,
    autocomplete: 'true',
    country: 'us',
    language: 'en',
    limit: '5',
    types: SEARCH_TYPES,
  });

  const response = await fetch(`${GEOCODING_FORWARD_URL}?${searchParams.toString()}`, { signal });
  if (!response.ok) {
    throw new Error('Location suggestions are unavailable right now');
  }

  const payload = (await response.json()) as MapboxFeatureCollection;
  return (payload.features ?? [])
    .map((feature) => featureToSuggestion(feature))
    .filter((suggestion): suggestion is LocationSuggestion => suggestion !== null);
}

export async function reverseGeocodeLocation(coordinates: Coordinates, accessToken: string, signal?: AbortSignal): Promise<LocationSuggestion | null> {
  const searchParams = new URLSearchParams({
    longitude: String(coordinates[0]),
    latitude: String(coordinates[1]),
    access_token: accessToken,
    language: 'en',
    limit: '1',
    types: SEARCH_TYPES,
  });

  const response = await fetch(`${GEOCODING_REVERSE_URL}?${searchParams.toString()}`, { signal });
  if (!response.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const payload = (await response.json()) as MapboxFeatureCollection;
  const firstFeature = payload.features?.[0];
  return firstFeature ? featureToSuggestion(firstFeature) : null;
}

function featureToSuggestion(feature: MapboxFeature): LocationSuggestion | null {
  const coordinates = feature.geometry?.coordinates;
  if (!isCoordinatePair(coordinates)) {
    return null;
  }

  const properties = feature.properties ?? {};
  const label = firstString(
    properties.full_address,
    properties.name_preferred,
    properties.name,
    properties.place_formatted,
    'Selected location',
  );
  const subtitle = firstString(
    properties.place_formatted,
    properties.feature_type,
    'Mapbox result',
  );

  return {
    label,
    subtitle,
    coordinates: [Number(coordinates[0]), Number(coordinates[1])],
  };
}

function firstString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return 'Selected location';
}

function isCoordinatePair(value: unknown): value is Coordinates {
  return (
    Array.isArray(value)
    && value.length === 2
    && typeof value[0] === 'number'
    && typeof value[1] === 'number'
  );
}
