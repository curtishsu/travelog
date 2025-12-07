import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getDateRange, getTripDuration, toISODate } from '@/lib/date';
import { badRequest, created, ok, serverError, unauthorized } from '@/lib/http';
import { tripCreateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripDayInsert = Database['public']['Tables']['trip_days']['Insert'];
type TripLinkInsert = Database['public']['Tables']['trip_links']['Insert'];
type TripTypeInsert = Database['public']['Tables']['trip_types']['Insert'];

export async function GET() {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

  const { data, error } = await supabase
    .from('trips')
    .select(
      `
        id,
        name,
        start_date,
        end_date,
        status,
        created_at,
        updated_at,
        trip_types(type),
        trip_days(
          id,
          day_index,
          trip_day_hashtags(
            hashtag
          )
        )
      `
    )
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .order('day_index', { foreignTable: 'trip_days', ascending: true });

  if (error) {
    return serverError('Failed to fetch trips.');
  }

  return ok({ trips: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsedResult = tripCreateSchema.safeParse(body);

  if (!parsedResult.success) {
    return badRequest('Invalid trip payload', parsedResult.error.flatten());
  }

  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

  const { name, startDate, endDate, links, tripTypes, tripGroupId } = parsedResult.data;

  const startDateISO = toISODate(startDate);
  const endDateISO = toISODate(endDate);
  const duration = getTripDuration(startDateISO, endDateISO);

  if (duration > 365) {
    return badRequest('Trip cannot exceed 365 days.');
  }

  try {
    let resolvedTripGroupId: string | null = null;

    if (tripGroupId) {
      const { data: ownedGroup, error: groupError } = await supabase
        .from('trip_groups')
        .select('id')
        .eq('id', tripGroupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (groupError) {
        console.error('[POST /api/trips] failed to verify trip group', groupError);
        return serverError('Failed to create trip.');
      }

      const typedOwnedGroup = ownedGroup as { id: string } | null;

      if (!typedOwnedGroup) {
        return badRequest('Trip group not found.');
      }

      resolvedTripGroupId = typedOwnedGroup.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tripsTable = supabase.from('trips') as any;
    const { data: insertedTrips, error: insertTripError } = await tripsTable
      .insert({
        user_id: userId,
        name,
        start_date: startDateISO,
        end_date: endDateISO,
        status: 'draft',
        trip_group_id: resolvedTripGroupId
      })
      .select()
      .single();

    if (insertTripError || !insertedTrips) {
      if ((insertTripError as { code?: string })?.code === '23505') {
        return badRequest('Trip name must be unique.');
      }
      throw insertTripError;
    }

    const dayRange = getDateRange(startDateISO, endDateISO);
    const dayRows: TripDayInsert[] = dayRange.map((date, index) => ({
      trip_id: insertedTrips.id,
      day_index: index + 1,
      date
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tripDaysTable = supabase.from('trip_days') as any;
    const { error: insertDaysError } = await tripDaysTable.insert(dayRows);
    if (insertDaysError) {
      throw insertDaysError;
    }

    if (links?.length) {
      const linkRows: TripLinkInsert[] = links.map((link) => ({
        trip_id: insertedTrips.id,
        label: link.label,
        url: link.url
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripLinksTable = supabase.from('trip_links') as any;
      const { error: linkError } = await tripLinksTable.insert(linkRows);
      if (linkError) {
        throw linkError;
      }
    }

    if (tripTypes?.length) {
      const typeRows: TripTypeInsert[] = tripTypes.map((type) => ({
        trip_id: insertedTrips.id,
        type
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripTypesTable = supabase.from('trip_types') as any;
      const { error: typeError } = await tripTypesTable.insert(typeRows);
      if (typeError) {
        throw typeError;
      }
    }

    const overlapWarning = await detectTripOverlap(
      supabase,
      userId,
      startDateISO,
      endDateISO,
      insertedTrips.id
    );

    return created({
      trip: insertedTrips,
      overlapWarning
    });
  } catch (error) {
    console.error('[POST /api/trips] failed', error);
    return serverError('Failed to create trip.');
  }
}

async function detectTripOverlap(
  supabase: SupabaseClient<Database>,
  userId: string,
  startDateISO: string,
  endDateISO: string,
  excludeTripId?: string
) {
  const query = supabase
    .from('trips')
    .select('id,name,start_date,end_date')
    .eq('user_id', userId)
    .lte('start_date', endDateISO)
    .gte('end_date', startDateISO);

  if (excludeTripId) {
    query.neq('id', excludeTripId);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    return null;
  }

  return {
    message: 'This trip overlaps with other trips.',
    overlaps: data
  };
}

