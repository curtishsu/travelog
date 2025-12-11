import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ReactQueryProvider } from '@/components/providers/react-query-provider';
import { DemoAuthProvider } from '@/components/providers/demo-auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Travelog',
  description: 'Travelog – personal travel logging and reflection.',
  manifest: '/manifest.webmanifest',
  themeColor: '#38bdf8',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Travelog'
  },
  icons: {
    icon: [
      { url: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/icons/apple-touch-icon-180.png'
  }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}>
        <DemoAuthProvider>
          <ReactQueryProvider>
            <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
              <Header />
              <main className="container mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-6 md:pb-6">
                {children}
              </main>
              <MobileNav />
            </div>
          </ReactQueryProvider>
        </DemoAuthProvider>
      </body>
    </html>
  );
}

