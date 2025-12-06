import type { TripDetail, TripSummary, TripDayWithRelations, OverlapWarning } from '@/features/trips/types';
import type { StatsSummary } from '@/features/stats/types';
import type { Tables } from '@/types/database';
import type { TripGroup } from '@/features/trips/types';

type TripLinkInput = {
  label: string;
  url: string;
};

export type TripOverviewPayload = {
  name: string;
  startDate: string;
  endDate: string;
  links: TripLinkInput[];
  tripTypes: string[];
  reflection?: string | null;
  tripGroupId?: string | null;
};

export type TripUpdatePayload = Partial<Omit<TripOverviewPayload, 'links' | 'tripTypes'>> & {
  links?: TripLinkInput[];
  tripTypes?: string[];
};

export type LocationInput = {
  displayName: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat: number;
  lng: number;
};

export type TripDayUpdatePayload = {
  highlight?: string | null;
  journalEntry?: string | null;
  hashtags?: string[];
  locationsToAdd?: LocationInput[];
  locationIdsToRemove?: string[];
};

export type TripSuggestions = {
  hashtags: string[];
  tripTypes: string[];
};

export type TripGroupMemberInput = {
  id?: string;
  firstName?: string;
  lastName?: string;
};

export type TripGroupInput = {
  name: string;
  members: TripGroupMemberInput[];
};

type ApiError = {
  error: string;
  issues?: unknown;
};

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: ApiError | null = null;
    try {
      body = (await response.json()) as ApiError;
    } catch {
      // ignore parse errors
    }
    const message = body?.error ?? `Request failed with status ${response.status}`;
    const error = new Error(message);
    (error as Error & { issues?: unknown }).issues = body?.issues;
    throw error;
  }

  return (await response.json()) as T;
}

export async function fetchTripsList(): Promise<TripSummary[]> {
  const response = await fetch('/api/trips', { cache: 'no-store' });
  const { trips } = await handleJson<{ trips: TripSummary[] }>(response);
  return trips;
}

export async function fetchTripDetail(tripId: string): Promise<TripDetail> {
  const response = await fetch(`/api/trips/${tripId}`, { cache: 'no-store' });
  const { trip } = await handleJson<{ trip: TripDetail }>(response);
  return trip;
}

export async function fetchTripGroups(): Promise<TripGroup[]> {
  const response = await fetch('/api/trip-groups', { cache: 'no-store' });
  const { groups } = await handleJson<{ groups: TripGroup[] }>(response);
  return groups;
}

export async function createTripGroup(payload: TripGroupInput): Promise<TripGroup> {
  const response = await fetch('/api/trip-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const { group } = await handleJson<{ group: TripGroup }>(response);
  return group;
}

export async function updateTripGroup(
  groupId: string,
  payload: Partial<TripGroupInput>
): Promise<TripGroup> {
  const response = await fetch(`/api/trip-groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const { group } = await handleJson<{ group: TripGroup }>(response);
  return group;
}

export async function deleteTripGroup(groupId: string): Promise<void> {
  const response = await fetch(`/api/trip-groups/${groupId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    await handleJson(response);
  }
}

export async function createTrip(
  payload: TripOverviewPayload
): Promise<{ trip: Tables<'trips'>; overlapWarning: OverlapWarning | null }> {
  const response = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      links: payload.links,
      tripTypes: payload.tripTypes,
      tripGroupId: payload.tripGroupId ?? null
    })
  });

  return handleJson(response);
}

export async function updateTrip(tripId: string, payload: TripUpdatePayload) {
  const response = await fetch(`/api/trips/${tripId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      reflection: payload.reflection ?? undefined,
      tripGroupId: payload.tripGroupId ?? null
    })
  });

  return handleJson<{ trip: TripDetail; overlapWarning: OverlapWarning | null }>(response);
}

export async function deleteTrip(tripId: string) {
  const response = await fetch(`/api/trips/${tripId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    await handleJson(response);
  }
}

export async function updateTripDay(tripId: string, dayIndex: number, payload: TripDayUpdatePayload) {
  const response = await fetch(`/api/trips/${tripId}/days/${dayIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const { tripDay } = await handleJson<{ tripDay: TripDayWithRelations }>(response);
  return tripDay;
}

export async function removePhoto(photoId: string): Promise<void> {
  const response = await fetch(`/api/photos/${photoId}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    await handleJson(response);
  }
}

export async function fetchTripSuggestions(): Promise<TripSuggestions> {
  const response = await fetch('/api/trips/suggestions', { cache: 'no-store' });
  return handleJson<TripSuggestions>(response);
}

export async function fetchStatsSummary(): Promise<StatsSummary> {
  const response = await fetch('/api/stats', { cache: 'no-store' });
  return handleJson<StatsSummary>(response);
}

