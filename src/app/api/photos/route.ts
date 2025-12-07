import { NextRequest } from 'next/server';

import { badRequest, created, serverError, unauthorized } from '@/lib/http';
import { photoCreateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripDayRow = Database['public']['Tables']['trip_days']['Row'];
type TripRow = Database['public']['Tables']['trips']['Row'];
type PhotoRow = Database['public']['Tables']['photos']['Row'];

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
    .maybeSingle<Pick<TripDayRow, 'id' | 'trip_id'>>();

  if (tripDayError || !tripDay) {
    return badRequest('Trip day not found.');
  }

  const { data: owningTrip, error: tripOwnershipError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripDay.trip_id)
    .single<Pick<TripRow, 'user_id'>>();

  if (tripOwnershipError || owningTrip?.user_id !== userId) {
    return unauthorized();
  }

  if (tripDay.trip_id !== tripId) {
    return badRequest('Photo trip reference mismatch.');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photosTable = supabase.from('photos') as any;

    const { data, error } = await photosTable
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

    const typedPhoto = data as PhotoRow | null;

    if (error) {
      throw error;
    }

    return created({ photo: typedPhoto });
  } catch (error) {
    console.error('[POST /api/photos] failed', error);
    return serverError('Failed to save photo metadata.');
  }
}

