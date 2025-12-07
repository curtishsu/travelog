import { NextRequest } from 'next/server';

import { noContent, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type Params = { params: { locationId: string } };

type TripLocationRow = Database['public']['Tables']['trip_locations']['Row'];
type TripDayRow = Database['public']['Tables']['trip_days']['Row'];
type TripRow = Database['public']['Tables']['trips']['Row'];

export async function DELETE(_: NextRequest, { params }: Params) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;
  const { locationId } = params;

  const { data: location, error: fetchError } = await supabase
    .from('trip_locations')
    .select('trip_day_id')
    .eq('id', locationId)
    .maybeSingle<Pick<TripLocationRow, 'trip_day_id'>>();

  if (fetchError) {
    return serverError('Failed to load location.');
  }

  if (!location) {
    return noContent();
  }

  const { data: tripDay, error: tripDayError } = await supabase
    .from('trip_days')
    .select('trip_id')
    .eq('id', location.trip_day_id)
    .maybeSingle<Pick<TripDayRow, 'trip_id'>>();

  if (tripDayError || !tripDay) {
    return unauthorized();
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripDay.trip_id)
    .single<Pick<TripRow, 'user_id'>>();

  if (tripError || trip?.user_id !== userId) {
    return unauthorized();
  }

  const { error } = await supabase.from('trip_locations').delete().eq('id', locationId);

  if (error) {
    return serverError('Failed to delete location.');
  }

  return noContent();
}

