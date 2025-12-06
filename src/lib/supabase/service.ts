import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

export function createSupabaseServiceClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client usage.');
  }

  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

