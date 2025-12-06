import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getDateRange, getTripDuration, toISODate } from '@/lib/date';
import { badRequest, created, ok, serverError, unauthorized } from '@/lib/http';
import { tripCreateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

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

      if (!ownedGroup) {
        return badRequest('Trip group not found.');
      }

      resolvedTripGroupId = ownedGroup.id;
    }

    const { data: insertedTrips, error: insertTripError } = await supabase
      .from('trips')
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
    const dayRows = dayRange.map((date, index) => ({
      trip_id: insertedTrips.id,
      day_index: index + 1,
      date
    }));

    const { error: insertDaysError } = await supabase.from('trip_days').insert(dayRows);
    if (insertDaysError) {
      throw insertDaysError;
    }

    if (links?.length) {
      const linkRows = links.map((link) => ({
        trip_id: insertedTrips.id,
        label: link.label,
        url: link.url
      }));
      const { error: linkError } = await supabase.from('trip_links').insert(linkRows);
      if (linkError) {
        throw linkError;
      }
    }

    if (tripTypes?.length) {
      const typeRows = tripTypes.map((type) => ({
        trip_id: insertedTrips.id,
        type
      }));
      const { error: typeError } = await supabase.from('trip_types').insert(typeRows);
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

