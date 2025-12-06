'use client';

import Link from 'next/link';

import { TripCard } from '@/features/trips/components/trip-card';
import { useTripsList } from '@/features/trips/hooks';
import { Button } from '@/components/ui/button';

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

export function TripsList() {
  const { data, isLoading, isError, refetch } = useTripsList();

  if (isLoading) {
    return <TripsListSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center text-red-200">
        <p className="text-lg font-semibold">We couldn’t load your trips.</p>
        <p className="mt-2 text-sm text-red-100/80">
          Please check your connection and try again.
        </p>
        <Button className="mt-6" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-10 text-center">
        <h3 className="text-2xl font-semibold text-white">Start your first trip</h3>
        <p className="mt-3 text-sm text-slate-400">
          Capture every day, hashtag, and photo. Begin by creating your first trip.
        </p>
        <Button asChild className="mt-6">
          <Link href="/trips/new">Create trip</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {data.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}

