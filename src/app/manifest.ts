import type { MetadataRoute } from 'next';

const THEME_COLOR = '#38bdf8';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Travelog',
    short_name: 'Travelog',
    description: 'Travelog – personal travel logging and reflection.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: THEME_COLOR,
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ],
    shortcuts: [
      {
        name: 'Journal',
        short_name: 'Journal',
        url: '/journal'
      },
      {
        name: 'Trips',
        short_name: 'Trips',
        url: '/trips'
      }
    ]
  };
}


