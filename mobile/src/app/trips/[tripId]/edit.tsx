import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { LocationSearchField } from '@/components/location-search-field';
import { PhotoStrip } from '@/components/photo-strip';
import { Button, Card, ErrorCard, InputField, LoadingBlock, Pill, Screen, SectionTitle, colors } from '@/components/ui';
import { formatDateForDisplay } from '@/lib/date';
import {
  deletePhoto,
  getGuestModeSettings,
  getTripDetail,
  updateTripDay,
  updateTripOverview,
  uploadTripPhoto,
} from '@/lib/repository';
import { TripDetail, TripLocation } from '@/lib/types';

function buildParagraphText(paragraphs: Array<{ text: string }>) {
  return paragraphs.map((paragraph) => paragraph.text).join('\n\n');
}

export default function TripEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId: string; tab?: string }>();
  const tripId = params.tripId;
  const queryClient = useQueryClient();
  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTripDetail(tripId),
    enabled: Boolean(tripId),
  });
  const guestModeQuery = useQuery({
    queryKey: ['guest-mode-settings'],
    queryFn: getGuestModeSettings,
  });

  const initialTab = params.tab ?? 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const trip = tripQuery.data;
  const dayTabs = useMemo(() => trip?.trip_days.map((day) => `day-${day.day_index}`) ?? [], [trip]);
  const currentDay = useMemo(() => {
    if (!trip || !activeTab.startsWith('day-')) {
      return null;
    }
    const dayIndex = Number.parseInt(activeTab.slice(4), 10);
    return trip.trip_days.find((day) => day.day_index === dayIndex) ?? null;
  }, [activeTab, trip]);

  if (tripQuery.isLoading) {
    return <LoadingBlock />;
  }

  if (tripQuery.error || !trip) {
    return (
      <Screen>
        <ErrorCard message={(tripQuery.error as Error)?.message ?? 'Trip not found.'} onRetry={() => tripQuery.refetch()} />
      </Screen>
    );
  }

  const guestModeEnabled = guestModeQuery.data?.guestModeEnabled ?? false;

  async function refreshTrip() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] }),
      queryClient.invalidateQueries({ queryKey: ['trips'] }),
    ]);
  }

  async function saveOverview(nextTrip: TripDetail) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateTripOverview(tripId, {
        name: nextTrip.name,
        startDate: nextTrip.start_date,
        endDate: nextTrip.end_date,
        reflection: nextTrip.reflection ?? '',
        timezone: nextTrip.timezone,
        tripTypes: nextTrip.trip_types.map((type) => type.type),
      });
      await refreshTrip();
      setMessage(result.overlapWarning?.message ?? 'Overview saved.');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDay(nextDay: NonNullable<typeof currentDay>) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateTripDay(tripId, nextDay.day_index, {
        highlight: nextDay.highlight ?? '',
        journalEntry: buildParagraphText(nextDay.trip_day_paragraphs),
        paragraphs: nextDay.trip_day_paragraphs.map((paragraph) => ({
          id: paragraph.id,
          text: paragraph.text,
          isStory: paragraph.is_story,
        })),
        isFavorite: nextDay.is_favorite,
        hashtags: nextDay.trip_day_hashtags.map((tag) => tag.hashtag),
      });
      await refreshTrip();
      setMessage(`Day ${nextDay.day_index} saved.`);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <SectionTitle title={`Edit ${trip.name}`} subtitle="Overview, day notes, and reflection." />
      {guestModeEnabled ? (
        <Card>
          <Text style={{ color: '#fde68a' }}>
            Guest Mode is on. Editing remains available, but locked content will stay hidden in supported views.
          </Text>
        </Card>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill label="Overview" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} />
        {dayTabs.map((tab) => (
          <Pill key={tab} label={tab.replace('day-', 'Day ')} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
        ))}
        <Pill label="Reflection" active={activeTab === 'reflection'} onPress={() => setActiveTab('reflection')} />
      </ScrollView>
      {message ? <Text style={{ color: '#bbf7d0' }}>{message}</Text> : null}
      {error ? <Text style={{ color: '#fecaca' }}>{error}</Text> : null}
      {activeTab === 'overview' ? (
        <OverviewEditor trip={trip} onSave={saveOverview} isSaving={isSaving} />
      ) : null}
      {activeTab === 'reflection' ? (
        <ReflectionEditor
          reflection={trip.reflection ?? ''}
          onSave={async (value) => {
            await saveOverview({ ...trip, reflection: value });
          }}
          isSaving={isSaving}
        />
      ) : null}
      {currentDay ? (
        <DayEditor
          tripId={tripId}
          day={currentDay}
          isSaving={isSaving}
          onSave={saveDay}
          onRefresh={refreshTrip}
        />
      ) : null}
      <Button label="Back to trip" variant="secondary" onPress={() => router.replace(`/trips/${tripId}`)} />
    </Screen>
  );
}

function OverviewEditor({
  trip,
  onSave,
  isSaving,
}: {
  trip: TripDetail;
  onSave: (trip: TripDetail) => Promise<void>;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState(trip);

  return (
    <Card>
      <InputField label="Trip name" value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} />
      <InputField label="Start date" value={draft.start_date} onChangeText={(value) => setDraft({ ...draft, start_date: value })} />
      <InputField label="End date" value={draft.end_date} onChangeText={(value) => setDraft({ ...draft, end_date: value })} />
      <InputField
        label="Trip types"
        value={draft.trip_types.map((type) => type.type).join(', ')}
        onChangeText={(value) =>
          setDraft({
            ...draft,
            trip_types: value
              .split(',')
              .map((item, index) => ({
                id: `${index}`,
                trip_id: draft.id,
                type: item.trim().toLowerCase(),
                created_at: '',
              }))
              .filter((item) => item.type),
          })
        }
      />
      <Button label={isSaving ? 'Saving...' : 'Save overview'} onPress={() => void onSave(draft)} disabled={isSaving} />
    </Card>
  );
}

