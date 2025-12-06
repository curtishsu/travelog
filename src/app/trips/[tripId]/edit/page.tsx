import { TripEditor } from '@/features/trips/components/trip-editor';
import { loadTripDetail } from '@/features/trips/server';

type TripEditPageProps = {
  params: { tripId: string };
  searchParams: { tab?: string; overlap?: string };
};

export default async function TripEditPage({ params, searchParams }: TripEditPageProps) {
  const trip = await loadTripDetail(params.tripId);
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

