import { TripDetailView } from '@/features/trips/components/trip-detail-view';
import { loadTripDetail } from '@/features/trips/server';

type TripDetailPageProps = {
  params: { tripId: string };
};

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { trip, guestModeEnabled } = await loadTripDetail(params.tripId);
  return <TripDetailView trip={trip} guestModeEnabled={guestModeEnabled} />;
}