function ReflectionEditor({
  reflection,
  onSave,
  isSaving,
}: {
  reflection: string;
  onSave: (value: string) => Promise<void>;
  isSaving: boolean;
}) {
  const [value, setValue] = useState(reflection);
  return (
    <Card>
      <InputField label="Reflection" value={value} onChangeText={setValue} multiline />
      <Button label={isSaving ? 'Saving...' : 'Save reflection'} onPress={() => void onSave(value)} disabled={isSaving} />
    </Card>
  );
}

function DayEditor({
  tripId,
  day,
  onSave,
  onRefresh,
  isSaving,
}: {
  tripId: string;
  day: TripDetail['trip_days'][number];
  onSave: (day: TripDetail['trip_days'][number]) => Promise<void>;
  onRefresh: () => Promise<void>;
  isSaving: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(day);
  const hashtagsValue = draft.trip_day_hashtags.map((tag) => tag.hashtag).join(', ');

  async function handlePhotoUpload() {
    await uploadTripPhoto({ tripId, tripDayId: draft.id });
    await onRefresh();
  }

  async function handlePhotoDelete(photoId: string, fullUrl: string, thumbnailUrl: string) {
    await deletePhoto(photoId, fullUrl, thumbnailUrl);
    await onRefresh();
  }

  async function handleAddLocation(location: TripLocation) {
    await updateTripDay(tripId, draft.day_index, {
      locationsToAdd: [
        {
          displayName: location.display_name,
          city: location.city,
          region: location.region,
          country: location.country,
          lat: location.lat,
          lng: location.lng,
        },
      ],
    });
    await queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
  }

  async function handleRemoveLocation(locationId: string) {
    await updateTripDay(tripId, draft.day_index, {
      locationIdsToRemove: [locationId],
    });
    await onRefresh();
  }

  return (
    <Card>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
        Day {draft.day_index} - {formatDateForDisplay(draft.date)}
      </Text>
      <InputField label="Highlight" value={draft.highlight ?? ''} onChangeText={(value) => setDraft({ ...draft, highlight: value })} />
      {draft.trip_day_paragraphs.map((paragraph, index) => (
        <Card key={paragraph.id}>
          <InputField
            label={`Paragraph ${index + 1}`}
            value={paragraph.text}
            onChangeText={(value) =>
              setDraft({
                ...draft,
                trip_day_paragraphs: draft.trip_day_paragraphs.map((item) =>
                  item.id === paragraph.id ? { ...item, text: value } : item,
                ),
              })
            }
            multiline
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={paragraph.is_story ? 'Unmark story' : 'Mark as story'}
              variant="secondary"
              onPress={() =>
                setDraft({
                  ...draft,
                  trip_day_paragraphs: draft.trip_day_paragraphs.map((item) =>
                    item.id === paragraph.id ? { ...item, is_story: !item.is_story } : item,
                  ),
                })
              }
            />
            <Button
              label="Delete"
              variant="danger"
              onPress={() =>
                setDraft({
                  ...draft,
                  trip_day_paragraphs: draft.trip_day_paragraphs.filter((item) => item.id !== paragraph.id),
                })
              }
            />
          </View>
        </Card>
      ))}
      <Button
        label="Add paragraph"
        variant="secondary"
        onPress={() =>
          setDraft({
            ...draft,
            trip_day_paragraphs: [
              ...draft.trip_day_paragraphs,
              {
                id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
                trip_day_id: draft.id,
                position: draft.trip_day_paragraphs.length + 1,
                text: '',
                is_story: false,
                created_at: '',
                updated_at: '',
              },
            ],
          })
        }
      />
      <InputField
        label="Hashtags"
        value={hashtagsValue}
        onChangeText={(value) =>
          setDraft({
            ...draft,
            trip_day_hashtags: value
              .split(',')
              .map((item, index) => ({
                id: `${index}`,
                trip_day_id: draft.id,
                hashtag: item.trim().replace(/^#/, '').toLowerCase(),
                created_at: '',
              }))
              .filter((item) => item.hashtag),
          })
        }
        placeholder="food, favorite, museum"
      />
      <Button
        label={draft.is_favorite ? 'Remove favorite' : 'Mark favorite'}
        variant="secondary"
        onPress={() => setDraft({ ...draft, is_favorite: !draft.is_favorite })}
      />
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Locations</Text>
        <LocationSearchField
          onSelect={(location) =>
            void handleAddLocation({
              id: location.id,
              trip_day_id: draft.id,
              display_name: location.displayName,
              city: location.city ?? null,
              region: location.region ?? null,
              country: location.country ?? null,
              lat: location.lat,
              lng: location.lng,
              created_at: '',
            })
          }
        />
        {draft.trip_locations.map((location) => (
          <View key={location.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.muted, flex: 1 }}>{location.display_name}</Text>
            <Button label="Remove" variant="danger" onPress={() => void handleRemoveLocation(location.id)} />
          </View>
        ))}
      </Card>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Photos</Text>
        <Button label="Add photo" variant="secondary" onPress={() => void handlePhotoUpload()} />
        <PhotoStrip
          photos={draft.photos}
          onDelete={(photo) => void handlePhotoDelete(photo.id, photo.full_url, photo.thumbnail_url)}
        />
      </Card>
      <Button label={isSaving ? 'Saving...' : 'Save day'} onPress={() => void onSave(draft)} disabled={isSaving} />
    </Card>
  );
}
