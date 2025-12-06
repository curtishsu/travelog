import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    MAPBOX_TOKEN: z.string().optional(),
    AUTH_DISABLED: z
      .enum(['true', 'false'])
      .optional()
      .default('false'),
    DEMO_USER_EMAIL: z.string().optional(),
    DEMO_USER_PASSWORD: z.string().optional()
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
    NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
    NEXT_PUBLIC_AUTH_DISABLED: z
      .enum(['true', 'false'])
      .optional()
      .default('false'),
    NEXT_PUBLIC_DEMO_EMAIL: z.string().optional(),
    NEXT_PUBLIC_DEMO_PASSWORD: z.string().optional()
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_AUTH_DISABLED: process.env.NEXT_PUBLIC_AUTH_DISABLED,
    NEXT_PUBLIC_DEMO_EMAIL: process.env.NEXT_PUBLIC_DEMO_EMAIL,
    NEXT_PUBLIC_DEMO_PASSWORD: process.env.NEXT_PUBLIC_DEMO_PASSWORD
  }
});

