import nextPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const IS_DEV = process.env.NODE_ENV !== 'production';

const supabaseRemotePattern =
  SUPABASE_URL !== ''
    ? {
        protocol: 'https',
        hostname: new URL(SUPABASE_URL).hostname,
        pathname: '/storage/v1/object/public/photos/**'
      }
    : null;

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    typedRoutes: true
  },
  images: {
    remotePatterns: [
      ...(supabaseRemotePattern ? [supabaseRemotePattern] : []),
      {
        protocol: 'https',
        hostname: '**'
      }
    ],
    unoptimized: IS_DEV
  }
};

const withPWA = nextPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/[^/]+\/api\/.*$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10
      }
    },
    {
      urlPattern: /^https:\/\/[^/]+\/_next\/image\?url=/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60
        }
      }
    },
    {
      urlPattern: /^https:\/\/[^/]+\/storage\/v1\/object\/public\/photos\/.*$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'supabase-photos',
        expiration: {
          maxEntries: 120,
          maxAgeSeconds: 7 * 24 * 60 * 60
        }
      }
    }
  ]
});

export default withPWA(nextConfig);

