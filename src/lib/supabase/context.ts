import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/types/database';

type SupabaseWithAuth = {
  supabase: SupabaseClient<Database>;
  user: { id: string } | null;
  isDemoMode: boolean;
  authError?: unknown;
};

let cachedDemoUserId: string | null = null;

function isAuthDisabled() {
  return process.env.AUTH_DISABLED === 'true';
}

async function ensureDemoUser(serviceClient: SupabaseClient<Database>) {
  if (cachedDemoUserId) {
    return cachedDemoUserId;
  }

  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'DEMO_USER_EMAIL and DEMO_USER_PASSWORD must be set when AUTH_DISABLED is true.'
    );
  }

  const listResult = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  if ('error' in listResult && listResult.error) {
    throw listResult.error;
  }

  const existingUser = listResult.data.users.find(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser?.id) {
    cachedDemoUserId = existingUser.id;
    return cachedDemoUserId;
  }

  const createResult = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (createResult.error || !createResult.data.user?.id) {
    throw createResult.error ?? new Error('Failed to create demo user.');
  }

  cachedDemoUserId = createResult.data.user.id;
  return cachedDemoUserId;
}

export async function getSupabaseForRequest(): Promise<SupabaseWithAuth> {
  if (isAuthDisabled()) {
    const serviceClient = createSupabaseServiceClient();
    const userId = await ensureDemoUser(serviceClient);
    return {
      supabase: serviceClient,
      user: { id: userId },
      isDemoMode: true
    };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      isDemoMode: false,
      authError: error
    };
  }

  return {
    supabase,
    user,
    isDemoMode: false
  };
}

