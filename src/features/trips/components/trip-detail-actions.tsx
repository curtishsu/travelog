'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useDeleteTrip } from '@/features/trips/hooks';

type TripDetailActionsProps = {
  tripId: string;
};

export function TripDetailActions({ tripId }: TripDetailActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const router = useRouter();
  const { mutateAsync, isPending, error } = useDeleteTrip({
    onSuccess: () => {
      router.push('/journal');
      router.refresh();
    }
  });

  async function handleDelete() {
    try {
      await mutateAsync({ tripId });
    } catch (mutationError) {
      console.error(mutationError);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="md">
          <Link href={`/trips/${tripId}/edit`}>Edit trip</Link>
        </Button>
        <Button variant="secondary" onClick={() => setIsConfirming(true)}>
          Delete trip
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-300">Failed to delete trip. Please try again.</p>
      ) : null}
      {isConfirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-white">Delete this trip?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Are you sure you want to delete this trip? This will permanently remove all its data and photos.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsConfirming(false)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={isPending} onClick={handleDelete}>
                {isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

