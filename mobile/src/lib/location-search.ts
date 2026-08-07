import { LocationSuggestion } from '@/lib/types';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

type MapboxContextEntry = {
  id?: string;
  text?: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  text?: string;
  place_type?: string[];
  center?: [number, number];
  geometry?: {
    coordinates?: [number, number];
  };
  context?: MapboxContextEntry[];
};

function extractCoordinates(feature: MapboxFeature): [number, number] | null {
  if (Array.isArray(feature.center) && feature.center.length >= 2) {
    return [feature.center[0], feature.center[1]];
  }
  if (Array.isArray(feature.geometry?.coordinates) && feature.geometry.coordinates.length >= 2) {
    return [feature.geometry.coordinates[0], feature.geometry.coordinates[1]];
  }
  return null;
}

function extractContextValue(feature: MapboxFeature, prefixes: string[]) {
  const entries = feature.context ?? [];
  for (const prefix of prefixes) {
    const match = entries.find((entry) => entry.id?.startsWith(prefix) && entry.text);
    if (match?.text) {
      return match.text;
    }
  }
  return null;
}

function toSuggestion(feature: MapboxFeature): LocationSuggestion | null {
  const coords = extractCoordinates(feature);
  if (!feature.id || !feature.place_name || !coords) {
    return null;
  }

  const [lng, lat] = coords;
  const city =
    extractContextValue(feature, ['place.', 'locality.', 'district.']) ??
    (feature.place_type?.includes('place') ? feature.text ?? null : null);

  return {
    id: feature.id,
    displayName: feature.place_name,
    city,
    region: extractContextValue(feature, ['region.', 'province.']),
    country: extractContextValue(feature, ['country.']),
    lat,
    lng,
  };
}

export async function searchLocations(query: string): Promise<LocationSuggestion[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) {
    return [];
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json`,
  );
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('limit', '5');
  url.searchParams.set('types', 'place,locality');
  url.searchParams.set('access_token', MAPBOX_TOKEN);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Failed to search locations.');
  }

  const payload = (await response.json()) as { features?: MapboxFeature[] };
  return (payload.features ?? []).map(toSuggestion).filter((value): value is LocationSuggestion => Boolean(value));
}
