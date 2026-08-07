import { Link, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { PhotoStrip } from '@/components/photo-strip';
import { StoryCarousel } from '@/components/story-carousel';
import { Button, Card, ErrorCard, LoadingBlock, Pill, Screen, SectionTitle, colors } from '@/components/ui';
import { formatDateForDisplay, formatDateRange } from '@/lib/date';
import { getGuestModeSettings, getTripDetail } from '@/lib/repository';

export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTripDetail(tripId),
    enabled: Boolean(tripId),
  });
  const guestModeQuery = useQuery({
    queryKey: ['guest-mode-settings'],
    queryFn: getGuestModeSettings,
  });

  if (tripQuery.isLoading) {
    return <LoadingBlock />;
  }

  if (tripQuery.error || !tripQuery.data) {
    return (
      <Screen>
        <ErrorCard message={(tripQuery.error as Error)?.message ?? 'Trip not found.'} onRetry={() => tripQuery.refetch()} />
      </Screen>
    );
  }

  const trip = tripQuery.data;
  const guestModeEnabled = guestModeQuery.data?.guestModeEnabled ?? false;
  const hideTripContent = guestModeEnabled && trip.is_trip_content_locked;
  const hideReflection = guestModeEnabled && (trip.is_trip_content_locked || trip.is_reflection_locked);

  return (
    <Screen>
      <SectionTitle title={trip.name} subtitle={formatDateRange(trip.start_date, trip.end_date)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {trip.trip_types.map((type) => (
          <Pill key={type.id} label={type.type} />
        ))}
      </View>
      <Link href={{ pathname: '/trips/[tripId]/edit', params: { tripId: trip.id } }} asChild>
        <View>
          <Button label="Edit trip" />
        </View>
      </Link>
      {!hideTripContent ? <StoryCarousel days={trip.trip_days} /> : null}
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>Reflection</Text>
        <Text style={{ color: colors.muted }}>
          {hideReflection ? 'Reflection is hidden in Guest Mode.' : trip.reflection?.trim() || 'No reflection yet.'}
        </Text>
      </Card>
      {trip.trip_days.map((day) => (
        <Card key={day.id}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
            Day {day.day_index} - {formatDateForDisplay(day.date)}
          </Text>
          <Text style={{ color: colors.muted }}>
            {hideTripContent ? 'Day details are hidden in Guest Mode.' : day.highlight?.trim() || 'No highlight yet.'}
          </Text>
          {!hideTripContent ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {day.trip_day_hashtags.map((tag) => (
                  <Pill key={tag.id} label={`#${tag.hashtag}`} />
                ))}
              </View>
              <Text style={{ color: colors.text }}>
                {day.trip_day_paragraphs.map((paragraph) => paragraph.text).join('\n\n') || day.journal_entry || 'No journal entry yet.'}
              </Text>
              <Text style={{ color: colors.muted }}>
                {(day.trip_locations ?? []).map((location) => location.display_name).join(', ') || 'No saved locations.'}
              </Text>
              <PhotoStrip photos={day.photos} />
            </>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
