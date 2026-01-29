'use client';

import { CalendarDays, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import type { TripSummary } from '@/features/trips/types';
import { formatDateRange } from '@/lib/date';

type TripCardProps = {
  trip: TripSummary;
  showViewTripBadge?: boolean;
};

function getDistinctHashtags(trip: TripSummary) {
  const tags = new Set<string>();
  for (const day of trip.trip_days ?? []) {
    for (const hashtag of day.trip_day_hashtags ?? []) {
      if (hashtag?.hashtag) {
        tags.add(hashtag.hashtag);
      }
    }
  }
  return Array.from(tags);
}

export function TripCard({ trip, showViewTripBadge = true }: TripCardProps) {
  const tripTypes = trip.trip_types ?? [];
  const typeCount = tripTypes.length;
  const distinctHashtags = getDistinctHashtags(trip);
  const hashtagCount = distinctHashtags.length;
  const hasTypes = typeCount > 0;
  const hasHashtags = hashtagCount > 0;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group relative flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-slate-600 hover:bg-slate-900/70"
    >
      {showViewTripBadge ? (
        <div className="pointer-events-none absolute right-6 top-6 flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand transition group-hover:border-brand group-hover:bg-slate-900">
          <span>View trip</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4 pr-16">
        <div>
          <h3 className="text-xl font-semibold text-white">{trip.name}</h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
            <CalendarDays className="h-4 w-4 opacity-70" />
            <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
          </div>
        </div>
      </div>
      {hasTypes || hasHashtags ? (
        <div className="flex flex-col gap-2">
          {hasTypes ? (
            <div className="flex flex-wrap gap-2">
              {tripTypes.slice(0, 6).map((type) => (
                <span
                  key={`${trip.id}-${type.type}`}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200"
                >
                  {type.type}
                </span>
              ))}
              {typeCount > 6 ? (
                <span className="rounded-full bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-400">
                  +{typeCount - 6} more
                </span>
              ) : null}
            </div>
          ) : null}
          {hasHashtags ? (
            <div className="flex flex-wrap items-center gap-2">
              {distinctHashtags.slice(0, 6).map((tag) => {
                const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
                return (
                  <span
                    key={`${trip.id}-tag-${tag}`}
                    className="rounded-full border border-slate-700/70 px-3 py-1 text-xs font-medium text-slate-200"
                  >
                    {normalizedTag}
                  </span>
                );
              })}
              {hashtagCount > 6 ? (
                <span className="rounded-full border border-slate-700/50 px-3 py-1 text-xs font-medium text-slate-400">
                  +{hashtagCount - 6} more
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

