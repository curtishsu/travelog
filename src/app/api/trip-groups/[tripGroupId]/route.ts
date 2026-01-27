import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { badRequest, noContent, notFound, ok, serverError, unauthorized } from '@/lib/http';
import { tripGroupUpdateSchema } from '@/lib/schemas/trip-groups';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type PersonRow = Database['public']['Tables']['people']['Row'];
type TripGroupPeopleRow = Database['public']['Tables']['trip_group_people']['Row'] & {
  person: PersonRow | null;
};
type TripGroupRecord = Database['public']['Tables']['trip_groups']['Row'] & {
  members: TripGroupPeopleRow[];
};

function normalizeFirstName(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

function normalizeLastName(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

async function getOrCreatePersonId(
  supabase: SupabaseClient<Database>,
  userId: string,
  firstName: string,
  lastName: string | null
): Promise<string> {
  const first = firstName.trim();
  const last = lastName?.trim() ? lastName.trim() : null;

  const lookupQuery = supabase.from('people').select('id').eq('user_id', userId).ilike('first_name', first);
  if (last === null) {
    lookupQuery.is('last_name', null);
  } else {
    lookupQuery.ilike('last_name', last);
  }
  const { data: existing, error: lookupError } = await lookupQuery.maybeSingle<{ id: string }>();

  if (lookupError) {
    throw lookupError;
  }
  if (existing?.id) {
    return existing.id;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const peopleTable = supabase.from('people') as any;
  const { data: inserted, error: insertError } = await peopleTable
    .insert({
      user_id: userId,
      first_name: first,
      last_name: last
    })
    .select('id')
    .maybeSingle();

  if (insertError || !inserted) {
    if ((insertError as { code?: string })?.code === '23505') {
      const retryQuery = supabase.from('people').select('id').eq('user_id', userId).ilike('first_name', first);
      if (last === null) {
        retryQuery.is('last_name', null);
      } else {
        retryQuery.ilike('last_name', last);
      }
      const { data: retry, error: retryError } = await retryQuery.maybeSingle<{ id: string }>();
      if (retryError || !retry?.id) {
        throw retryError ?? insertError;
      }
      return retry.id;
    }
    throw insertError ?? new Error('Failed to create person.');
  }

  return (inserted as { id: string }).id;
}

async function fetchTripGroup(
  supabase: SupabaseClient<Database>,
  tripGroupId: string,
  userId: string
) {
  return supabase
    .from('trip_groups')
    .select(
      `
        *,
        members:trip_group_people(
          person:people(*)
        )
      `
    )
    .eq('id', tripGroupId)
    .eq('user_id', userId)
    .maybeSingle<TripGroupRecord>();
}

export async function GET(_: NextRequest, context: { params: { tripGroupId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await fetchTripGroup(supabase, context.params.tripGroupId, user.id);

  if (error) {
    console.error('[GET /api/trip-groups/:id] failed', error);
    return serverError('Failed to load trip group.');
  }

  if (!data) {
    return notFound('Trip group not found.');
  }

  return ok({
    group: {
      ...data,
      members: (data.members ?? []).map((member) => member.person).filter(Boolean) as PersonRow[]
    }
  });
}

export async function PATCH(request: NextRequest, context: { params: { tripGroupId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parseResult = tripGroupUpdateSchema.safeParse(body);

  if (!parseResult.success) {
    return badRequest('Invalid trip group payload', parseResult.error.flatten());
  }

  const { data: existingGroup, error: loadError } = await fetchTripGroup(
    supabase,
    context.params.tripGroupId,
    user.id
  );

  if (loadError) {
    console.error('[PATCH /api/trip-groups/:id] failed to load group', loadError);
    return serverError('Failed to update trip group.');
  }

  if (!existingGroup) {
    return notFound('Trip group not found.');
  }

  const updates: Partial<Database['public']['Tables']['trip_groups']['Row']> = {};

  try {
    if (parseResult.data.name && parseResult.data.name !== existingGroup.name) {
      updates.name = parseResult.data.name;
    }

    if (Object.keys(updates).length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripGroupsTable = supabase.from('trip_groups') as any;
      const { error: updateError } = await tripGroupsTable.update(updates).eq('id', existingGroup.id);

      if (updateError) {
        if ((updateError as { code?: string })?.code === '23505') {
          return badRequest('Trip group name must be unique.');
        }
        throw updateError;
      }
    }

    if (parseResult.data.members) {
      const memberIds: string[] = [];
      for (const member of parseResult.data.members) {
        if (member.id) {
          const { data: ownedPerson, error: ownedPersonError } = await supabase
            .from('people')
            .select('id, first_name, last_name')
            .eq('id', member.id)
            .eq('user_id', user.id)
            .maybeSingle<{ id: string; first_name: string; last_name: string | null }>();
          if (ownedPersonError) {
            throw ownedPersonError;
          }
          if (!ownedPerson?.id) {
            return badRequest('Person not found.');
          }

          const nextFirst = member.firstName !== undefined ? normalizeFirstName(member.firstName) : undefined;
          const nextLast = member.lastName !== undefined ? normalizeLastName(member.lastName) : undefined;

          const shouldUpdateName =
            (nextFirst !== undefined && nextFirst !== ownedPerson.first_name) ||
            (nextLast !== undefined && nextLast !== ownedPerson.last_name);

          if (shouldUpdateName) {
            const nameUpdates: Record<string, unknown> = {};
            if (nextFirst !== undefined) {
              if (!nextFirst) {
                return badRequest('First name is required.');
              }
              nameUpdates.first_name = nextFirst;
            }
            if (nextLast !== undefined) {
              nameUpdates.last_name = nextLast;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const peopleTable = supabase.from('people') as any;
            const { error: updatePersonError } = await peopleTable
              .update(nameUpdates)
              .eq('id', ownedPerson.id)
              .eq('user_id', user.id);

            if (updatePersonError) {
              if ((updatePersonError as { code?: string })?.code === '23505') {
                return badRequest('Person already exists.');
              }
              throw updatePersonError;
            }
          }

          memberIds.push(ownedPerson.id);
          continue;
        }

        const first = normalizeFirstName(member.firstName);
        if (!first) {
          return badRequest('First name is required.');
        }
        const last = normalizeLastName(member.lastName);
        const personId = await getOrCreatePersonId(supabase, user.id, first, last);
        memberIds.push(personId);
      }

      const uniqueMemberIds = Array.from(new Set(memberIds));
      const incoming = new Set(uniqueMemberIds);

      const existingMemberIds = new Set((existingGroup.members ?? []).map((member) => member.person_id));

      const toDelete = Array.from(existingMemberIds).filter((personId) => !incoming.has(personId));
      const toInsert = uniqueMemberIds.filter((personId) => !existingMemberIds.has(personId));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripGroupPeopleTable = supabase.from('trip_group_people') as any;

      if (toDelete.length) {
        const { error: deleteError } = await tripGroupPeopleTable
          .delete()
          .eq('trip_group_id', existingGroup.id)
          .in('person_id', toDelete);

        if (deleteError) {
          throw deleteError;
        }
      }

      if (toInsert.length) {
        const { error: insertMembersError } = await tripGroupPeopleTable.insert(
          toInsert.map((personId) => ({
            trip_group_id: existingGroup.id,
            person_id: personId
          }))
        );

        if (insertMembersError) {
          if ((insertMembersError as { code?: string })?.code === '23505') {
            return badRequest('Group members must be unique within a group.');
          }
          throw insertMembersError;
        }
      }
    }

    const { data, error: reloadError } = await fetchTripGroup(
      supabase,
      existingGroup.id,
      user.id
    );

    if (reloadError || !data) {
      throw reloadError ?? new Error('Failed to reload trip group.');
    }

    return ok({
      group: {
        ...data,
        members: (data.members ?? []).map((member) => member.person).filter(Boolean) as PersonRow[]
      }
    });
  } catch (error) {
    console.error('[PATCH /api/trip-groups/:id] failed', error);
    return serverError('Failed to update trip group.');
  }
}

export async function DELETE(_: NextRequest, context: { params: { tripGroupId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { error } = await supabase
    .from('trip_groups')
    .delete()
    .eq('id', context.params.tripGroupId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[DELETE /api/trip-groups/:id] failed', error);
    return serverError('Failed to delete trip group.');
  }

  return noContent();
}



