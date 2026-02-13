import { NextRequest } from 'next/server';

import { badRequest, created, ok, serverError, unauthorized } from '@/lib/http';
import { tripGroupCreateSchema } from '@/lib/schemas/trip-groups';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { RequestSupabaseClient } from '@/lib/supabase/context';
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
  supabase: RequestSupabaseClient,
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
      // Race: unique constraint - reselect.
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
  supabase: RequestSupabaseClient,
  groupId: string,
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
    .eq('id', groupId)
    .eq('user_id', userId)
    .maybeSingle<TripGroupRecord>();
}

export async function GET(_: NextRequest) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('trip_groups')
    .select(
      `
        *,
        members:trip_group_people(
          person:people(*)
        )
      `
    )
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GET /api/trip-groups] failed', error);
    return serverError('Failed to load trip groups.');
  }

  const groups = ((data ?? []) as TripGroupRecord[]).map((group) => ({
    ...group,
    members: (group.members ?? []).map((member) => member.person).filter(Boolean) as PersonRow[]
  }));

  return ok({
    groups
  });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parseResult = tripGroupCreateSchema.safeParse(body);

  if (!parseResult.success) {
    return badRequest('Invalid trip group payload', parseResult.error.flatten());
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tripGroupsTable = supabase.from('trip_groups') as any;
    const {
      data: insertedGroup,
      error: insertError
    } = await tripGroupsTable
      .insert({
        user_id: user.id,
        name: parseResult.data.name
      })
      .select('id')
      .maybeSingle();

    if (insertError || !insertedGroup) {
      if ((insertError as { code?: string })?.code === '23505') {
        return badRequest('Trip group name must be unique.');
      }
      throw insertError ?? new Error('Failed to create trip group');
    }

    const memberIds: string[] = [];
    for (const member of parseResult.data.members) {
      if (member.id) {
        const { data: ownedPerson, error: ownedPersonError } = await supabase
          .from('people')
          .select('id')
          .eq('id', member.id)
          .eq('user_id', user.id)
          .maybeSingle<{ id: string }>();
        if (ownedPersonError) {
          throw ownedPersonError;
        }
        if (!ownedPerson?.id) {
          return badRequest('Person not found.');
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

    if (uniqueMemberIds.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripGroupPeopleTable = supabase.from('trip_group_people') as any;
      const { error: membersError } = await tripGroupPeopleTable.insert(
        uniqueMemberIds.map((personId) => ({
          trip_group_id: insertedGroup.id,
          person_id: personId
        }))
      );

      if (membersError) {
        if ((membersError as { code?: string })?.code === '23505') {
          return badRequest('Group members must be unique within a group.');
        }
        throw membersError;
      }
    }

    const { data, error } = await fetchTripGroup(supabase, insertedGroup.id, user.id);

    if (error || !data) {
      throw error ?? new Error('Failed to load trip group after creation.');
    }

    return created({
      group: {
        ...data,
        members: (data.members ?? []).map((member) => member.person).filter(Boolean) as PersonRow[]
      }
    });
  } catch (error) {
    console.error('[POST /api/trip-groups] failed', error);
    return serverError('Failed to create trip group.');
  }
}


