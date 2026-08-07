import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { LocationSearchField } from '@/components/location-search-field';
import { Button, Card, EmptyState, ErrorCard, InputField, LoadingBlock, Pill, Screen, SectionTitle, colors } from '@/components/ui';
import { getMonthValue, monthValueToRange } from '@/lib/date';
import { createTrip, listTrips, updateTripDay } from '@/lib/repository';
import { LocationSuggestion } from '@/lib/types';

type QuickAddCard = {
  id: string;
  name: string;
  month: string;
  days: string;
  hashtagsText: string;
  tripTypesText: string;
  locations: LocationSuggestion[];
  expanded: boolean;
};

const MIN_INITIAL_CARDS = 3;
const PROGRESS_TARGET = 5;

function createCard(): QuickAddCard {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    month: getMonthValue(),
    days: '',
    hashtagsText: '',
    tripTypesText: '',
    locations: [],
    expanded: true,
  };
}

function normalizeTripName(value: string) {
  return value.trim().toLowerCase();
}

function buildDuplicateName(baseName: string, existingNames: Set<string>) {
  const rootName = baseName.trim().replace(/\s*\(\d+\)\s*$/, '').trim();
  let suffix = 1;
  while (suffix < 200) {
    const candidate = `${rootName} (${suffix})`;
    if (!existingNames.has(normalizeTripName(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
  return `${rootName} (${Date.now()})`;
}

function getAssignments(days: number, locations: LocationSuggestion[]) {
  const assignments = new Map<number, LocationSuggestion[]>();
  if (days < 1 || !locations.length) {
    return assignments;
  }

  if (locations.length <= days) {
    const base = Math.floor(days / locations.length);
    let remainder = days % locations.length;
    let dayIndex = 1;
    for (const location of locations) {
      const span = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(remainder - 1, 0);
      for (let index = 0; index < span; index += 1) {
        assignments.set(dayIndex, [...(assignments.get(dayIndex) ?? []), location]);
        dayIndex += 1;
      }
    }
    return assignments;
  }

  const base = Math.floor(locations.length / days);
  let remainder = locations.length % days;
  let cursor = 0;
  for (let dayIndex = 1; dayIndex <= days; dayIndex += 1) {
    const count = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(remainder - 1, 0);
    assignments.set(dayIndex, locations.slice(cursor, cursor + count));
    cursor += count;
  }
  return assignments;
}

export default function QuickAddScreen() {
  const queryClient = useQueryClient();
  const tripsQuery = useQuery({
    queryKey: ['trips'],
    queryFn: listTrips,
  });
  const [cards, setCards] = useState<QuickAddCard[]>([
    createCard(),
    createCard(),
    createCard(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const existingTripNames = useMemo(
    () => new Set((tripsQuery.data ?? []).map((trip) => normalizeTripName(trip.name))),
    [tripsQuery.data],
  );

  const completedCards = cards.filter((card) => card.name.trim() && Number.parseInt(card.days, 10) > 0);

  function updateCard(cardId: string, updater: (card: QuickAddCard) => QuickAddCard) {
    setCards((previous) => {
      const next = previous.map((card) => (card.id === cardId ? updater(card) : { ...card, expanded: false }));
      if (next.length === MIN_INITIAL_CARDS && next.every((card) => card.name.trim())) {
        next.push({ ...createCard(), expanded: false });
      }
      return next;
    });
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);
    try {
      const localNames = new Set<string>();
      for (const card of cards) {
        if (!card.name.trim() && !card.days.trim()) {
          continue;
        }

        const normalized = normalizeTripName(card.name);
        const parsedDays = Number.parseInt(card.days, 10);
        if (!card.name.trim() || !parsedDays || parsedDays < 1 || parsedDays > 365) {
          throw new Error('Each saved quick-add card needs a trip name and a 1-365 day length.');
        }
        if (existingTripNames.has(normalized) || localNames.has(normalized)) {
          throw new Error('Cannot have duplicate trip names.');
        }
        localNames.add(normalized);

        const range = monthValueToRange(card.month, parsedDays);
        const createResult = await createTrip({
          name: card.name,
          startDate: range.startDate,
          endDate: range.endDate,
          tripTypes: card.tripTypesText.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean),
        });

        const assignments = getAssignments(parsedDays, card.locations);
        for (let dayIndex = 1; dayIndex <= parsedDays; dayIndex += 1) {
          const dayLocations = assignments.get(dayIndex) ?? [];
          if (!dayLocations.length && !card.hashtagsText.trim()) {
            continue;
          }
          await updateTripDay(createResult.tripId, dayIndex, {
            hashtags: card.hashtagsText.split(/[\s,]+/).map((value) => value.trim().replace(/^#/, '')).filter(Boolean),
            locationsToAdd: dayLocations.map((location) => ({
              displayName: location.displayName,
              city: location.city,
              region: location.region,
              country: location.country,
              lat: location.lat,
              lng: location.lng,
            })),
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.replace('/(tabs)/journal');
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  if (tripsQuery.isLoading) {
    return <LoadingBlock />;
  }

  if (tripsQuery.error) {
    return (
      <Screen>
        <ErrorCard message={(tripsQuery.error as Error).message} onRetry={() => tripsQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle
        title="Build Your Travel History"
        subtitle="Add past trips quickly, then keep filling in the details later."
      />
      <Card>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Progress</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: PROGRESS_TARGET }).map((_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 999,
                backgroundColor: index < completedCards.length ? colors.brand : colors.cardAlt,
              }}
            />
          ))}
        </View>
        <Text style={{ color: colors.muted }}>
          Fill five trips to complete the onboarding target. Saving takes you back to your journal on mobile.
        </Text>
      </Card>
      {cards.map((card) => (
        <Card key={card.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>
              {card.name.trim() || 'Untitled trip'}
            </Text>
            <Button label={card.expanded ? 'Collapse' : 'Edit'} variant="secondary" onPress={() => updateCard(card.id, (current) => ({ ...current, expanded: !current.expanded }))} />
          </View>
          {card.expanded ? (
            <>
              <InputField label="Trip name" value={card.name} onChangeText={(value) => updateCard(card.id, (current) => ({ ...current, name: value, expanded: true }))} />
              <InputField label="Trip month" value={card.month} onChangeText={(value) => updateCard(card.id, (current) => ({ ...current, month: value, expanded: true }))} placeholder="2025-02" />
              <InputField label="Trip length (days)" value={card.days} onChangeText={(value) => updateCard(card.id, (current) => ({ ...current, days: value, expanded: true }))} placeholder="7" />
              <InputField label="Hashtags" value={card.hashtagsText} onChangeText={(value) => updateCard(card.id, (current) => ({ ...current, hashtagsText: value, expanded: true }))} placeholder="food, family" />
              <InputField label="Trip types" value={card.tripTypesText} onChangeText={(value) => updateCard(card.id, (current) => ({ ...current, tripTypesText: value, expanded: true }))} placeholder="city, beach" />
              <LocationSearchField
                onSelect={(location) =>
                  updateCard(card.id, (current) => ({
                    ...current,
                    expanded: true,
                    locations: [...current.locations, location],
                  }))
                }
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {card.locations.map((location) => (
                  <Pill key={`${card.id}-${location.id}`} label={location.displayName} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  label="Duplicate"
                  variant="secondary"
                  onPress={() =>
                    setCards((previous) => {
                      const allNames = new Set(previous.map((item) => normalizeTripName(item.name)));
                      const duplicateName = buildDuplicateName(card.name || 'Copied trip', allNames);
                      const duplicate: QuickAddCard = {
                        ...card,
                        id: createCard().id,
                        name: duplicateName,
                        expanded: true,
                      };
                      return [...previous, duplicate].map((item) => ({ ...item, expanded: item.id === duplicate.id }));
                    })
                  }
                />
                <Button
                  label="Clear"
                  variant="danger"
                  onPress={() => updateCard(card.id, () => ({ ...createCard(), id: card.id, expanded: true }))}
                />
              </View>
            </>
          ) : null}
        </Card>
      ))}
      {error ? <ErrorCard message={error} /> : null}
      {!cards.length ? (
        <EmptyState title="No cards yet" body="Start with a few trips and keep building from there." />
      ) : null}
      <Button label={isSaving ? 'Saving...' : 'Save trips'} onPress={() => void handleSave()} disabled={isSaving} />
    </Screen>
  );
}
