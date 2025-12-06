import { NextRequest } from 'next/server';

import { badRequest, ok, serverError, unauthorized } from '@/lib/http';
import { tripDayUpdateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';

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
    .maybeSingle();

  if (dayError || !tripDay) {
    return badRequest('Trip day not found.');
  }

  const { data: owningTrip, error: tripOwnershipError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();

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

  try {
    if (Object.keys(updates).length) {
      const { error: updateError } = await supabase
        .from('trip_days')
        .update(updates)
        .eq('id', tripDay.id);
      if (updateError) {
        throw updateError;
      }
    }

    if (parseResult.data.hashtags) {
      const normalized = Array.from(new Set(parseResult.data.hashtags));
      const { error: deleteError } = await supabase
        .from('trip_day_hashtags')
        .delete()
        .eq('trip_day_id', tripDay.id);
      if (deleteError) {
        throw deleteError;
      }
      if (normalized.length) {
        const hashtagRows = normalized.map((tag) => ({
          trip_day_id: tripDay.id,
          hashtag: tag
        }));
        const { error: insertHashtagError } = await supabase
          .from('trip_day_hashtags')
          .insert(hashtagRows);
        if (insertHashtagError) {
          throw insertHashtagError;
        }
      }
    }

    if (parseResult.data.locationsToAdd?.length) {
      const locationRows = parseResult.data.locationsToAdd.map((location) => ({
        trip_day_id: tripDay.id,
        display_name: location.displayName,
        city: location.city ?? null,
        region: location.region ?? null,
        country: location.country ?? null,
        lat: location.lat,
        lng: location.lng
      }));
      const { error: insertLocationsError } = await supabase
        .from('trip_locations')
        .insert(locationRows);
      if (insertLocationsError) {
        throw insertLocationsError;
      }
    }

    if (parseResult.data.locationIdsToRemove?.length) {
      const { error: deleteLocationsError } = await supabase
        .from('trip_locations')
        .delete()
        .in('id', parseResult.data.locationIdsToRemove);
      if (deleteLocationsError) {
        throw deleteLocationsError;
      }
    }

    const { data: refreshedDay, error: refreshError } = await supabase
      .from('trip_days')
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

    if (refreshError || !refreshedDay) {
      throw refreshError ?? new Error('Failed to reload trip day.');
    }

    return ok({ tripDay: refreshedDay });
  } catch (error) {
    console.error('[PATCH /api/trips/:id/days/:dayIndex] failed', error);
    return serverError('Failed to update trip day.');
  }
}

