import { notFound, redirect } from 'next/navigation';

import { calculateStats } from '@/features/stats/calculate';
import type { StatsSummary } from '@/features/stats/types';
import { normalizeTripDetail } from '@/features/trips/privacy';
import type { TripDetail } from '@/features/trips/types';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripDetailResult = {
  trip: TripDetail;
  guestModeEnabled: boolean;
};

export async function loadTripDetail(tripId: string): Promise<TripDetailResult> {
  const { supabase, user, isDemoMode, authError } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
    console.warn('[loadTripDetail] unauthenticated request, redirecting', {
      tripId,
      isDemoMode,
      authError: authError instanceof Error ? authError.message : authError ?? null
    });
    redirect('/auth/signin');
  }

  const userId = user?.id;
  const tripRequest = supabase
    .from('trips')
    .select(
      `
        *,
        trip_links(*),
        trip_types(*),
        trip_days(
          *,
          trip_locations(*),
          photos(*),
          trip_day_hashtags(*)
        ),
        trip_group:trip_groups!trips_trip_group_id_fkey(
          *,
          members:trip_group_people(
            person:people(*)
          )
        ),
        trip_companion_groups(trip_group_id),
        trip_companion_people(person_id)
      `
    )
    .eq('id', tripId)
    .eq('user_id', userId ?? '')
    .maybeSingle<TripDetail>();

  const guestModeRequest = userId
    ? supabase
        .from('user_settings')
        .select('guest_mode_enabled')
        .eq('user_id', userId)
        .maybeSingle<{ guest_mode_enabled: boolean }>()
    : Promise.resolve({ data: null, error: null } as {
        data: { guest_mode_enabled: boolean } | null;
        error: unknown;
      });

  const [{ data, error }, { data: settingsData, error: guestModeError }] = await Promise.all([
    tripRequest,
    guestModeRequest
  ]);

  if (error || !data) {
    console.error('[loadTripDetail] notFound() - failed to load trip', {
      tripId,
      userId: userId ?? null,
      isDemoMode,
      authError: authError instanceof Error ? authError.message : authError ?? null,
      supabaseError: error
        ? {
            message: (error as { message?: string }).message ?? String(error),
            details: (error as { details?: string }).details,
            hint: (error as { hint?: string }).hint,
            code: (error as { code?: string }).code
          }
        : null,
      hasData: Boolean(data)
    });
    notFound();
  }

  if (guestModeError) {
    console.error('[loadTripDetail] failed to load guest mode settings', guestModeError);
  }

  const guestModeEnabled = settingsData?.guest_mode_enabled ?? false;

  const typesProbe = await supabase
    .from('trip_types')
    .select('id, trip_id, type')
    .eq('trip_id', tripId);

  const rawTrip = data as unknown as TripDetail;
  const trip = normalizeTripDetail(rawTrip);

  const normalizedGroup = trip.trip_group
    ? {
        ...trip.trip_group,
        // Supabase returns join rows; the app expects members to be people rows.
        members: ((trip.trip_group as unknown as { members?: Array<{ person: unknown }> }).members ?? [])
          .map((member) => member.person)
          .filter(Boolean) as NonNullable<TripDetail['trip_group']>['members']
      }
    : null;

  // Debug: surface trip type shape arriving from Supabase
  console.log('[loadTripDetail] trip types snapshot', {
    tripId,
    guestModeEnabled,
    tripTypeCount: trip.trip_types?.length ?? 0,
    tripTypeSample: (trip.trip_types ?? []).slice(0, 5).map((type) => ({
      id: type.id,
      type: type.type
    })),
    directCount: typesProbe.data?.length ?? 0,
    probeError: typesProbe.error
  });

  return {
    trip: {
      ...trip,
      trip_group: normalizedGroup
    },
    guestModeEnabled
  };
}

export type MapLocationEntry = {
  locationId: string;
  displayName: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  tripId: string;
  tripName: string;
  tripDayId: string;
  dayIndex: number;
  date: string;
  highlight: string | null;
  hashtags: string[];
};

