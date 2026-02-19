'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Globe2, Loader2, Plus, Search, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { SignedOutTravelPrompt } from '@/features/auth/components/signed-out-travel-prompt';
import { createTrip, updateTripDay, type LocationInput } from '@/features/trips/api';
import { useTripsList } from '@/features/trips/hooks';

type LocationSuggestion = LocationInput & {
  id: string;
};

type QuickAddCard = {
  id: string;
  name: string;
  month: string;
  days: string;
  locations: LocationSuggestion[];
  locationQuery: string;
  hashtagsText: string;
  tripTypesText: string;
  isMoreOpen: boolean;
};

const PROGRESS_TARGET = 5;
const DAYS_MAX = 365;
const MIN_INITIAL_CARDS = 3;

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
}

function getCurrentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function createEmptyCard(): QuickAddCard {
  return {
    id: createId('quick-add'),
    name: '',
    month: getCurrentMonth(),
    days: '',
    locations: [],
    locationQuery: '',
    hashtagsText: '',
    tripTypesText: '',
    isMoreOpen: false
  };
}

function normalizeTripName(value: string) {
  return value.trim().toLowerCase();
}

function parseTokenList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((token) => token.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean)
    )
  );
}

function isMonthValue(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function parseCardDays(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isCardEmpty(card: QuickAddCard) {
  return (
    !card.name.trim() &&
    !card.days.trim() &&
    !card.locationQuery.trim() &&
    card.locations.length === 0 &&
    !card.hashtagsText.trim() &&
    !card.tripTypesText.trim()
  );
}

function getTripDateRange(month: string, days: number) {
  const [yearString, monthString] = month.split('-');
  const year = Number.parseInt(yearString, 10);
  const monthIndex = Number.parseInt(monthString, 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(days, 1) - 1);
  const toISO = (date: Date) => date.toISOString().slice(0, 10);
  return {
    startDate: toISO(start),
    endDate: toISO(end)
  };
}

function getLocationAssignments(days: number, locations: LocationSuggestion[]) {
  const assignments = new Map<number, LocationSuggestion[]>();
  if (days < 1 || locations.length === 0) {
    return assignments;
  }

  if (locations.length <= days) {
    const base = Math.floor(days / locations.length);
    let remainder = days % locations.length;
    let dayIndex = 1;
    for (const location of locations) {
      const span = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(remainder - 1, 0);
      for (let i = 0; i < span; i += 1) {
        const existing = assignments.get(dayIndex) ?? [];
        assignments.set(dayIndex, [...existing, location]);
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
    const dayLocations = locations.slice(cursor, cursor + count);
    cursor += count;
    assignments.set(dayIndex, dayLocations);
  }
  return assignments;
}

function getCardValidation(
  card: QuickAddCard,
  existingTripNames: Set<string>,
  localDuplicateNames: Set<string>
) {
  const name = card.name.trim();
  const days = parseCardDays(card.days);
  const normalizedName = normalizeTripName(name);
  const hasDuplicateName =
    Boolean(normalizedName) &&
    (existingTripNames.has(normalizedName) || localDuplicateNames.has(normalizedName));
  const nameError = !name ? 'Trip name is required.' : hasDuplicateName ? 'Cannot have duplicate trip names.' : null;
  const monthError = isMonthValue(card.month) ? null : 'Trip date is required.';
  let daysError: string | null = null;
  if (days === null) {
    daysError = 'Trip length is required.';
  } else if (!Number.isInteger(days) || days < 1) {
    daysError = 'Trip length must be at least 1 day.';
  } else if (days > DAYS_MAX) {
    daysError = `Trip length cannot exceed ${DAYS_MAX} days.`;
  }
  return {
    nameError,
    monthError,
    daysError,
    isComplete: !nameError && !monthError && !daysError,
    days
  };
}

function buildDuplicateName(baseName: string, existingNames: Set<string>) {
  const trimmed = baseName.trim();
  if (!trimmed) {
    return '';
  }
  const rootName = trimmed.replace(/\s*\(\d+\)\s*$/, '').trim();
  let suffix = 1;
  while (suffix < 5000) {
    const candidate = `${rootName} (${suffix})`;
    if (!existingNames.has(normalizeTripName(candidate))) {
      return candidate;
    }
    suffix += 1;
  }
  return `${rootName} (${Date.now()})`;
}

export function QuickAddTrips() {
  const router = useRouter();
  const { data: trips, isLoading, isError, error } = useTripsList();
  const [cards, setCards] = useState<QuickAddCard[]>([
    createEmptyCard(),
    createEmptyCard(),
    createEmptyCard()
  ]);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [collapsedCardIds, setCollapsedCardIds] = useState<Set<string>>(() => new Set());
  const [validationVisibleCardIds, setValidationVisibleCardIds] = useState<Set<string>>(() => new Set());
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestionsByCard, setSuggestionsByCard] = useState<Record<string, LocationSuggestion[]>>({});
  const [searchStatusByCard, setSearchStatusByCard] = useState<
    Record<string, { isLoading: boolean; error: string | null }>
  >({});
  const [showProgressNudge, setShowProgressNudge] = useState(true);

  useEffect(() => {
    setExpandedCardId((prev) => prev ?? cards[0]?.id ?? null);
  }, [cards]);

  useEffect(() => {
    const validIds = new Set(cards.map((card) => card.id));
    setCollapsedCardIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
    setValidationVisibleCardIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [cards]);

  useEffect(() => {
    if (cards.length === MIN_INITIAL_CARDS && cards.every((card) => Boolean(card.name.trim()))) {
      setCards((prev) => [...prev, createEmptyCard()]);
    }
  }, [cards]);

  useEffect(() => {
    const controllers: AbortController[] = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    cards.forEach((card) => {
      const query = card.locationQuery.trim();
      const cardId = card.id;
      if (query.length < 2) {
        setSuggestionsByCard((prev) => {
          if (!(cardId in prev)) return prev;
          const next = { ...prev };
          delete next[cardId];
          return next;
        });
        setSearchStatusByCard((prev) => {
          if (!(cardId in prev)) return prev;
          const next = { ...prev };
          delete next[cardId];
          return next;
        });
        return;
      }

      const controller = new AbortController();
      controllers.push(controller);

      setSearchStatusByCard((prev) => ({
        ...prev,
        [cardId]: { isLoading: true, error: null }
      }));

      const timer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(data?.error ?? 'Failed to search locations.');
          }
          const payload = (await response.json()) as { suggestions?: LocationSuggestion[] };
          setSuggestionsByCard((prev) => ({ ...prev, [cardId]: payload.suggestions ?? [] }));
          setSearchStatusByCard((prev) => ({
            ...prev,
            [cardId]: { isLoading: false, error: null }
          }));
        } catch (error) {
          if (controller.signal.aborted) return;
          setSearchStatusByCard((prev) => ({
            ...prev,
            [cardId]: {
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed to search locations.'
            }
          }));
        }
      }, 250);

      timers.push(timer);
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [cards]);

  const existingTripNames = useMemo(
    () => new Set((trips ?? []).map((trip) => normalizeTripName(trip.name))),
    [trips]
  );

  const localNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    cards.forEach((card) => {
      const key = normalizeTripName(card.name);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [cards]);

  const localDuplicateNames = useMemo(
    () => new Set(Array.from(localNameCounts.entries()).filter(([, count]) => count > 1).map(([name]) => name)),
    [localNameCounts]
  );

  const validations = useMemo(
    () => cards.map((card) => getCardValidation(card, existingTripNames, localDuplicateNames)),
    [cards, existingTripNames, localDuplicateNames]
  );

  const completedCount = validations.filter((validation) => validation.isComplete).length;
  const progressSegments = Array.from({ length: PROGRESS_TARGET }, (_, index) => index < completedCount);

  const hasPartialCards = cards.some((card, index) => !isCardEmpty(card) && !validations[index]?.isComplete);
  const hasAnyDuplicateNameError = validations.some((validation) => validation.nameError?.includes('duplicate'));
  const cardsToSave = cards
    .map((card, index) => ({ card, validation: validations[index] }))
    .filter(({ card, validation }) => validation?.isComplete && !isCardEmpty(card));

  const canSave = cardsToSave.length > 0 && !hasPartialCards && !hasAnyDuplicateNameError;
  const canUseGlobeCTA = canSave && completedCount >= PROGRESS_TARGET;

  function updateCard(cardId: string, updater: (card: QuickAddCard) => QuickAddCard) {
    setCards((prev) => prev.map((card) => (card.id === cardId ? updater(card) : card)));
  }

  function addLocationToCard(cardId: string, suggestion: LocationSuggestion) {
    updateCard(cardId, (card) => {
      if (card.locations.some((location) => location.id === suggestion.id)) {
        return {
          ...card,
          locationQuery: ''
        };
      }
      return {
        ...card,
        locations: [...card.locations, suggestion],
        locationQuery: ''
      };
    });
  }

  function removeLocationFromCard(cardId: string, locationId: string) {
    updateCard(cardId, (card) => ({
      ...card,
      locations: card.locations.filter((location) => location.id !== locationId)
    }));
  }

  function duplicateCard(cardId: string) {
    setCards((prev) => {
      const index = prev.findIndex((card) => card.id === cardId);
      if (index < 0) return prev;
      const source = prev[index];
      const nameSet = new Set(prev.map((card) => normalizeTripName(card.name)));
      const copy: QuickAddCard = {
        ...source,
        id: createId('quick-add'),
        name: buildDuplicateName(source.name, nameSet)
      };
      const next = [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      return next;
    });
  }

  function clearAll() {
    setCards([createEmptyCard(), createEmptyCard(), createEmptyCard()]);
    setExpandedCardId(null);
    setCollapsedCardIds(new Set());
    setValidationVisibleCardIds(new Set());
    setAttemptedSave(false);
    setSaveError(null);
    setSuggestionsByCard({});
    setSearchStatusByCard({});
    setShowProgressNudge(true);
  }

  function handleCardToggle(cardId: string) {
    if (expandedCardId === cardId) {
      setCollapsedCardIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
      setExpandedCardId(null);
      return;
    }

    if (expandedCardId) {
      setCollapsedCardIds((prev) => {
        const next = new Set(prev);
        next.add(expandedCardId);
        return next;
      });
    }

    if (collapsedCardIds.has(cardId)) {
      setValidationVisibleCardIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
    }

    setExpandedCardId(cardId);
  }

  async function saveTrips() {
    setAttemptedSave(true);
    setSaveError(null);
    if (!canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      for (const { card, validation } of cardsToSave) {
        const safeDays = validation.days ?? 1;
        const tripTypes = parseTokenList(card.tripTypesText);
        const hashtags = parseTokenList(card.hashtagsText);
        const dateRange = getTripDateRange(card.month, safeDays);

        const createResult = await createTrip({
          name: card.name.trim(),
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          links: [],
          tripTypes
        });

        const assignments = getLocationAssignments(safeDays, card.locations);
        const shouldPatchHashtags = hashtags.length > 0;
        for (let dayIndex = 1; dayIndex <= safeDays; dayIndex += 1) {
          const locationsForDay = assignments.get(dayIndex) ?? [];
          if (!shouldPatchHashtags && locationsForDay.length === 0) {
            continue;
          }
          await updateTripDay(createResult.trip.id, dayIndex, {
            hashtags: shouldPatchHashtags ? hashtags : undefined,
            locationsToAdd:
              locationsForDay.length > 0
                ? locationsForDay.map((location) => ({
                    displayName: location.displayName,
                    city: location.city ?? null,
                    region: location.region ?? null,
                    country: location.country ?? null,
                    lat: location.lat,
                    lng: location.lng
                  }))
                : undefined
          });
        }
      }

      router.push('/map?quickAdd=1');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save trips.');
    } finally {
      setIsSaving(false);
    }
  }

  const shouldShowNudge = showProgressNudge && completedCount >= 4;

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-300">
        Loading your trips...
      </div>
    );
  }

  if (isError && (error as Error & { status?: number } | null)?.status === 401) {
    return (
      <SignedOutTravelPrompt
        heading="Log in to build your travel history"
        body="Sign in to save trips with Quick Add."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">Build Your Travel History</h1>
        <p className="text-sm italic text-slate-300">Quickly add past trips to watch your travelog come alive</p>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {progressSegments.map((isFilled, index) => (
              <div
                key={`segment-${index}`}
                className={`h-2 w-10 rounded-full transition ${
                  isFilled ? 'bg-brand' : 'bg-slate-700'
                }`}
                aria-hidden="true"
              />
            ))}
            <span className="ml-2 text-xs text-slate-300">
              {Math.min(completedCount, PROGRESS_TARGET)} / {PROGRESS_TARGET}
            </span>
          </div>
          <Button
            type="button"
            onClick={() => {
              void saveTrips();
            }}
            disabled={!canUseGlobeCTA || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <Globe2 className="mr-2 h-4 w-4" />
                Globe
              </>
            )}
          </Button>
        </div>
      </section>

      {shouldShowNudge ? (
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-100">
            <Sparkles className="h-4 w-4" />
            <span>Save to see your progress.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowProgressNudge(false);
              }}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void saveTrips();
              }}
              disabled={!canSave || isSaving}
            >
              Save now
            </Button>
          </div>
        </section>
      ) : null}

      {saveError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{saveError}</div>
      ) : null}

      <div className="space-y-3">
        {cards.map((card, index) => {
          const isExpanded = expandedCardId === card.id;
          const validation = validations[index];
          const showErrors = attemptedSave || validationVisibleCardIds.has(card.id);
          const locationSuggestions = suggestionsByCard[card.id] ?? [];
          const searchStatus = searchStatusByCard[card.id];
          return (
            <section key={card.id} className="rounded-3xl border border-slate-800 bg-slate-900/40">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => {
                  handleCardToggle(card.id);
                }}
              >
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Trip {index + 1}</p>
                  <h2 className="text-base font-semibold text-white">{card.name.trim() || 'Untitled trip'}</h2>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
              </button>

              {isExpanded ? (
                <div className="space-y-4 border-t border-slate-800 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateCard(card.id, (current) => ({ ...current, isMoreOpen: !current.isMoreOpen }))}
                    >
                      {card.isMoreOpen ? 'Hide More' : 'More'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => duplicateCard(card.id)}
                      disabled={!card.name.trim()}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Trip Name <span className="text-red-300">*</span>
                      </label>
                      <input
                        type="text"
                        value={card.name}
                        onChange={(event) => updateCard(card.id, (current) => ({ ...current, name: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                        placeholder="Trip name"
                      />
                      {showErrors && validation?.nameError ? (
                        <p className="text-xs text-red-300">{validation.nameError}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Trip Date <span className="text-red-300">*</span>
                      </label>
                      <input
                        type="month"
                        value={card.month}
                        onChange={(event) => updateCard(card.id, (current) => ({ ...current, month: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      />
                      {showErrors && validation?.monthError ? (
                        <p className="text-xs text-red-300">{validation.monthError}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Trip Length (days) <span className="text-red-300">*</span>
                      </label>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        type="number"
                        min={1}
                        max={DAYS_MAX}
                        value={card.days}
                        onChange={(event) => {
                          const next = event.target.value.replace(/[^\d]/g, '');
                          updateCard(card.id, (current) => ({ ...current, days: next }));
                        }}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                        placeholder="e.g. 7"
                      />
                      {showErrors && validation?.daysError ? (
                        <p className="text-xs text-red-300">{validation.daysError}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Locations On Trip</label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={card.locationQuery}
                        onChange={(event) =>
                          updateCard(card.id, (current) => ({ ...current, locationQuery: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                        placeholder="Search city or location..."
                      />
                    </div>

                    {searchStatus?.isLoading ? <p className="text-xs text-slate-400">Searching locations...</p> : null}
                    {searchStatus?.error ? <p className="text-xs text-red-300">{searchStatus.error}</p> : null}
                    {!searchStatus?.isLoading && card.locationQuery.trim().length >= 2 && locationSuggestions.length ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-2">
                        {locationSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                            onClick={() => addLocationToCard(card.id, suggestion)}
                          >
                            <span>{suggestion.displayName}</span>
                            <Plus className="h-4 w-4 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {card.locations.length ? (
                      <div className="flex flex-wrap gap-2">
                        {card.locations.map((location) => (
                          <span
                            key={location.id}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
                          >
                            {location.displayName}
                            <button
                              type="button"
                              onClick={() => removeLocationFromCard(card.id, location.id)}
                              className="rounded-full text-slate-400 transition hover:text-white"
                              aria-label={`Remove ${location.displayName}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No locations selected yet.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Hashtags For Trip</label>
                    <input
                      type="text"
                      value={card.hashtagsText}
                      onChange={(event) =>
                        updateCard(card.id, (current) => ({ ...current, hashtagsText: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      placeholder="e.g. #beach #family"
                    />
                  </div>

                  {card.isMoreOpen ? (
                    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Trip Types (More)</label>
                      <input
                        type="text"
                        value={card.tripTypesText}
                        onChange={(event) =>
                          updateCard(card.id, (current) => ({ ...current, tripTypesText: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                        placeholder="e.g. #adventure #food"
                      />
                      <p className="text-xs text-slate-500">
                        These details are saved with the trip metadata and used when you continue journaling.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <Button type="button" variant="ghost" onClick={clearAll} disabled={isSaving}>
          Clear
        </Button>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              void saveTrips();
            }}
            disabled={!canSave || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
          <Button asChild variant="secondary">
            <Link href="/journal">Back to journal</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
