'use client';

import { PropsWithChildren, useEffect } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? '';
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? '';

export function DemoAuthProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!AUTH_DISABLED) {
      return;
    }

    if (!DEMO_EMAIL || !DEMO_PASSWORD) {
      // eslint-disable-next-line no-console
      console.warn(
        'Auth is disabled but NEXT_PUBLIC_DEMO_EMAIL or NEXT_PUBLIC_DEMO_PASSWORD is not set.'
      );
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Demo auth credentials detected', {
      email: DEMO_EMAIL,
      passwordLength: DEMO_PASSWORD.length
    });

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD
      });

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to sign in with demo credentials', error);
      }
    });
  }, []);

  return <>{children}</>;
}

