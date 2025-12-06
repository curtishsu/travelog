'use client';

import { BarChart3, BookOpenText, Globe2, PlusCircle, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const iconMap = {
  '/journal': BookOpenText,
  '/trips/new': PlusCircle,
  '/map': Globe2,
  '/stats': BarChart3,
  '/settings/trip-groups': Settings
} as const;

const items = [
  { href: '/journal', label: 'Journal' },
  { href: '/trips/new', label: 'Add Trip' },
  { href: '/map', label: 'Globe' },
  { href: '/stats', label: 'Stats' },
  { href: '/settings/trip-groups', label: 'Settings' }
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-3xl justify-around px-2 py-3">
        {items.map((item) => {
          const Icon = iconMap[item.href];
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs font-medium tracking-wide text-slate-400 transition',
                isActive && 'text-white'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-brand')} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

