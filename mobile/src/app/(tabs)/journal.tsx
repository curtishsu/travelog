import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { EmptyState, ErrorCard, LoadingBlock, Screen, SectionTitle, colors, styles } from '@/components/ui';
import { formatDateRange } from '@/lib/date';
import { listTrips } from '@/lib/repository';

export default function JournalScreen() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['trips'],
    queryFn: listTrips,
  });

  return (
    <Screen>
      <SectionTitle title="Journal" subtitle="Trips, memories, and the days you want to keep." />
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorCard message={(error as Error).message} onRetry={() => refetch()} /> : null}
      {!isLoading && !error && !data?.length ? (
        <EmptyState
          title="Start your first trip"
          body="Capture every day, hashtag, and photo. Begin by creating your first trip."
          ctaHref="/trips/new"
          ctaLabel="Create trip"
        />
      ) : null}
      {data?.map((trip) => (
        <Link key={trip.id} href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
          <Pressable style={styles.card}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 20 }}>{trip.name}</Text>
            <Text style={{ color: colors.muted }}>{formatDateRange(trip.start_date, trip.end_date)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {trip.trip_types.map((type) => (
                <View key={type.type} style={{ borderRadius: 999, backgroundColor: colors.cardAlt, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 12 }}>{type.type}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: colors.muted }}>
              {trip.trip_days.length} day{trip.trip_days.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </Link>
      ))}
      <Link href="/trips/new" asChild>
        <Pressable style={[styles.button, { backgroundColor: colors.brand }]}>
          <Text style={styles.buttonText}>Add trip</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
