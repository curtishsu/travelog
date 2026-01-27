import { NextRequest } from 'next/server';

import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/http';
import { personUpdateSchema } from '@/lib/schemas/people';
import { getSupabaseForRequest } from '@/lib/supabase/context';

export async function GET(_: NextRequest, context: { params: { personId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('id', context.params.personId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[GET /api/people/:id] failed', error);
    return serverError('Failed to load person.');
  }

  if (!data) {
    return notFound('Person not found.');
  }

  return ok({ person: data });
}

export async function PATCH(request: NextRequest, context: { params: { personId: string } }) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parseResult = personUpdateSchema.safeParse(body);
  if (!parseResult.success) {
    return badRequest('Invalid person payload', parseResult.error.flatten());
  }

  const { data: existing, error: loadError } = await supabase
    .from('people')
    .select('id')
    .eq('id', context.params.personId)
    .eq('user_id', user.id)
    .maybeSingle<{ id: string }>();

  if (loadError) {
    console.error('[PATCH /api/people/:id] failed to load person', loadError);
    return serverError('Failed to update person.');
  }

  if (!existing) {
    return notFound('Person not found.');
  }

  const updates: Record<string, unknown> = {};
  if (parseResult.data.firstName !== undefined) {
    updates.first_name = parseResult.data.firstName;
  }
  if (parseResult.data.lastName !== undefined) {
    updates.last_name = parseResult.data.lastName;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const peopleTable = supabase.from('people') as any;
    const { data, error } = await peopleTable.update(updates).eq('id', existing.id).select('*').maybeSingle();

    if (error || !data) {
      if ((error as { code?: string })?.code === '23505') {
        return badRequest('Person already exists.');
      }
      throw error ?? new Error('Failed to update person');
    }

    return ok({ person: data });
  } catch (error) {
    console.error('[PATCH /api/people/:id] failed', error);
    return serverError('Failed to update person.');
  }
}

