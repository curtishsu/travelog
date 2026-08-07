import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import { getDayIndexFromISODate, getTodayISOInTimeZone } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import type {
  GuestModeSettings,
  LocationInput,
  OverlapWarning,
  TripDayUpdatePayload,
  TripDetail,
  TripOverviewPayload,
  TripSummary,
} from '@/lib/types';

function normalizeTripDetail(trip: TripDetail): TripDetail {
  return {
    ...trip,
    trip_links: trip.trip_links ?? [],
    trip_types: trip.trip_types ?? [],
    trip_days: [...(trip.trip_days ?? [])].sort((a, b) => a.day_index - b.day_index),
  };
}

function normalizeTripTypeInput(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function parseRpcError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }
  return new Error('Unknown request error');
}

export async function listTrips(): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(
      `
        id,
        name,
        timezone,
        start_date,
        end_date,
        status,
        created_at,
        updated_at,
        trip_types(type),
        trip_days(
          id,
          day_index,
          is_favorite,
          trip_day_hashtags(
            hashtag
          )
        )
      `,
    )
    .order('start_date', { ascending: false })
    .order('day_index', { foreignTable: 'trip_days', ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TripSummary[];
}

export async function getTripDetail(tripId: string): Promise<TripDetail> {
  const { data, error } = await supabase
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
          trip_day_hashtags(*),
          trip_day_paragraphs(*)
        )
      `,
    )
    .eq('id', tripId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Trip not found.');
  }

  return normalizeTripDetail(data as TripDetail);
}

export async function getGuestModeSettings(): Promise<GuestModeSettings> {
  const { data, error } = await supabase.from('user_settings').select('guest_mode_enabled').maybeSingle();
  if (error) {
    throw error;
  }
  return { guestModeEnabled: data?.guest_mode_enabled ?? false };
}

export async function setGuestModeSettings(guestModeEnabled: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      guest_mode_enabled: guestModeEnabled,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw error;
  }
}

export async function getLandingRedirect() {
  const trips = await listTrips();
  const activeTrip = trips.find((trip) => {
    const timezone = trip.timezone ?? 'UTC';
    const today = getTodayISOInTimeZone(timezone);
    return trip.start_date <= today && trip.end_date >= today;
  });

  if (!activeTrip) {
    return { pathname: '/(tabs)/journal' as const };
  }

  const dayIndex = getDayIndexFromISODate(
    activeTrip.start_date,
    getTodayISOInTimeZone(activeTrip.timezone ?? 'UTC'),
  );
  return {
    pathname: '/trips/[tripId]/edit' as const,
    params: { tripId: activeTrip.id, tab: `day-${dayIndex}` },
  };
}

export async function createTrip(payload: TripOverviewPayload): Promise<{ tripId: string; overlapWarning: OverlapWarning | null }> {
  const { data, error } = await supabase.rpc('mobile_create_trip', {
    p_name: payload.name.trim(),
    p_start_date: payload.startDate,
    p_end_date: payload.endDate,
    p_timezone: payload.timezone ?? null,
    p_reflection: payload.reflection ?? null,
    p_trip_types: normalizeTripTypeInput(payload.tripTypes),
  });

  if (error || !data?.[0]?.trip_id) {
    throw parseRpcError(error);
  }

  return {
    tripId: data[0].trip_id as string,
    overlapWarning: (data[0].overlap_warning as OverlapWarning | null) ?? null,
  };
}

export async function updateTripOverview(
  tripId: string,
  payload: TripOverviewPayload,
): Promise<{ tripId: string; overlapWarning: OverlapWarning | null }> {
  const { data, error } = await supabase.rpc('mobile_update_trip_overview', {
    p_trip_id: tripId,
    p_name: payload.name.trim(),
    p_start_date: payload.startDate,
    p_end_date: payload.endDate,
    p_timezone: payload.timezone ?? null,
    p_reflection: payload.reflection ?? '',
    p_trip_types: normalizeTripTypeInput(payload.tripTypes),
  });

  if (error || !data?.[0]?.trip_id) {
    throw parseRpcError(error);
  }

  return {
    tripId: data[0].trip_id as string,
    overlapWarning: (data[0].overlap_warning as OverlapWarning | null) ?? null,
  };
}

export async function updateTripDay(tripId: string, dayIndex: number, payload: TripDayUpdatePayload) {
  const { error } = await supabase.rpc('mobile_update_trip_day', {
    p_trip_id: tripId,
    p_day_index: dayIndex,
    p_highlight: payload.highlight ?? null,
    p_journal_entry: payload.journalEntry ?? null,
    p_paragraphs: payload.paragraphs ?? null,
    p_is_favorite: payload.isFavorite ?? null,
    p_hashtags: payload.hashtags ?? null,
    p_locations_to_add: payload.locationsToAdd ?? null,
    p_location_ids_to_remove: payload.locationIdsToRemove ?? null,
    p_is_locked: payload.isLocked ?? null,
  });

  if (error) {
    throw parseRpcError(error);
  }
}

export async function deleteTrip(tripId: string) {
  const { error } = await supabase.from('trips').delete().eq('id', tripId);
  if (error) {
    throw error;
  }
}

function extractStoragePath(url: string) {
  const marker = '/storage/v1/object/public/photos/';
  const index = url.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function deletePhoto(photoId: string, fullUrl?: string | null, thumbnailUrl?: string | null) {
  const paths = [fullUrl, thumbnailUrl]
    .map((value) => (value ? extractStoragePath(value) : null))
    .filter((value): value is string => Boolean(value));

  if (paths.length) {
    await supabase.storage.from('photos').remove(paths);
  }

  const { error } = await supabase.from('photos').delete().eq('id', photoId);
  if (error) {
    throw error;
  }
}

async function getImageVariants(uri: string) {
  const full = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 2560 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  const thumbnail = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 400 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );

  return { full, thumbnail };
}

export async function uploadTripPhoto(input: {
  tripId: string;
  tripDayId: string;
  tripLocationId?: string | null;
}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return null;
  }

  const asset = result.assets[0];
  const { full, thumbnail } = await getImageVariants(asset.uri);

  if (!full.base64 || !thumbnail.base64) {
    throw new Error('Failed to prepare photo upload.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const photoId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const basePath = `${user.id}/${input.tripId}/${input.tripDayId}`;
  const fullPath = `${basePath}/full/${photoId}.jpg`;
  const thumbnailPath = `${basePath}/thumb/${photoId}.jpg`;

  const [fullUpload, thumbUpload] = await Promise.all([
    supabase.storage.from('photos').upload(fullPath, decode(full.base64), {
      contentType: 'image/jpeg',
      upsert: false,
    }),
    supabase.storage.from('photos').upload(thumbnailPath, decode(thumbnail.base64), {
      contentType: 'image/jpeg',
      upsert: false,
    }),
  ]);

  if (fullUpload.error) {
    throw fullUpload.error;
  }
  if (thumbUpload.error) {
    throw thumbUpload.error;
  }

  const fullUrl = supabase.storage.from('photos').getPublicUrl(fullPath).data.publicUrl;
  const thumbnailUrl = supabase.storage.from('photos').getPublicUrl(thumbnailPath).data.publicUrl;

  const { error } = await supabase.from('photos').insert({
    id: photoId,
    trip_id: input.tripId,
    trip_day_id: input.tripDayId,
    trip_location_id: input.tripLocationId ?? null,
    full_url: fullUrl,
    thumbnail_url: thumbnailUrl,
    width: full.width ?? null,
    height: full.height ?? null,
  });

  if (error) {
    throw error;
  }

  return photoId;
}

export async function addLocationsToTripDay(tripId: string, dayIndex: number, locations: LocationInput[]) {
  await updateTripDay(tripId, dayIndex, {
    locationsToAdd: locations,
  });
}
