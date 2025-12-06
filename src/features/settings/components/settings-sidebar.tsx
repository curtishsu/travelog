'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const settingsNavItems = [
  { href: '/settings/trip-groups', label: 'Trip Groups' }
] as const;

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Settings
      </h2>
      <nav className="mt-3 space-y-1">
        {settingsNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-2xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-white',
                isActive && 'bg-slate-800/80 text-white'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}



