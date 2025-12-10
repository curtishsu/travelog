import { NextRequest } from 'next/server';

import { badRequest, ok, serverError, unauthorized } from '@/lib/http';
import { tripDayUpdateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripDayRow = Database['public']['Tables']['trip_days']['Row'];
type TripRow = Database['public']['Tables']['trips']['Row'];
type TripLocationRow = Database['public']['Tables']['trip_locations']['Row'];
type PhotoRow = Database['public']['Tables']['photos']['Row'];
type TripLocationInsert = Database['public']['Tables']['trip_locations']['Insert'];
type TripDayHashtagInsert = Database['public']['Tables']['trip_day_hashtags']['Insert'];

type Params = { params: { tripId: string; dayIndex: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { tripId, dayIndex } = params;
  const index = Number.parseInt(dayIndex, 10);

  if (Number.isNaN(index) || index < 1) {
    return badRequest('Invalid day index.');
  }

  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

  const payload = await request.json();
  const parseResult = tripDayUpdateSchema.safeParse(payload);

  if (!parseResult.success) {
    return badRequest('Invalid trip day payload', parseResult.error.flatten());
  }

  const { data: tripDay, error: dayError } = await supabase
    .from('trip_days')
    .select(
      `
        *,
        trip_locations(*),
        photos(*),
        trip_day_hashtags(*)
      `
    )
    .eq('trip_id', tripId)
    .eq('day_index', index)
    .maybeSingle<TripDayRow & {
      trip_locations: TripLocationRow[];
      photos: PhotoRow[];
      trip_day_hashtags: Database['public']['Tables']['trip_day_hashtags']['Row'][];
    }>();

  if (dayError || !tripDay) {
    return badRequest('Trip day not found.');
  }

  const { data: owningTrip, error: tripOwnershipError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single<Pick<TripRow, 'user_id'>>();

  if (tripOwnershipError || owningTrip?.user_id !== userId) {
    return unauthorized();
  }

  const updates: Record<string, unknown> = {};

  if (parseResult.data.highlight !== undefined) {
    updates.highlight = parseResult.data.highlight;
  }

  if (parseResult.data.journalEntry !== undefined) {
    updates.journal_entry = parseResult.data.journalEntry;
  }

  if (parseResult.data.isLocked !== undefined) {
    updates.is_locked = parseResult.data.isLocked;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tripDaysTable = supabase.from('trip_days') as any;
    if (Object.keys(updates).length) {
      const { error: updateError } = await tripDaysTable
        .update(updates)
        .eq('id', tripDay.id);
      if (updateError) {
        throw updateError;
      }
    }

    if (parseResult.data.hashtags) {
      const normalized = Array.from(new Set(parseResult.data.hashtags));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripDayHashtagsTable = supabase.from('trip_day_hashtags') as any;
      const { error: deleteError } = await tripDayHashtagsTable
        .delete()
        .eq('trip_day_id', tripDay.id);
      if (deleteError) {
        throw deleteError;
      }
      if (normalized.length) {
        const hashtagRows: TripDayHashtagInsert[] = normalized.map((tag) => ({
          trip_day_id: tripDay.id,
          hashtag: tag
        }));
        const { error: insertHashtagError } = await tripDayHashtagsTable.insert(hashtagRows);
        if (insertHashtagError) {
          throw insertHashtagError;
        }
      }
    }

    if (parseResult.data.locationsToAdd?.length) {
      const locationRows: TripLocationInsert[] = parseResult.data.locationsToAdd.map((location) => ({
        trip_day_id: tripDay.id,
        display_name: location.displayName,
        city: location.city ?? null,
        region: location.region ?? null,
        country: location.country ?? null,
        lat: location.lat,
        lng: location.lng
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripLocationsTable = supabase.from('trip_locations') as any;
      const { error: insertLocationsError } = await tripLocationsTable.insert(locationRows);
      if (insertLocationsError) {
        throw insertLocationsError;
      }
    }

    if (parseResult.data.locationIdsToRemove?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripLocationsTable = supabase.from('trip_locations') as any;
      const { error: deleteLocationsError } = await tripLocationsTable
        .delete()
        .in('id', parseResult.data.locationIdsToRemove);
      if (deleteLocationsError) {
        throw deleteLocationsError;
      }
    }

    const { data: refreshedDay, error: refreshError } = await tripDaysTable
      .select(
        `
          *,
          trip_locations(*),
          photos(*),
          trip_day_hashtags(*)
        `
      )
      .eq('id', tripDay.id)
      .single();

    const typedRefreshedDay = refreshedDay as
      | (TripDayRow & {
          trip_locations: TripLocationRow[];
          photos: PhotoRow[];
          trip_day_hashtags: Database['public']['Tables']['trip_day_hashtags']['Row'][];
        })
      | null;

    if (refreshError || !typedRefreshedDay) {
      throw refreshError ?? new Error('Failed to reload trip day.');
    }

    return ok({ tripDay: typedRefreshedDay });
  } catch (error) {
    console.error('[PATCH /api/trips/:id/days/:dayIndex] failed', error);
    return serverError('Failed to update trip day.');
  }
}

