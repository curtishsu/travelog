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
        set() {
          // Server Components can run with a read-only cookie store in App Router.
          // Avoid writing cookies from here; refresh should happen in route handlers.
        },
        remove() {
          // Same as set(): do not mutate cookies in Server Components.
        }
      }
    }
  );
}

