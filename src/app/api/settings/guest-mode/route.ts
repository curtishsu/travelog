import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';

import { badRequest, ok, serverError, unauthorized } from '@/lib/http';
import { env } from '@/lib/env';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

const updateGuestModeSchema = z.object({
  guestModeEnabled: z.boolean(),
  password: z.string().min(1, 'Password is required.').optional()
});

async function fetchGuestModeSetting(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  return supabase
    .from('user_settings')
    .select('guest_mode_enabled')
    .eq('user_id', userId)
    .maybeSingle<{ guest_mode_enabled: boolean }>();
}

async function verifyPassword(email: string, password: string) {
  if (env.AUTH_DISABLED === 'true') {
    return { ok: true as const };
  }

  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      return { ok: true as const };
    }

    let message = 'Incorrect password.';
    try {
      const errorBody = (await response.json()) as { error?: string; message?: string } | null;
      message = errorBody?.message ?? errorBody?.error ?? message;
    } catch {
      // ignore parse errors
    }

    return { ok: false as const, message };
  } catch (error) {
    console.error('[verifyPassword] failed', error);
    return {
      ok: false as const,
      message: 'Unable to verify password. Check your connection and try again.'
    };
  }
}

export async function GET() {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const { data, error } = await fetchGuestModeSetting(supabase, user.id);

  const errorCode = (error as { code?: string } | null | undefined)?.code;

  if (error && errorCode !== 'PGRST116') {
    console.error('[GET /api/settings/guest-mode] failed', error);
    return serverError('Failed to load guest mode settings.');
  }

  return ok({
    guestModeEnabled: data?.guest_mode_enabled ?? false
  });
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parseResult = updateGuestModeSchema.safeParse(body);

  if (!parseResult.success) {
    return badRequest('Invalid payload.', parseResult.error.flatten());
  }

  const { guestModeEnabled, password } = parseResult.data;

  const authDisabled = env.AUTH_DISABLED === 'true';
  const userEmail =
    typeof user === 'object' && user !== null && 'email' in user && typeof user.email === 'string'
      ? user.email
      : null;

  if (!guestModeEnabled && !authDisabled) {
    if (!userEmail) {
      console.error('[PATCH /api/settings/guest-mode] missing email for user', user.id);
      return serverError('Unable to verify credentials for this account.');
    }

    if (!password) {
      return badRequest('Password is required to exit Guest Mode.');
    }

    const verification = await verifyPassword(userEmail, password);
    if (!verification.ok) {
      return unauthorized(verification.message);
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userSettingsTable = supabase.from('user_settings') as any;
    const { data, error } = await userSettingsTable
      .upsert(
        {
          user_id: user.id,
          guest_mode_enabled: guestModeEnabled
        },
        { onConflict: 'user_id' }
      )
      .select('guest_mode_enabled')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return ok({
      guestModeEnabled: data?.guest_mode_enabled ?? guestModeEnabled
    });
  } catch (error) {
    console.error('[PATCH /api/settings/guest-mode] failed', error);
    return serverError('Failed to update guest mode settings.');
  }
}


