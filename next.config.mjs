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

export default nextConfig;

