import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { badRequest, noContent, notFound, ok, serverError, unauthorized } from '@/lib/http';
import { tripGroupUpdateSchema } from '@/lib/schemas/trip-groups';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripGroupRecord = Database['public']['Tables']['trip_groups']['Row'] & {
  members: Database['public']['Tables']['trip_group_members']['Row'][];
};

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
  tripGroupId: string,
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

  return ok({ group: data });
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
      const { error: updateError } = await supabase
        .from('trip_groups')
        .update(updates)
        .eq('id', existingGroup.id);

      if (updateError) {
        if ((updateError as { code?: string })?.code === '23505') {
          return badRequest('Trip group name must be unique.');
        }
        throw updateError;
      }
    }

    if (parseResult.data.members) {
      const normalizedMembers = parseResult.data.members
        .map((member) => ({
          id: member.id ?? null,
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

      const existingMembersMap = new Map(
        (existingGroup.members ?? []).map((member) => [member.id, member])
      );

      const incomingIds = new Set(
        dedupedMembers.filter((member) => member.id).map((member) => member.id as string)
      );

      const membersToDelete = (existingGroup.members ?? [])
        .filter((member) => !incomingIds.has(member.id))
        .map((member) => member.id);

      if (membersToDelete.length) {
        const { error: deleteError } = await supabase
          .from('trip_group_members')
          .delete()
          .in('id', membersToDelete);

        if (deleteError) {
          throw deleteError;
        }
      }

      const membersToUpdate = dedupedMembers
        .filter((member) => member.id)
        .map((member) => member as { id: string; first_name: string | null; last_name: string | null })
        .filter((member) => {
          const existing = existingMembersMap.get(member.id);
          if (!existing) {
            return false;
          }
          return (
            existing.first_name !== member.first_name || existing.last_name !== member.last_name
          );
        });

      if (membersToUpdate.length) {
        const { error: updateMembersError } = await supabase.from('trip_group_members').upsert(
          membersToUpdate.map((member) => ({
            id: member.id,
            trip_group_id: existingGroup.id,
            first_name: member.first_name,
            last_name: member.last_name
          }))
        );

        if (updateMembersError) {
          if ((updateMembersError as { code?: string })?.code === '23505') {
            return badRequest('Group members must be unique within a group.');
          }
          throw updateMembersError;
        }
      }

      const membersToInsert = dedupedMembers.filter((member) => !member.id);

      if (membersToInsert.length) {
        const { error: insertMembersError } = await supabase.from('trip_group_members').insert(
          membersToInsert.map((member) => ({
            trip_group_id: existingGroup.id,
            first_name: member.first_name,
            last_name: member.last_name
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

    return ok({ group: data });
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



