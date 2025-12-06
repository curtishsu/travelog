import { Suspense } from 'react';

import { TripsList } from '@/features/trips/components/trips-list';

export default function JournalPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Journal</h1>
      </header>
      <Suspense fallback={null}>
        <TripsList />
      </Suspense>
    </div>
  );
}

