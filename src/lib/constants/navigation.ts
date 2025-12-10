import type { Route } from 'next';

type NavItem = {
  label: string;
  href: Route;
  icon: string;
};

export const primaryNavItems: NavItem[] = [
  {
    label: 'Journal',
    href: '/journal',
    icon: 'book-open'
  },
  {
    label: 'Add Trip',
    href: '/trips/new',
    icon: 'plus-circle'
  },
  {
    label: 'Globe',
    href: '/map',
    icon: 'globe'
  },
  {
    label: 'Stats',
    href: '/stats',
    icon: 'bar-chart'
  },
  {
    label: 'Settings',
    href: '/settings/privacy',
    icon: 'settings'
  }
];

