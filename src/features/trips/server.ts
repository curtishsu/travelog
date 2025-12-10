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
  const { supabase, user, isDemoMode } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
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
        trip_group:trip_groups(
          *,
          members:trip_group_members(*)
        )
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

  const trip = normalizeTripDetail(data as TripDetail);

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
    trip,
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

export async function loadMapLocations(): Promise<MapLocationEntry[]> {
  const { supabase, user, isDemoMode } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
    redirect('/auth/signin');
  }

  const userId = user?.id ?? '';
  const { data, error } = await supabase
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

