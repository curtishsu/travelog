import { NextRequest } from 'next/server';

import { badRequest, ok, serverError, unauthorized } from '@/lib/http';
import { env } from '@/lib/env';
import { getSupabaseForRequest } from '@/lib/supabase/context';

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

type MapboxSearchResponse = {
  features?: MapboxFeature[];
};

type LocationSuggestion = {
  id: string;
  displayName: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
};

function extractCoordinates(feature: MapboxFeature): [number, number] | null {
  if (Array.isArray(feature.center) && feature.center.length >= 2) {
    const [lng, lat] = feature.center;
    if (typeof lng === 'number' && typeof lat === 'number') {
      return [lng, lat];
    }
  }

  const coordinates = feature.geometry?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const [lng, lat] = coordinates;
    if (typeof lng === 'number' && typeof lat === 'number') {
      return [lng, lat];
    }
  }

  return null;
}

function extractContextValue(feature: MapboxFeature, prefixes: string[]): string | null {
  const candidates: MapboxContextEntry[] = [];

  if (feature.context?.length) {
    candidates.push(...feature.context);
  }

  if (feature.id && prefixes.some((prefix) => feature.id?.startsWith(prefix)) && feature.text) {
    candidates.unshift({ id: feature.id, text: feature.text });
  }

  for (const prefix of prefixes) {
    const match = candidates.find((entry) => entry.id?.startsWith(prefix) && entry.text?.length);
    if (match?.text) {
      return match.text;
    }
  }

  return null;
}

function mapFeatureToSuggestion(feature: MapboxFeature): LocationSuggestion | null {
  const coordinates = extractCoordinates(feature);
  const id = feature.id ?? '';
  const displayName = feature.place_name ?? '';

  if (!coordinates || !id || !displayName) {
    return null;
  }

  const [lng, lat] = coordinates;

  const city =
    extractContextValue(feature, ['place.', 'locality.', 'district.']) ??
    (feature.place_type?.some((type) => type === 'place' || type === 'locality')
      ? feature.text ?? null
      : null);
  const region = extractContextValue(feature, ['region.', 'province.']);
  const country = extractContextValue(feature, ['country.']);

  return {
    id,
    displayName,
    city: city ?? null,
    region: region ?? null,
    country: country ?? null,
    lat,
    lng
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return badRequest('Query parameter "q" is required.');
  }

  const { user, isDemoMode } = await getSupabaseForRequest();
  if (!user && !isDemoMode) {
    return unauthorized();
  }

  const token = env.MAPBOX_TOKEN;
  if (!token) {
    console.error('[GET /api/locations/search] Missing MAPBOX_TOKEN environment variable.');
    return serverError('Location search is not configured.');
  }

  const mapboxUrl = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  mapboxUrl.searchParams.set('autocomplete', 'true');
  mapboxUrl.searchParams.set('limit', '5');
  mapboxUrl.searchParams.set('types', 'place,locality');
  mapboxUrl.searchParams.set('access_token', token);

  try {
    const response = await fetch(mapboxUrl.toString(), {
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error(
        '[GET /api/locations/search] Mapbox request failed',
        response.status,
        await response.text()
      );
      return serverError('Failed to search locations.');
    }

    const payload = (await response.json()) as MapboxSearchResponse;
    const suggestions =
      payload.features?.map(mapFeatureToSuggestion).filter((item): item is LocationSuggestion =>
        Boolean(item)
      ) ?? [];

    return ok({ suggestions });
  } catch (error) {
    console.error('[GET /api/locations/search] Unexpected error', error);
    return serverError('Failed to search locations.');
  }
}

