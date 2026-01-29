import { Suspense } from 'react';

import { JournalTrips } from '@/features/trips/components/journal-trips';

export default function JournalPage() {
  return (
    <Suspense fallback={null}>
      <JournalTrips />
    </Suspense>
  );
}