export async function loadMapLocations(filters?: {
  personId?: string | null;
  groupId?: string | null;
}): Promise<MapLocationEntry[]> {
  const { supabase, user, isDemoMode } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
    redirect('/auth/signin');
  }

  const userId = user?.id ?? '';

  const personId = filters?.personId ?? null;
  const groupId = filters?.groupId ?? null;

  let allowedTripIds: string[] | null = null;

  if (personId || groupId) {
    const tripIds = new Set<string>();

    if (groupId) {
      const { data: groupTrips, error: groupTripsError } = await supabase
        .from('trip_companion_groups')
        .select('trip_id, trips!inner(user_id)')
        .eq('trip_group_id', groupId)
        .eq('trips.user_id', userId);

      if (groupTripsError) {
        console.error('[loadMapLocations] failed to filter by group', groupTripsError);
      } else {
        for (const row of (groupTrips ?? []) as Array<{ trip_id: string }>) {
          tripIds.add(row.trip_id);
        }
      }
    }

    if (personId) {
      const { data: directTrips, error: directTripsError } = await supabase
        .from('trip_companion_people')
        .select('trip_id, trips!inner(user_id)')
        .eq('person_id', personId)
        .eq('trips.user_id', userId);

      if (directTripsError) {
        console.error('[loadMapLocations] failed to filter by person (direct)', directTripsError);
      } else {
        for (const row of (directTrips ?? []) as Array<{ trip_id: string }>) {
          tripIds.add(row.trip_id);
        }
      }

      const { data: groupRows, error: groupRowsError } = await supabase
        .from('trip_groups')
        .select('id, trip_group_people!inner(person_id)')
        .eq('user_id', userId)
        .eq('trip_group_people.person_id', personId);

      if (groupRowsError) {
        console.error('[loadMapLocations] failed to resolve groups for person', groupRowsError);
      } else {
        const groupIdsForPerson = (groupRows ?? []).map((row) => (row as { id: string }).id);
        if (groupIdsForPerson.length) {
          const { data: impliedTrips, error: impliedTripsError } = await supabase
            .from('trip_companion_groups')
            .select('trip_id, trips!inner(user_id)')
            .in('trip_group_id', groupIdsForPerson)
            .eq('trips.user_id', userId);

          if (impliedTripsError) {
            console.error('[loadMapLocations] failed to filter by person (via groups)', impliedTripsError);
          } else {
            for (const row of (impliedTrips ?? []) as Array<{ trip_id: string }>) {
              tripIds.add(row.trip_id);
            }
          }
        }
      }
    }

    allowedTripIds = Array.from(tripIds);
  }

  const tripsQuery = supabase
    .from('trips')
    .select(
      `
        id,
        name,
        trip_days(
          id,
          date,
          day_index,
          highlight,
          trip_locations(*),
          trip_day_hashtags(hashtag)
        )
      `
    )
    .eq('user_id', userId);

  if (allowedTripIds && allowedTripIds.length > 0) {
    tripsQuery.in('id', allowedTripIds);
  } else if (allowedTripIds && allowedTripIds.length === 0) {
    return [];
  }

  const { data, error } = await tripsQuery;

  if (error || !data) {
    return [];
  }

  const typedTrips = data as Array<
    Database['public']['Tables']['trips']['Row'] & {
      trip_days: Array<
        Database['public']['Tables']['trip_days']['Row'] & {
          trip_locations: Database['public']['Tables']['trip_locations']['Row'][];
          trip_day_hashtags: Database['public']['Tables']['trip_day_hashtags']['Row'][];
        }
      >;
    }
  >;

  const entries: MapLocationEntry[] = [];

  for (const trip of typedTrips) {
    for (const tripDay of trip.trip_days ?? []) {
      const hashtags = (tripDay.trip_day_hashtags ?? []).map((tag) => tag.hashtag);
      for (const location of tripDay.trip_locations ?? []) {
        entries.push({
          locationId: location.id,
          displayName: location.display_name,
          city: location.city,
          region: location.region,
          country: location.country,
          lat: location.lat,
          lng: location.lng,
          tripId: trip.id,
          tripName: trip.name,
          tripDayId: tripDay.id,
          dayIndex: tripDay.day_index,
          date: tripDay.date,
          highlight: tripDay.highlight,
          hashtags
        });
      }
    }
  }

  return entries;
}

export async function loadStats(): Promise<StatsSummary> {
  const { supabase, user, isDemoMode } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
    redirect('/auth/signin');
  }

  return calculateStats(supabase, user?.id ?? '');
}

