import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { badRequest, created, ok, serverError, unauthorized } from '@/lib/http';
import { tripGroupCreateSchema } from '@/lib/schemas/trip-groups';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripGroupRecord = Database['public']['Tables']['trip_groups']['Row'] & {
  members: Database['public']['Tables']['trip_group_members']['Row'][];
};
type TripGroupMemberInsert = Database['public']['Tables']['trip_group_members']['Insert'];

function normalizeMemberName(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
}

function buildMemberKey(first: string | null, last: string | null) {
  const firstKey = (first ?? '').trim().toLowerCase();
  const lastKey = (last ?? '').trim().toLowerCase();
  return `${firstKey}|${lastKey}`;
}

async function fetchTripGroup(
  supabase: SupabaseClient<Database>,
  groupId: string,
  userId: string
) {
  return supabase
    .from('trip_groups')
    .select(
      `
        *,
        members:trip_group_members(*)
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
        members:trip_group_members(*)
      `
    )
    .eq('user_id', user.id)
    .order('name', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GET /api/trip-groups] failed', error);
    return serverError('Failed to load trip groups.');
  }

  return ok({
    groups: (data ?? []) as TripGroupRecord[]
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

  const normalizedMembers = parseResult.data.members
    .map((member) => ({
      first_name: normalizeMemberName(member.firstName),
      last_name: normalizeMemberName(member.lastName)
    }))
    .filter((member) => member.first_name || member.last_name);

  const seen = new Set<string>();
  const dedupedMembers = normalizedMembers.filter((member) => {
    const key = buildMemberKey(member.first_name, member.last_name);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

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

    if (dedupedMembers.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tripGroupMembersTable = supabase.from('trip_group_members') as any;
      const memberRows: TripGroupMemberInsert[] = dedupedMembers.map((member) => ({
        trip_group_id: insertedGroup.id,
        first_name: member.first_name,
        last_name: member.last_name
      }));

      const { error: membersError } = await tripGroupMembersTable.insert(memberRows);

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

    return created({ group: data });
  } catch (error) {
    console.error('[POST /api/trip-groups] failed', error);
    return serverError('Failed to create trip group.');
  }
}


