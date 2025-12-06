'use client';

import { Menu, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { primaryNavItems } from '@/lib/constants/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const accountMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[Auth] initial session', {
          email: data.session?.user?.email ?? null,
          id: data.session?.user?.id ?? null
        });
      }
      setAccountEmail(data.session?.user?.email ?? null);
      setIsLoadingUser(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[Auth] session change', {
          email: session?.user?.email ?? null,
          id: session?.user?.id ?? null
        });
      }
      setAccountEmail(session?.user?.email ?? null);
      setIsLoadingUser(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuContainerRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isAccountMenuOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);
    if (error) {
      console.error('Failed to sign out', error);
      return;
    }
    setIsAccountMenuOpen(false);
    router.push('/auth/signin');
    router.refresh();
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="container mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/journal" className="text-lg font-semibold uppercase tracking-widest">
          Travelog
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {primaryNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm uppercase tracking-wide text-slate-300 transition hover:text-white',
                pathname.startsWith(item.href) && 'text-white'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div ref={accountMenuContainerRef} className="relative flex items-center gap-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500 hover:text-white"
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
            aria-label="Account"
            onClick={() => setIsAccountMenuOpen((prev) => !prev)}
          >
            <UserCircle2 className="h-5 w-5" />
          </button>
          {isAccountMenuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-950/95 p-2 shadow-lg backdrop-blur">
              {isLoadingUser ? (
                <div className="px-3 py-2 text-sm text-slate-400">Loading account…</div>
              ) : accountEmail ? (
                <>
                  <div className="px-3 pt-2 text-xs uppercase tracking-wide text-slate-500">
                    Signed in as
                  </div>
                  <div className="px-3 pb-3 text-sm text-white break-words">{accountEmail}</div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSigningOut ? 'Signing out…' : 'Log out'}
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-1 py-1">
                  <Link
                    href="/auth/signin"
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
                    onClick={() => setIsAccountMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
                    onClick={() => setIsAccountMenuOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          ) : null}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 transition hover:border-slate-500 hover:text-white md:hidden"
            aria-expanded={isMenuOpen}
            aria-label="Toggle menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

