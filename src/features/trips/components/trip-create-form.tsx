'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { TripOverviewForm, type TripOverviewFormValues } from '@/features/trips/components/trip-overview-form';
import { useCreateTrip } from '@/features/trips/hooks';

const DEFAULT_VALUES: TripOverviewFormValues = {
  name: '',
  startDate: '',
  endDate: '',
  links: [],
  tripTypes: [],
  reflection: null,
  tripGroupId: null,
  tripGroupName: ''
};

export function TripCreateForm() {
  const router = useRouter();
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const { mutateAsync, isPending, error } = useCreateTrip();

  async function handleSubmit(values: TripOverviewFormValues) {
    setOverlapWarning(null);

    const { tripGroupName: _omit, ...payload } = values;

    const result = await mutateAsync(payload);
    if (result.overlapWarning?.message) {
      setOverlapWarning(result.overlapWarning.message);
    }

    const query = new URLSearchParams();
    query.set('tab', 'day-1');
    if (result.overlapWarning?.message) {
      query.set('overlap', 'true');
    }
    router.push(`/trips/${result.trip.id}/edit?${query.toString()}`);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error.message}
        </div>
      ) : null}
      <TripOverviewForm
        initialValues={DEFAULT_VALUES}
        submitLabel="Save trip"
        isSubmitting={isPending}
        onSubmit={handleSubmit}
        overlapWarning={overlapWarning}
      />
    </div>
  );
}

