import { NextRequest } from 'next/server';

import { badRequest, created, serverError, unauthorized } from '@/lib/http';
import { photoCreateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const parseResult = photoCreateSchema.safeParse(payload);

  if (!parseResult.success) {
    return badRequest('Invalid photo payload', parseResult.error.flatten());
  }

  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

  const { tripId, tripDayId, tripLocationId, thumbnailUrl, fullUrl, width, height } = parseResult.data;

  const { data: tripDay, error: tripDayError } = await supabase
    .from('trip_days')
    .select('id,trip_id')
    .eq('id', tripDayId)
    .maybeSingle();

  if (tripDayError || !tripDay) {
    return badRequest('Trip day not found.');
  }

  const { data: owningTrip, error: tripOwnershipError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripDay.trip_id)
    .single();

  if (tripOwnershipError || owningTrip?.user_id !== userId) {
    return unauthorized();
  }

  if (tripDay.trip_id !== tripId) {
    return badRequest('Photo trip reference mismatch.');
  }

  try {
    const { data, error } = await supabase
      .from('photos')
      .insert({
        trip_id: tripId,
        trip_day_id: tripDayId,
        trip_location_id: tripLocationId ?? null,
        thumbnail_url: thumbnailUrl,
        full_url: fullUrl,
        width: width ?? null,
        height: height ?? null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return created({ photo: data });
  } catch (error) {
    console.error('[POST /api/photos] failed', error);
    return serverError('Failed to save photo metadata.');
  }
}

