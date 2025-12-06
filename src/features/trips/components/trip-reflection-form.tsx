'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useUpdateTrip } from '@/features/trips/hooks';

type TripReflectionFormProps = {
  tripId: string;
  initialReflection: string | null;
  onSaved?: () => void;
};

export function TripReflectionForm({ tripId, initialReflection, onSaved }: TripReflectionFormProps) {
  const [reflection, setReflection] = useState(initialReflection ?? '');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const { mutateAsync, isPending, error } = useUpdateTrip();

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
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200">Overall reflection</label>
        <textarea
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          rows={8}
          className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          placeholder="What did this trip mean to you?"
        />
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

