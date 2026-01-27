import { NextRequest } from 'next/server';

import { badRequest, created, ok, serverError, unauthorized } from '@/lib/http';
import { personCreateSchema } from '@/lib/schemas/people';
import { getSupabaseForRequest } from '@/lib/supabase/context';

export async function GET(_: NextRequest) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await supabase
    .from('people')
    .select('*')
    .eq('user_id', user.id)
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[GET /api/people] failed', error);
    return serverError('Failed to load people.');
  }

  return ok({ people: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parseResult = personCreateSchema.safeParse(body);

  if (!parseResult.success) {
    return badRequest('Invalid person payload', parseResult.error.flatten());
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const peopleTable = supabase.from('people') as any;
    const { data, error } = await peopleTable
      .insert({
        user_id: user.id,
        first_name: parseResult.data.firstName,
        last_name: parseResult.data.lastName ?? null
      })
      .select('*')
      .maybeSingle();

    if (error || !data) {
      if ((error as { code?: string })?.code === '23505') {
        return badRequest('Person already exists.');
      }
      throw error ?? new Error('Failed to create person');
    }

    return created({ person: data });
  } catch (error) {
    console.error('[POST /api/people] failed', error);
    return serverError('Failed to create person.');
  }
}

