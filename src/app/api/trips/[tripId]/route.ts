import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getDateRange, getTripDuration, toISODate } from '@/lib/date';
import { badRequest, noContent, notFound, ok, serverError, unauthorized } from '@/lib/http';
import { tripUpdateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import { deriveTripStatus } from '@/lib/trips/status';
import type { Database } from '@/types/database';

type TripGroupWithMembers =
  Database['public']['Tables']['trip_groups']['Row'] & {
    trip_group_members: Database['public']['Tables']['trip_group_members']['Row'][];
  };

type TripWithRelations = Database['public']['Tables']['trips']['Row'] & {
  trip_links: Database['public']['Tables']['trip_links']['Row'][];
  trip_types: Database['public']['Tables']['trip_types']['Row'][];
  trip_days: Array<
    Database['public']['Tables']['trip_days']['Row'] & {
      trip_locations: Database['public']['Tables']['trip_locations']['Row'][];
      photos: Database['public']['Tables']['photos']['Row'][];
      trip_day_hashtags: Database['public']['Tables']['trip_day_hashtags']['Row'][];
    }
  >;
  trip_group: TripGroupWithMembers | null;
};

export async function GET(_: NextRequest, context: { params: { tripId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { tripId } = context.params;

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
          trip_day_hashtags(*)
        )
      `
    )
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return notFound('Trip not found');
  }

  return ok({ trip: data });
}

export async function PATCH(request: NextRequest, context: { params: { tripId: string } }) {
  const body = await request.json();
  const parseResult = tripUpdateSchema.safeParse(body);

  if (!parseResult.success) {
    return badRequest('Invalid trip update payload', parseResult.error.flatten());
  }

  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;
  const { tripId } = context.params;
  const { data: existingTrip, error: fetchError } = await getTripWithRelations(
    supabase,
    tripId,
    userId
  );

  if (fetchError) {
    return serverError('Failed to load trip for update.');
  }

  if (!existingTrip) {
    return notFound('Trip not found');
  }

  const updates: Partial<Database['public']['Tables']['trips']['Row']> = {};
  if (parseResult.data.tripGroupId !== undefined) {
    if (parseResult.data.tripGroupId === null) {
      updates.trip_group_id = null;
    } else {
      const { data: ownedGroup, error: groupError } = await supabase
        .from('trip_groups')
        .select('id')
        .eq('id', parseResult.data.tripGroupId)
        .eq('user_id', userId)
        .maybeSingle();

      if (groupError) {
        console.error('[PATCH /api/trips/:id] failed to verify trip group', groupError);
        return serverError('Failed to update trip.');
      }

      if (!ownedGroup) {
        return badRequest('Trip group not found.');
      }

      updates.trip_group_id = ownedGroup.id;
    }
  }

  const requestedStartDateISO = parseResult.data.startDate
    ? toISODate(parseResult.data.startDate)
    : null;
  const requestedEndDateISO = parseResult.data.endDate ? toISODate(parseResult.data.endDate) : null;

  const startDateISO = requestedStartDateISO ?? existingTrip.start_date;
  const endDateISO = requestedEndDateISO ?? existingTrip.end_date;

  if (parseResult.data.name && parseResult.data.name !== existingTrip.name) {
    updates.name = parseResult.data.name;
  }

  if (parseResult.data.reflection !== undefined) {
    updates.reflection = parseResult.data.reflection;
  }

  const relatedUpdateTasks: Array<() => Promise<void>> = [];
  let newDateRange: string[] | null = null;

  if (requestedStartDateISO || requestedEndDateISO) {
    const duration = getTripDuration(startDateISO, endDateISO);
    if (duration > 365) {
      return badRequest('Trip cannot exceed 365 days.');
    }

    if (startDateISO > endDateISO) {
      return badRequest('endDate must be after startDate.');
    }

    updates.start_date = startDateISO;
    updates.end_date = endDateISO;

    newDateRange = getDateRange(startDateISO, endDateISO);
    const existingDatesMap = new Map(existingTrip.trip_days.map((day) => [day.date, day]));

    const datesToAdd = newDateRange.filter((date) => !existingDatesMap.has(date));
    const daysToRemove = existingTrip.trip_days.filter((day) => !newDateRange!.includes(day.date));

    if (daysToRemove.length) {
      const daysWithContent = daysToRemove.filter((day) => {
        const hasText = Boolean(day.highlight?.trim() || day.journal_entry?.trim());
        const hasLocations = day.trip_locations?.length > 0;
        const hasPhotos = day.photos?.length > 0;
        const hasHashtags = day.trip_day_hashtags?.length > 0;
        return hasText || hasLocations || hasPhotos || hasHashtags;
      });

      if (daysWithContent.length) {
        return badRequest('Cannot shrink trip dates because removed days contain content.', {
          daysWithContent: daysWithContent.map((day) => day.date)
        });
      }
    }

    if (datesToAdd.length) {
      const placeholderStartIndex = existingTrip.trip_days.length + 1;
      const dayRows = datesToAdd.map((date, index) => ({
        trip_id: tripId,
        date,
        // Use placeholder indices higher than any existing day to avoid unique constraint conflicts.
        day_index: placeholderStartIndex + index
      }));
      relatedUpdateTasks.push(async () => {
        const { error } = await supabase.from('trip_days').insert(dayRows);
        if (error) {
          throw error;
        }
      });
    }

    if (daysToRemove.length) {
      relatedUpdateTasks.push(async () => {
        const { error } = await supabase
          .from('trip_days')
          .delete()
          .in(
            'id',
            daysToRemove.map((day) => day.id)
          );
        if (error) {
          throw error;
        }
      });
    }
  }

  const nextStatus = deriveTripStatus(startDateISO, endDateISO);
  if (nextStatus !== existingTrip.status) {
    updates.status = nextStatus;
  }

  if (parseResult.data.links) {
    relatedUpdateTasks.push(async () => {
      const { error } = await supabase.from('trip_links').delete().eq('trip_id', tripId);
      if (error) {
        throw error;
      }
      if (!parseResult.data.links?.length) {
        return;
      }
      const linkRows = parseResult.data.links.map((link) => ({
        trip_id: tripId,
        label: link.label,
        url: link.url
      }));
      const { error: insertLinksError } = await supabase.from('trip_links').insert(linkRows);
      if (insertLinksError) {
        throw insertLinksError;
      }
    });
  }

  if (parseResult.data.tripTypes) {
    relatedUpdateTasks.push(async () => {
      const { error } = await supabase.from('trip_types').delete().eq('trip_id', tripId);
      if (error) {
        throw error;
      }
      if (!parseResult.data.tripTypes?.length) {
        return;
      }
      const typeRows = parseResult.data.tripTypes.map((type) => ({
        trip_id: tripId,
        type
      }));
      const { error: insertTypeError } = await supabase.from('trip_types').insert(typeRows);
      if (insertTypeError) {
        throw insertTypeError;
      }
    });
  }

  const hasTripUpdates = Object.keys(updates).length > 0;

  try {
    if (hasTripUpdates) {
      const { error: tripUpdateError } = await supabase.from('trips').update(updates).eq('id', tripId);
      if (tripUpdateError) {
        if ((tripUpdateError as { code?: string })?.code === '23505') {
          return badRequest('Trip name must be unique.');
        }
        throw tripUpdateError;
      }
    }

    if (relatedUpdateTasks.length) {
      await Promise.all(relatedUpdateTasks.map((task) => task()));
    }

    if (newDateRange) {
      const { data: refreshedDays, error: refreshError } = await supabase
        .from('trip_days')
        .select('id,date,trip_id')
        .eq('trip_id', tripId);

      if (refreshError) {
        throw refreshError;
      }

      if (refreshedDays) {
        const dayIndexUpdates = newDateRange.map((date, index) => {
          const day = refreshedDays.find((d) => d.date === date);
          if (!day) {
            return null;
          }
          return { id: day.id, trip_id: day.trip_id, date: day.date, day_index: index + 1 };
        });

        const filteredUpdates = dayIndexUpdates.filter(
          (row): row is { id: string; trip_id: string; date: string; day_index: number } => Boolean(row)
        );
        if (filteredUpdates.length) {
          const TEMP_OFFSET = 1000;
          const tempIndexUpdates = filteredUpdates.map((row) => ({
            id: row.id,
            trip_id: row.trip_id,
            date: row.date,
            day_index: row.day_index + TEMP_OFFSET
          }));

          const { error: tempUpdateError } = await supabase
            .from('trip_days')
            .upsert(tempIndexUpdates, { onConflict: 'id' });
          if (tempUpdateError) {
            throw tempUpdateError;
          }

          const { error: dayIndexError } = await supabase
            .from('trip_days')
            .upsert(filteredUpdates, { onConflict: 'id' });
          if (dayIndexError) {
            throw dayIndexError;
          }
        }
      }
    }

    const overlapWarning = await detectTripOverlap(
      supabase,
      userId,
      startDateISO,
      endDateISO,
      tripId
    );

    const { data: updatedTrip, error: reloadError } = await getTripWithRelations(
      supabase,
      tripId,
      userId
    );
    if (reloadError || !updatedTrip) {
      throw reloadError ?? new Error('Failed to reload trip after update.');
    }

    return ok({
      trip: updatedTrip,
      overlapWarning
    });
  } catch (error) {
    console.error('[PATCH /api/trips/:id] failed', error);
    return serverError('Failed to update trip.');
  }
}

export async function DELETE(_: NextRequest, context: { params: { tripId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { tripId } = context.params;

  const { error } = await supabase.from('trips').delete().eq('id', tripId);

  if (error) {
    return serverError('Failed to delete trip.');
  }

  return noContent();
}

async function getTripWithRelations(
  supabase: SupabaseClient<Database>,
  tripId: string,
  userId: string
) {
  const response = await supabase
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
    .eq('user_id', userId)
    .maybeSingle<TripWithRelations>();

  return response;
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

