'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TripCard } from '@/features/trips/components/trip-card';
import { TripFiltersDialog } from '@/features/trips/components/trip-filters-dialog';
import {
  buildTripGroupMembersIndex,
  filterTripIds,
  type TripFilterClause,
  type TripFilterTripMeta
} from '@/features/trips/filtering';
import { useTripGroups, useTripsList } from '@/features/trips/hooks';

function isClauseActive(clause: TripFilterClause) {
  if (clause.kind === 'dateRange') return Boolean(clause.startDate || clause.endDate);
  if (clause.kind === 'tripType') return clause.tripTypes.length > 0;
  if (clause.kind === 'tripGroup') return clause.tripGroupIds.length > 0;
  if (clause.kind === 'tripPeople') return clause.personIds.length > 0;
  if (clause.kind === 'favorites') return true;
  return false;
}

function TripsListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="h-6 w-1/2 rounded bg-slate-700/60" />
          <div className="mt-4 h-4 w-1/3 rounded bg-slate-800/80" />
          <div className="mt-6 flex gap-2">
            {Array.from({ length: 3 }).map((_, chipIndex) => (
              <div key={chipIndex} className="h-6 w-20 rounded-full bg-slate-800/60" />
            ))}
          </div>
          <div className="mt-6 h-4 w-24 rounded bg-slate-800/60" />
        </div>
      ))}
    </div>
  );
}

export function JournalTrips() {
  const { data, isLoading, isError, error, refetch } = useTripsList();
  const { data: tripGroups } = useTripGroups();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterClauses, setFilterClauses] = useState<TripFilterClause[]>([]);
  const [draftFilterClauses, setDraftFilterClauses] = useState<TripFilterClause[]>([]);
  const hasActiveFilters = useMemo(() => (filterClauses ?? []).some(isClauseActive), [filterClauses]);

  const groupMembersIndex = useMemo(
    () => buildTripGroupMembersIndex(tripGroups ?? []),
    [tripGroups]
  );

  const tripMetas = useMemo(() => {
    const trips = data ?? [];
    return trips.map((trip): TripFilterTripMeta => {
      const companionGroupIds = Array.from(
        new Set([
          ...(trip.trip_companion_groups?.map((row) => row.trip_group_id) ?? []),
          ...(trip.trip_group_id ? [trip.trip_group_id] : [])
        ])
      );
      return {
        tripId: trip.id,
        startDate: trip.start_date,
        endDate: trip.end_date,
        tripTypes: (trip.trip_types ?? []).map((row) => row.type),
        companionGroupIds,
        companionPersonIds: trip.trip_companion_people?.map((row) => row.person_id) ?? [],
        hasFavoriteDay: (trip.trip_days ?? []).some((day) => Boolean(day.is_favorite))
      };
    });
  }, [data]);

  const allowedTripIds = useMemo(
    () => filterTripIds(tripMetas, filterClauses, groupMembersIndex),
    [tripMetas, filterClauses, groupMembersIndex]
  );

  const visibleTrips = useMemo(
    () => (data ?? []).filter((trip) => allowedTripIds.has(trip.id)),
    [data, allowedTripIds]
  );

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-white">Journal</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setDraftFilterClauses(filterClauses);
              setFiltersOpen(true);
            }}
          >
            Filter
          </Button>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterClauses([]);
                setDraftFilterClauses([]);
              }}
            >
              Clear filter
            </Button>
          ) : null}
        </div>
      </header>

      <TripFiltersDialog
        open={filtersOpen}
        clauses={draftFilterClauses}
        onChange={setDraftFilterClauses}
        onClose={() => setFiltersOpen(false)}
        onApply={() => setFilterClauses(draftFilterClauses)}
        title="Filter journal"
      />

      {isLoading ? <TripsListSkeleton /> : null}

      {isError ? (
        (error as Error & { status?: number } | null)?.status === 401 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center">
            <h3 className="text-2xl font-semibold text-white">Log in to see your trips</h3>
            <p className="mt-3 text-sm text-slate-400">
              Sign in (or create an account) to view your journal.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/auth/signin">Sign in</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/auth/signup">Sign up</Link>
              </Button>
            </div>
          </div>
        ) : (
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center text-red-200">
          <p className="text-lg font-semibold">We couldn’t load your trips.</p>
          <p className="mt-2 text-sm text-red-100/80">Please check your connection and try again.</p>
          <Button className="mt-6" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
        )
      ) : null}

      {!isLoading && !isError && !data?.length ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center">
          <h3 className="text-2xl font-semibold text-white">Start your first trip</h3>
          <p className="mt-3 text-sm text-slate-400">
            Capture every day, hashtag, and photo. Begin by creating your first trip.
          </p>
          <Button asChild className="mt-6">
            <Link href="/trips/new">Create trip</Link>
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && data?.length ? (
        <div className="grid gap-4">
          {visibleTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} showViewTripBadge={false} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

