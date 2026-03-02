import tzLookup from 'tz-lookup';

import { normalizeTimeZone } from '@/lib/timezone';

export function inferTimeZoneFromCoordinates(lat: number, lng: number) {
  try {
    const inferred = tzLookup(lat, lng);
    return normalizeTimeZone(inferred);
  } catch {
    return null;
  }
}
