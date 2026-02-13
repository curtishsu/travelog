import { NextRequest } from 'next/server';

import { getDateRange, getTripDuration, toISODate } from '@/lib/date';
import { badRequest, noContent, notFound, ok, serverError, unauthorized } from '@/lib/http';
import { tripUpdateSchema } from '@/lib/schemas/trips';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { RequestSupabaseClient } from '@/lib/supabase/context';
import { deriveTripStatus } from '@/lib/trips/status';
import { normalizeTripDetail } from '@/features/trips/privacy';
import type { TripDetail } from '@/features/trips/types';
import type { Database } from '@/types/database';

type TripDayInsert = Database['public']['Tables']['trip_days']['Insert'];
type TripLinkInsert = Database['public']['Tables']['trip_links']['Insert'];
type TripTypeInsert = Database['public']['Tables']['trip_types']['Insert'];

type PersonRow = Database['public']['Tables']['people']['Row'];
type TripGroupWithMembers = Database['public']['Tables']['trip_groups']['Row'] & {
  members: Array<{ person: PersonRow | null }>;
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

function normalizeTripApiResponse(trip: TripDetail): TripDetail {
  const group = trip.trip_group
    ? {
        ...trip.trip_group,
        members: ((trip.trip_group as unknown as { members?: Array<{ person: PersonRow | null }> }).members ?? [])
          .map((member) => member.person)
          .filter(Boolean) as PersonRow[]
      }
    : null;

  return {
    ...trip,
    trip_group: group
  };
}

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
        ),
        trip_group:trip_groups!trips_trip_group_id_fkey(
          *,
          members:trip_group_people(
            person:people(*)
          )
        ),
        trip_companion_groups(
          trip_group_id
        ),
        trip_companion_people(
          person_id
        )
      `
    )
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return notFound('Trip not found');
  }

  const trip = normalizeTripApiResponse(normalizeTripDetail(data as TripDetail));

  return ok({ trip });
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
  const shouldUpdateCompanionGroups =
    parseResult.data.companionGroupIds !== undefined || parseResult.data.tripGroupId !== undefined;
  const shouldUpdateCompanionPeople = parseResult.data.companionPersonIds !== undefined;

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

  if (parseResult.data.isTripContentLocked !== undefined) {
    updates.is_trip_content_locked = parseResult.data.isTripContentLocked;
  }

  if (parseResult.data.isReflectionLocked !== undefined) {
    updates.is_reflection_locked = parseResult.data.isReflectionLocked;
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
      const dayRows: TripDayInsert[] = datesToAdd.map((date, index) => ({
        trip_id: tripId,
        date,
        // Use placeholder indices higher than any existing day to avoid unique constraint conflicts.
        day_index: placeholderStartIndex + index
      }));
      relatedUpdateTasks.push(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tripDaysTable = supabase.from('trip_days') as any;
        const { error } = await tripDaysTable.insert(dayRows);
        if (error) {
          throw error;
        }
      });
    }

    if (daysToRemove.length) {
      relatedUpdateTasks.push(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tripDaysTable = supabase.from('trip_days') as any;
        const { error } = await tripDaysTable
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripLinksTable = supabase.from('trip_links') as any;
      const { error } = await tripLinksTable.delete().eq('trip_id', tripId);
      if (error) {
        throw error;
      }
      if (!parseResult.data.links?.length) {
        return;
      }
      const linkRows: TripLinkInsert[] = parseResult.data.links.map((link) => ({
        trip_id: tripId,
        label: link.label,
        url: link.url
      }));
      const { error: insertLinksError } = await tripLinksTable.insert(linkRows);
      if (insertLinksError) {
        throw insertLinksError;
      }
    });
  }

  if (parseResult.data.tripTypes) {
    relatedUpdateTasks.push(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripTypesTable = supabase.from('trip_types') as any;
      const { error } = await tripTypesTable.delete().eq('trip_id', tripId);
      if (error) {
        throw error;
      }
      if (!parseResult.data.tripTypes?.length) {
        return;
      }
      const typeRows: TripTypeInsert[] = parseResult.data.tripTypes.map((type) => ({
        trip_id: tripId,
        type
      }));
      const { error: insertTypeError } = await tripTypesTable.insert(typeRows);
      if (insertTypeError) {
        throw insertTypeError;
      }
    });
  }

  if (shouldUpdateCompanionGroups) {
    let desiredGroupIds: string[] = [];

    if (parseResult.data.companionGroupIds !== undefined) {
      desiredGroupIds = parseResult.data.companionGroupIds;
    } else if (parseResult.data.tripGroupId !== undefined) {
      desiredGroupIds = parseResult.data.tripGroupId ? [parseResult.data.tripGroupId] : [];
    }

    if (parseResult.data.tripGroupId && parseResult.data.companionGroupIds !== undefined) {
      desiredGroupIds = [...desiredGroupIds, parseResult.data.tripGroupId];
    }

    desiredGroupIds = Array.from(new Set(desiredGroupIds));

    if (desiredGroupIds.length) {
      const { data: ownedGroups, error: groupError } = await supabase
        .from('trip_groups')
        .select('id')
        .eq('user_id', userId)
        .in('id', desiredGroupIds);
      if (groupError) {
        console.error('[PATCH /api/trips/:id] failed to verify trip groups', groupError);
        return serverError('Failed to update trip.');
      }
      const ownedGroupIds = new Set((ownedGroups ?? []).map((row) => (row as { id: string }).id));
      const missing = desiredGroupIds.find((id) => !ownedGroupIds.has(id));
      if (missing) {
        return badRequest('Trip group not found.');
      }
    }

    relatedUpdateTasks.push(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripCompanionGroupsTable = supabase.from('trip_companion_groups') as any;
      const { data: existingRows, error: existingError } = await tripCompanionGroupsTable
        .select('trip_group_id')
        .eq('trip_id', tripId);
      if (existingError) {
        throw existingError;
      }
      const existingIds = new Set<string>(
        (existingRows ?? []).map((row: { trip_group_id: string }) => row.trip_group_id)
      );
      const desiredIds = new Set(desiredGroupIds);

      const toDelete = Array.from(existingIds).filter((id) => !desiredIds.has(id));
      const toInsert = desiredGroupIds.filter((id) => !existingIds.has(id));

      if (toDelete.length) {
        const { error: deleteError } = await tripCompanionGroupsTable
          .delete()
          .eq('trip_id', tripId)
          .in('trip_group_id', toDelete);
        if (deleteError) {
          throw deleteError;
        }
      }

      if (toInsert.length) {
        const { error: insertError } = await tripCompanionGroupsTable.insert(
          toInsert.map((groupId: string) => ({
            trip_id: tripId,
            trip_group_id: groupId
          }))
        );
        if (insertError) {
          throw insertError;
        }
      }
    });

    updates.trip_group_id = desiredGroupIds.length === 1 ? desiredGroupIds[0] : null;
  }

  if (shouldUpdateCompanionPeople) {
    const desiredPersonIds = Array.from(new Set(parseResult.data.companionPersonIds ?? []));

    if (desiredPersonIds.length) {
      const { data: ownedPeople, error: peopleError } = await supabase
        .from('people')
        .select('id')
        .eq('user_id', userId)
        .in('id', desiredPersonIds);
      if (peopleError) {
        console.error('[PATCH /api/trips/:id] failed to verify people', peopleError);
        return serverError('Failed to update trip.');
      }
      const ownedPersonIds = new Set((ownedPeople ?? []).map((row) => (row as { id: string }).id));
      const missing = desiredPersonIds.find((id) => !ownedPersonIds.has(id));
      if (missing) {
        return badRequest('Person not found.');
      }
    }

    relatedUpdateTasks.push(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripCompanionPeopleTable = supabase.from('trip_companion_people') as any;
      const { data: existingRows, error: existingError } = await tripCompanionPeopleTable
        .select('person_id')
        .eq('trip_id', tripId);
      if (existingError) {
        throw existingError;
      }
      const existingIds = new Set<string>(
        (existingRows ?? []).map((row: { person_id: string }) => row.person_id)
      );
      const desiredIds = new Set(desiredPersonIds);

      const toDelete = Array.from(existingIds).filter((id) => !desiredIds.has(id));
      const toInsert = desiredPersonIds.filter((id) => !existingIds.has(id));

      if (toDelete.length) {
        const { error: deleteError } = await tripCompanionPeopleTable
          .delete()
          .eq('trip_id', tripId)
          .in('person_id', toDelete);
        if (deleteError) {
          throw deleteError;
        }
      }

      if (toInsert.length) {
        const { error: insertError } = await tripCompanionPeopleTable.insert(
          toInsert.map((personId: string) => ({
            trip_id: tripId,
            person_id: personId
          }))
        );
        if (insertError) {
          throw insertError;
        }
      }
    });
  }

  const hasTripUpdates = Object.keys(updates).length > 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tripsTable = supabase.from('trips') as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tripDaysTable = supabase.from('trip_days') as any;
    if (hasTripUpdates) {
      const { error: tripUpdateError } = await tripsTable.update(updates).eq('id', tripId);
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
        const typedRefreshedDays = refreshedDays as Array<
          Pick<Database['public']['Tables']['trip_days']['Row'], 'id' | 'date' | 'trip_id'>
        >;
        const dayIndexUpdates = newDateRange.map((date, index) => {
          const day = typedRefreshedDays.find((d) => d.date === date);
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

          const { error: tempUpdateError } = await tripDaysTable.upsert(tempIndexUpdates, {
            onConflict: 'id'
          });
          if (tempUpdateError) {
            throw tempUpdateError;
          }

          const { error: dayIndexError } = await tripDaysTable.upsert(filteredUpdates, {
            onConflict: 'id'
          });
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

    const trip = normalizeTripApiResponse(normalizeTripDetail(updatedTrip as unknown as TripDetail));

    return ok({
      trip,
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
  supabase: RequestSupabaseClient,
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
        trip_group:trip_groups!trips_trip_group_id_fkey(
          *,
          members:trip_group_people(
            person:people(*)
          )
        ),
        trip_companion_groups(
          trip_group_id
        ),
        trip_companion_people(
          person_id
        )
      `
    )
    .eq('id', tripId)
    .eq('user_id', userId)
    .maybeSingle<TripWithRelations>();

  return response;
}

async function detectTripOverlap(
  supabase: RequestSupabaseClient,
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

