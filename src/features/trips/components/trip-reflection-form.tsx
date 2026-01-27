'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MinimalMarkdown } from '@/components/ui/minimal-markdown';
import { useUpdateTrip } from '@/features/trips/hooks';

type TripReflectionFormProps = {
  tripId: string;
  initialReflection: string | null;
  onSaved?: () => void;
  isTripLocked: boolean;
  isReflectionLocked: boolean;
  onToggleLock: () => void | Promise<void>;
  lockMessage?: string | null;
  lockError?: string | null;
  isTogglingLock: boolean;
};

export function TripReflectionForm({
  tripId,
  initialReflection,
  onSaved,
  isTripLocked,
  isReflectionLocked,
  onToggleLock,
  lockMessage,
  lockError,
  isTogglingLock
}: TripReflectionFormProps) {
  const [reflection, setReflection] = useState(initialReflection ?? '');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { mutateAsync, isPending, error } = useUpdateTrip();
  const deferredReflection = useDeferredValue(reflection);

  useEffect(() => {
    setReflection(initialReflection ?? '');
  }, [initialReflection]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavedMessage(null);
    await mutateAsync({ tripId, payload: { reflection } });
    setSavedMessage('Reflection saved.');
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {lockError ? <p className="text-sm text-red-300">{lockError}</p> : null}
      {lockMessage ? <p className="text-sm text-emerald-300">{lockMessage}</p> : null}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-200" htmlFor="trip-reflection">
            Overall reflection
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
              onClick={() => setShowPreview((prev) => !prev)}
            >
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
              onClick={onToggleLock}
              disabled={isTripLocked || isTogglingLock}
              aria-label={isReflectionLocked ? 'Unlock reflection' : 'Lock reflection'}
              title={
                isTripLocked
                  ? 'Trip content is locked. Unlock the trip to change the reflection privacy.'
                  : isReflectionLocked
                  ? 'Unlock this reflection'
                  : 'Lock this reflection'
              }
            >
              {isReflectionLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {isReflectionLocked ? 'Unlock reflection' : 'Lock reflection'}
            </Button>
          </div>
        </div>
        {isTripLocked ? (
          <p className="text-xs text-slate-400">
            Trip content lock overrides reflection privacy. Unlock the trip to make changes.
          </p>
        ) : null}
        <textarea
          id="trip-reflection"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          rows={8}
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          placeholder="What did this trip mean to you?"
        />
        {showPreview ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <MinimalMarkdown value={deferredReflection} />
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-300">{error.message}</p> : null}
      {savedMessage ? <p className="text-sm text-emerald-300">{savedMessage}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save reflection'}
        </Button>
      </div>
    </form>
  );
}

