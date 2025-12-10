import type { TripDetail, TripDayWithRelations } from '@/features/trips/types';

function sortTripDays(tripDays: TripDayWithRelations[] | null | undefined): TripDayWithRelations[] {
  if (!tripDays?.length) {
    return [];
  }
  return [...tripDays].sort((a, b) => a.day_index - b.day_index);
}

export function normalizeTripDetail(trip: TripDetail): TripDetail {
  return {
    ...trip,
    trip_links: trip.trip_links ?? [],
    trip_types: trip.trip_types ?? [],
    trip_days: sortTripDays(trip.trip_days),
    trip_group: trip.trip_group ?? null
  };
}

