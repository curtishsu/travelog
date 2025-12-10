'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDeleteTrip } from '@/features/trips/hooks';

type TripDetailActionsProps = {
  tripId: string;
  disabled?: boolean;
};

export function TripDetailActions({ tripId, disabled = false }: TripDetailActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { mutateAsync, isPending, error } = useDeleteTrip({
    onSuccess: () => {
      router.push('/journal');
      router.refresh();
    }
  });

  useEffect(() => {
    if (!isMenuOpen || disabled) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [disabled, isMenuOpen]);

  useEffect(() => {
    if (!disabled) {
      return;
    }
    setIsMenuOpen(false);
    setIsConfirming(false);
  }, [disabled]);

  function handleEdit() {
    setIsMenuOpen(false);
    router.push(`/trips/${tripId}/edit`);
  }

  function handleDeleteClick() {
    setIsMenuOpen(false);
    setIsConfirming(true);
  }

  async function handleDelete() {
    try {
      await mutateAsync({ tripId });
    } catch (mutationError) {
      console.error(mutationError);
    }
  }

  if (disabled) {
    return null;
  }

  return (
    <>
      <div ref={actionsRef} className="relative flex justify-end">
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900 text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-slate-950"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Open trip actions"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {isMenuOpen ? (
          <div className="absolute right-0 top-full z-40 mt-2 w-40 rounded-2xl border border-slate-800 bg-slate-900/90 p-1 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={handleEdit}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800/70"
            >
              Edit trip
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-300/10"
            >
              Delete trip
            </button>
          </div>
        ) : null}
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

