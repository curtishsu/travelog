import type { SupabaseClient } from '@supabase/supabase-js';

import type { StatsSummary } from '@/features/stats/types';
import type { Database } from '@/types/database';

type TripRow = Database['public']['Tables']['trips']['Row'];
type TripDayRow = Database['public']['Tables']['trip_days']['Row'];
type TripLocationRow = Database['public']['Tables']['trip_locations']['Row'];
type TripDayHashtagRow = Database['public']['Tables']['trip_day_hashtags']['Row'];
type TripTypeRow = Database['public']['Tables']['trip_types']['Row'];

function selectDominantBucket(counts: Map<string, number>, fallback: string) {
  if (!counts.size) {
    return fallback;
  }

  let selectedBucket = fallback;
  let highestCount = -1;

  for (const [bucket, count] of counts) {
    if (count > highestCount || (count === highestCount && bucket < selectedBucket)) {
      highestCount = count;
      selectedBucket = bucket;
    }
  }

  return selectedBucket;
}

export async function calculateStats(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<StatsSummary> {
  const todayISO = new Date().toISOString().slice(0, 10);

  const { data: tripsData, error: tripsError } = await supabase
    .from('trips')
    .select('id,start_date,end_date,name,status')
    .eq('user_id', userId);

  if (tripsError) {
    throw tripsError;
  }

  const trips: TripRow[] = tripsData ?? [];

  const tripIds = trips.map((trip) => trip.id);

  if (!tripIds.length) {
    return {
      totalTrips: 0,
      totalTravelDays: 0,
      countriesVisited: 0,
      locationsVisited: 0,
      mostVisitedLocation: null,
      hashtagDistribution: [],
      tripTypeDistribution: [],
      tripTrendsYear: [],
      tripTrendsMonth: [],
      travelDayTrendsYear: [],
      travelDayTrendsMonth: []
    };
  }

  const { data: tripDaysData, error: tripDaysError } = await supabase
    .from('trip_days')
    .select('id,trip_id,date,day_index')
    .in('trip_id', tripIds);

  if (tripDaysError) {
    throw tripDaysError;
  }

  const tripDays: TripDayRow[] = tripDaysData ?? [];

  const tripDayIds = tripDays.map((day) => day.id);

  const [
    { data: tripLocationsData, error: locationsError },
    { data: tripDayHashtagsData, error: hashtagsError },
    { data: tripTypesData, error: typesError }
  ] = await Promise.all([
    tripDayIds.length
      ? supabase
          .from('trip_locations')
          .select('id,trip_day_id,city,region,country')
          .in('trip_day_id', tripDayIds)
      : Promise.resolve({ data: [], error: null }),
    tripDayIds.length
      ? supabase
          .from('trip_day_hashtags')
          .select('trip_day_id,hashtag')
          .in('trip_day_id', tripDayIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('trip_types').select('trip_id,type').in('trip_id', tripIds)
  ]);

  if (locationsError) {
    throw locationsError;
  }
  if (hashtagsError) {
    throw hashtagsError;
  }
  if (typesError) {
    throw typesError;
  }

  const tripLocations: TripLocationRow[] = tripLocationsData ?? [];
  const tripDayHashtags: TripDayHashtagRow[] = tripDayHashtagsData ?? [];
  const tripTypes: TripTypeRow[] = tripTypesData ?? [];

  const tripDayMap = new Map(tripDays.map((day) => [day.id, day]));
  const tripMap = new Map(trips.map((trip) => [trip.id, trip]));

  const allDaysByTrip = new Map<string, TripDayRow[]>();
  const relevantDaysByTrip = new Map<string, TripDayRow[]>();
  for (const day of tripDays) {
    if (!allDaysByTrip.has(day.trip_id)) {
      allDaysByTrip.set(day.trip_id, []);
    }
    allDaysByTrip.get(day.trip_id)!.push(day);

    if (day.date <= todayISO) {
      if (!relevantDaysByTrip.has(day.trip_id)) {
        relevantDaysByTrip.set(day.trip_id, []);
      }
      relevantDaysByTrip.get(day.trip_id)!.push(day);
    }
  }

  const totalTravelDays = new Set(
    tripDays.filter((day) => day.date <= todayISO).map((day) => day.date)
  ).size;

  const countriesVisited = new Set<string>();
  const locationsVisited = new Set<string>();

  const cityTripCounts = new Map<
    string,
    {
      trips: Set<string>;
      latestTripStart: string;
      days: Set<string>;
      city: string | null;
      country: string | null;
    }
  >();

  for (const location of tripLocations) {
    const day = tripDayMap.get(location.trip_day_id);
    if (!day || day.date > todayISO) {
      continue;
    }
    const trip = tripMap.get(day.trip_id);
    if (!trip) continue;

    if (location.country) {
      countriesVisited.add(location.country);
    }

    if (location.city || location.country) {
      const cityKey = `${(location.city ?? '').toLowerCase()}|${(location.country ?? '').toLowerCase()}`;
      locationsVisited.add(cityKey);

      if (!cityTripCounts.has(cityKey)) {
        cityTripCounts.set(cityKey, {
          trips: new Set([trip.id]),
          latestTripStart: trip.start_date,
          days: new Set([day.id]),
          city: location.city,
          country: location.country
        });
      } else {
        const bucket = cityTripCounts.get(cityKey)!;
        bucket.trips.add(trip.id);
        bucket.days.add(day.id);
        if (trip.start_date > bucket.latestTripStart) {
          bucket.latestTripStart = trip.start_date;
        }
      }
    }
  }

  let topLocation:
    | {
        city: string | null;
        country: string | null;
        tripCount: number;
        latestTripStart: string;
        daysHere: number;
      }
    | null = null;

  for (const detail of cityTripCounts.values()) {
    const tripCount = detail.trips.size;
    if (
      !topLocation ||
      tripCount > topLocation.tripCount ||
      (tripCount === topLocation.tripCount && detail.latestTripStart > topLocation.latestTripStart)
    ) {
      topLocation = {
        city: detail.city,
        country: detail.country,
        tripCount,
        latestTripStart: detail.latestTripStart,
        daysHere: detail.days.size
      };
    }
  }

  const mostVisitedLocation = topLocation
    ? {
        city: topLocation.city,
        country: topLocation.country,
        tripCount: topLocation.tripCount,
        daysHere: topLocation.daysHere
      }
    : null;

  const completedTripIds = trips.filter((trip) => trip.end_date < todayISO).map((trip) => trip.id);
  const completedTripIdSet = new Set(completedTripIds);

  const completedDayIds = tripDays
    .filter((day) => completedTripIdSet.has(day.trip_id))
    .map((day) => day.id);
  const completedDayIdSet = new Set(completedDayIds);

  const hashtagDistributionMap = new Map<
    string,
    {
      dayIds: Set<string>;
      tripDays: Map<string, { tripId: string; tripName: string; dayIndex: number }>;
    }
  >();
  for (const tag of tripDayHashtags) {
    if (!completedDayIdSet.has(tag.trip_day_id)) continue;
    const day = tripDayMap.get(tag.trip_day_id);
    if (!day) continue;
    const trip = tripMap.get(day.trip_id);
    if (!trip) continue;

    const bucket =
      hashtagDistributionMap.get(tag.hashtag) ??
      (() => {
        const init = {
          dayIds: new Set<string>(),
          tripDays: new Map<string, { tripId: string; tripName: string; dayIndex: number }>()
        };
        hashtagDistributionMap.set(tag.hashtag, init);
        return init;
      })();

    bucket.dayIds.add(tag.trip_day_id);
    const dayKey = tag.trip_day_id;
    if (!bucket.tripDays.has(dayKey)) {
      bucket.tripDays.set(dayKey, {
        tripId: trip.id,
        tripName: trip.name ?? 'Untitled trip',
        dayIndex: typeof day.day_index === 'number' ? day.day_index : 1
      });
    }
  }

  const tripTypeDistributionMap = new Map<string, Set<string>>();
  for (const tripType of tripTypes) {
    if (!completedTripIdSet.has(tripType.trip_id)) continue;
    if (!tripTypeDistributionMap.has(tripType.type)) {
      tripTypeDistributionMap.set(tripType.type, new Set([tripType.trip_id]));
    } else {
      tripTypeDistributionMap.get(tripType.type)!.add(tripType.trip_id);
    }
  }

  const tripTrendsYearMap = new Map<string, Set<string>>();
  const tripTrendsMonthMap = new Map<string, Set<string>>();
  const travelDayTrendsYearMap = new Map<
    string,
    {
      tripIds: Set<string>;
      tripDays: Array<{ tripId: string; tripName: string; dayIndex: number; date: string }>;
    }
  >();
  const travelDayTrendsMonthMap = new Map<
    string,
    {
      tripIds: Set<string>;
      tripDays: Array<{ tripId: string; tripName: string; dayIndex: number; date: string }>;
    }
  >();

  for (const trip of trips) {
    const startDate = new Date(`${trip.start_date}T00:00:00Z`);
    const fallbackYear = startDate.getUTCFullYear().toString();
    const fallbackMonth = `${fallbackYear}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const daysForTrip = allDaysByTrip.get(trip.id) ?? [];
    const yearCounts = new Map<string, number>();
    const monthCounts = new Map<string, number>();

    for (const day of daysForTrip) {
      const parsed = new Date(`${day.date}T00:00:00Z`);
      const year = parsed.getUTCFullYear().toString();
      const monthKey = `${year}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
    }

    const yearBucket = selectDominantBucket(yearCounts, fallbackYear);
    const monthBucket = selectDominantBucket(monthCounts, fallbackMonth);

    if (!tripTrendsYearMap.has(yearBucket)) {
      tripTrendsYearMap.set(yearBucket, new Set());
    }
    tripTrendsYearMap.get(yearBucket)!.add(trip.id);

    if (!tripTrendsMonthMap.has(monthBucket)) {
      tripTrendsMonthMap.set(monthBucket, new Set());
    }
    tripTrendsMonthMap.get(monthBucket)!.add(trip.id);
  }

  for (const [tripId, days] of relevantDaysByTrip.entries()) {
    const trip = tripMap.get(tripId);
    if (!trip) {
      continue;
    }
    for (const day of days) {
      const parsed = new Date(`${day.date}T00:00:00Z`);
      const year = parsed.getUTCFullYear().toString();
      const monthKey = `${year}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
      const detail = {
        tripId,
        tripName: trip.name ?? 'Untitled trip',
        dayIndex: typeof day.day_index === 'number' ? day.day_index : 1,
        date: day.date
      };

      if (!travelDayTrendsYearMap.has(year)) {
        travelDayTrendsYearMap.set(year, { tripIds: new Set(), tripDays: [] });
      }
      const yearEntry = travelDayTrendsYearMap.get(year)!;
      yearEntry.tripIds.add(tripId);
      yearEntry.tripDays.push(detail);

      if (!travelDayTrendsMonthMap.has(monthKey)) {
        travelDayTrendsMonthMap.set(monthKey, { tripIds: new Set(), tripDays: [] });
      }
      const monthEntry = travelDayTrendsMonthMap.get(monthKey)!;
      monthEntry.tripIds.add(tripId);
      monthEntry.tripDays.push(detail);
    }
  }

  return {
    totalTrips: trips.length,
    totalTravelDays,
    countriesVisited: countriesVisited.size,
    locationsVisited: locationsVisited.size,
    mostVisitedLocation,
    hashtagDistribution: Array.from(hashtagDistributionMap.entries())
      .map(([hashtag, detail]) => ({
        hashtag,
        dayCount: detail.dayIds.size,
        tripDays: Array.from(detail.tripDays.values()).sort((a, b) =>
          a.tripName.localeCompare(b.tripName)
        )
      }))
      .sort((a, b) => {
        if (b.dayCount !== a.dayCount) {
          return b.dayCount - a.dayCount;
        }
        return a.hashtag.localeCompare(b.hashtag);
      }),
    tripTypeDistribution: Array.from(tripTypeDistributionMap.entries())
      .map(([type, tripSet]) => {
        const tripsForType = Array.from(tripSet)
          .map((tripId) => {
            const trip = tripMap.get(tripId);
            return {
              tripId,
              tripName: trip?.name ?? 'Untitled trip'
            };
          })
          .sort((a, b) => a.tripName.localeCompare(b.tripName));
        return {
          type,
          tripCount: tripSet.size,
          trips: tripsForType
        };
      })
      .sort((a, b) => {
        if (b.tripCount !== a.tripCount) {
          return b.tripCount - a.tripCount;
        }
        return a.type.localeCompare(b.type);
      }),
    tripTrendsYear: Array.from(tripTrendsYearMap.entries())
      .sort(([bucketA], [bucketB]) => Number(bucketA) - Number(bucketB))
      .map(([bucket, tripIds]) => {
        const tripsForBucket = Array.from(tripIds)
          .map((tripId) => {
            const trip = tripMap.get(tripId);
            return {
              tripId,
              tripName: trip?.name ?? 'Untitled trip'
            };
          })
          .sort((a, b) => a.tripName.localeCompare(b.tripName));
        return {
          bucket,
          tripCount: tripIds.size,
          trips: tripsForBucket
        };
      }),
    tripTrendsMonth: Array.from(tripTrendsMonthMap.entries())
      .sort(([bucketA], [bucketB]) => bucketA.localeCompare(bucketB))
      .map(([bucket, tripIds]) => {
        const tripsForBucket = Array.from(tripIds)
          .map((tripId) => {
            const trip = tripMap.get(tripId);
            return {
              tripId,
              tripName: trip?.name ?? 'Untitled trip'
            };
          })
          .sort((a, b) => a.tripName.localeCompare(b.tripName));
        return {
          bucket,
          tripCount: tripIds.size,
          trips: tripsForBucket
        };
      }),
    travelDayTrendsYear: Array.from(travelDayTrendsYearMap.entries())
      .sort(([bucketA], [bucketB]) => Number(bucketA) - Number(bucketB))
      .map(([bucket, detail]) => {
        const tripDays = detail.tripDays
          .slice()
          .sort((a, b) => (a.date === b.date ? a.tripName.localeCompare(b.tripName) : a.date.localeCompare(b.date)));
        const tripsForBucket = Array.from(detail.tripIds)
          .map((tripId) => {
            const trip = tripMap.get(tripId);
            return {
              tripId,
              tripName: trip?.name ?? 'Untitled trip'
            };
          })
          .sort((a, b) => a.tripName.localeCompare(b.tripName));
        return {
          bucket,
          dayCount: tripDays.length,
          trips: tripsForBucket,
          tripDays
        };
      }),
    travelDayTrendsMonth: Array.from(travelDayTrendsMonthMap.entries())
      .sort(([bucketA], [bucketB]) => bucketA.localeCompare(bucketB))
      .map(([bucket, detail]) => {
        const tripDays = detail.tripDays
          .slice()
          .sort((a, b) => (a.date === b.date ? a.tripName.localeCompare(b.tripName) : a.date.localeCompare(b.date)));
        const tripsForBucket = Array.from(detail.tripIds)
          .map((tripId) => {
            const trip = tripMap.get(tripId);
            return {
              tripId,
              tripName: trip?.name ?? 'Untitled trip'
            };
          })
          .sort((a, b) => a.tripName.localeCompare(b.tripName));
        return {
          bucket,
          dayCount: tripDays.length,
          trips: tripsForBucket,
          tripDays
        };
      })
  };
}

