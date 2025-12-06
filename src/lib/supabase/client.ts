'use client';

import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

export function createSupabaseBrowserClient() {
  // eslint-disable-next-line no-console
  console.log('Supabase client config', {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKeyLength: env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length
  });

  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

