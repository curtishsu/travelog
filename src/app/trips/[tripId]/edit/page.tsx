import { redirect } from 'next/navigation';

import { TripEditor } from '@/features/trips/components/trip-editor';
import { loadTripDetail } from '@/features/trips/server';

export const dynamic = 'force-dynamic';

type TripEditPageProps = {
  params: { tripId: string };
  searchParams: { tab?: string; overlap?: string };
};

export default async function TripEditPage({ params, searchParams }: TripEditPageProps) {
  const { trip, guestModeEnabled } = await loadTripDetail(params.tripId);

  if (guestModeEnabled) {
    redirect(`/trips/${params.tripId}`);
  }

  const candidateTab = searchParams.tab ?? 'overview';
  const validTabs = [
    'overview',
    ...trip.trip_days.map((day) => `day-${day.day_index}`),
    'reflection'
  ];
  const initialTab = validTabs.includes(candidateTab) ? candidateTab : 'overview';
  const showOverlapNotice = searchParams.overlap === 'true';

  return <TripEditor trip={trip} initialTab={initialTab} showOverlapNotice={showOverlapNotice} />;
}

