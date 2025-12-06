import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Parameters<typeof cookieStore.set>[2]) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string) {
          cookieStore.delete({ name });
        }
      }
    }
  );
}

