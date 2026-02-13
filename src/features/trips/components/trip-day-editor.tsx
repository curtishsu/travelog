'use client';

import { useMemo, useState, useEffect, useRef, useDeferredValue, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Hash, Lock, MapPin, Plus, Search, Unlock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MinimalMarkdown } from '@/components/ui/minimal-markdown';
import type { LocationInput } from '@/features/trips/api';
import {
  useDeletePhoto,
  useTripDetail,
  useTripSuggestions,
  useUpdateTripDay
} from '@/features/trips/hooks';
import type { TripDayWithRelations, TripPhoto, TripDetail } from '@/features/trips/types';
import { formatDateForDisplay } from '@/lib/date';
import { PhotoGallery } from '@/features/photos/components/photo-gallery';

type TripDayEditorProps = {
  tripId: string;
  day: TripDayWithRelations;
  hasNextDay: boolean;
  onNavigateToNext: () => void;
  onNavigateToReflection?: () => void;
  isTripLocked: boolean;
};

function areHashtagsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const normalizedA = [...a].map((value) => value.toLowerCase()).sort();
  const normalizedB = [...b].map((value) => value.toLowerCase()).sort();
  return normalizedA.every((value, index) => value === normalizedB[index]);
}

function areStringArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function createSearchId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `search-${Math.random().toString(36).slice(2, 10)}`;
}

export function TripDayEditor({
  tripId,
  day,
  hasNextDay,
  onNavigateToNext,
  onNavigateToReflection,
  isTripLocked
}: TripDayEditorProps) {
  const initialHighlight = day.highlight ?? '';
  const initialJournal = day.journal_entry ?? '';
  const initialHashtags = useMemo(
    () => (day.trip_day_hashtags ?? []).map((tag) => tag.hashtag),
    [day.trip_day_hashtags]
  );

  const [highlight, setHighlight] = useState(initialHighlight);
  const [journalEntry, setJournalEntry] = useState(initialJournal);
  const [hashtags, setHashtags] = useState<string[]>(initialHashtags);
  const [hashtagDraft, setHashtagDraft] = useState('');
  const [removedLocationIds, setRemovedLocationIds] = useState<string[]>([]);
  const [pendingLocationsToAdd, setPendingLocationsToAdd] = useState<LocationInput[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDayLocked, setIsDayLocked] = useState(day.is_locked ?? false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [showHighlightPreview, setShowHighlightPreview] = useState(false);
  const [showJournalPreview, setShowJournalPreview] = useState(false);
  const { mutateAsync, isPending, error } = useUpdateTripDay();
  const queryClient = useQueryClient();
  const { mutateAsync: deletePhotoMutation, isPending: isDeletingPhoto } = useDeletePhoto();
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [initialPhotoIds, setInitialPhotoIds] = useState<string[]>(
    () => [...(day.photos ?? []).map((photo) => photo.id)].sort()
  );
  const { data: suggestions } = useTripSuggestions();
  const [locationSearches, setLocationSearches] = useState<Array<{ id: string; query: string }>>([
    { id: createSearchId(), query: '' }
  ]);
  const [locationSuggestionsBySearch, setLocationSuggestionsBySearch] = useState<
    Record<string, LocationSuggestion[]>
  >({});
  const [locationSearchStatus, setLocationSearchStatus] = useState<
    Record<string, { isLoading: boolean; error: string | null }>
  >({});
  const { data: tripDetail } = useTripDetail(tripId);

  type LocationSuggestion = {
    id: string;
    displayName: string;
    city: string | null;
    region: string | null;
    country: string | null;
    lat: number;
    lng: number;
  };

  type PastCitySuggestion = {
    id: string;
    city: string;
    region: string | null;
    country: string | null;
    displayName: string;
    lat: number;
    lng: number;
  };

  useEffect(() => {
    setHighlight(initialHighlight);
    setJournalEntry(initialJournal);
    setHashtags(initialHashtags);
    setRemovedLocationIds([]);
    setPendingLocationsToAdd([]);
    setFeedback(null);
    setIsDayLocked(day.is_locked ?? false);
    setLockError(null);
    setInitialPhotoIds([...(day.photos ?? []).map((photo) => photo.id)].sort());
  }, [initialHighlight, initialJournal, initialHashtags, day.id, day.is_locked]);

  const locations = useMemo(() => {
    const existing = (day.trip_locations ?? []).filter((location) => !removedLocationIds.includes(location.id));
    const pending = pendingLocationsToAdd.map((location, index) => ({
      ...location,
      id: `pending-${index}`
    }));
    return [...existing, ...pending];
  }, [day.trip_locations, pendingLocationsToAdd, removedLocationIds]);

  const existingCityKeys = useMemo(() => {
    const keys = new Set<string>();
    locations.forEach((location) => {
      const cityValue =
        'display_name' in location ? location.city : location.city ?? null;
      const countryValue =
        'display_name' in location ? location.country : location.country ?? null;
      const cityName = typeof cityValue === 'string' ? cityValue.trim() : '';
      if (!cityName) {
        return;
      }
      const countryName = typeof countryValue === 'string' ? countryValue.trim() : '';
      const keyParts = [cityName.toLowerCase()];
      if (countryName) {
        keyParts.push(countryName.toLowerCase());
      }
      keys.add(keyParts.join('|'));
    });
    return keys;
  }, [locations]);

  const pastCitySuggestions = useMemo<PastCitySuggestion[]>(() => {
    if (!tripDetail?.trip_days?.length) {
      return [];
    }
    const days = [...tripDetail.trip_days].sort((a, b) => b.day_index - a.day_index);
    const seen = new Map<string, PastCitySuggestion>();
    for (const tripDay of days) {
      for (const location of tripDay.trip_locations ?? []) {
        const cityName = location.city?.trim();
        if (!cityName) {
          continue;
        }
        const countryName = location.country?.trim() ?? null;
        const keyParts = [cityName.toLowerCase()];
        if (countryName) {
          keyParts.push(countryName.toLowerCase());
        }
        const identifier = keyParts.join('|');
        if (existingCityKeys.has(identifier) || seen.has(identifier)) {
          continue;
        }
        seen.set(identifier, {
          id: location.id,
          city: cityName,
          region: location.region?.trim() || null,
          country: countryName,
          displayName: location.display_name ?? cityName,
          lat: location.lat,
          lng: location.lng
        });
      }
    }
    return Array.from(seen.values());
  }, [tripDetail?.trip_days, existingCityKeys]);

  useEffect(() => {
    const activeIds = new Set(locationSearches.map((search) => search.id));

    setLocationSuggestionsBySearch((prev) => {
      let changed = false;
      const next: Record<string, LocationSuggestion[]> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (activeIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setLocationSearchStatus((prev) => {
      let changed = false;
      const next: Record<string, { isLoading: boolean; error: string | null }> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (activeIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    const controllers: AbortController[] = [];

    locationSearches.forEach(({ id, query }) => {
      const trimmed = query.trim();

      if (trimmed.length < 2) {
        setLocationSuggestionsBySearch((prev) => {
          if (!(id in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setLocationSearchStatus((prev) => {
          if (!(id in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }

      const controller = new AbortController();
      controllers.push(controller);

      setLocationSearchStatus((prev) => ({
        ...prev,
        [id]: { isLoading: true, error: null }
      }));

      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/locations/search?q=${encodeURIComponent(trimmed)}`, {
            signal: controller.signal
          });
          const data = (await response.json().catch(() => null)) as
            | { suggestions?: LocationSuggestion[]; error?: string }
            | null;

          if (!response.ok || !data) {
            const message = data?.error ?? 'Failed to search locations.';
            throw new Error(message);
          }

          const results = Array.isArray(data.suggestions) ? data.suggestions : [];

          setLocationSuggestionsBySearch((prev) => ({
            ...prev,
            [id]: results
          }));
          setLocationSearchStatus((prev) => ({
            ...prev,
            [id]: { isLoading: false, error: null }
          }));
        } catch (fetchError) {
          if (controller.signal.aborted) {
            return;
          }
          const message =
            fetchError instanceof Error ? fetchError.message : 'Failed to search locations.';
          setLocationSearchStatus((prev) => ({
            ...prev,
            [id]: { isLoading: false, error: message }
          }));
        }
      }, 300);

      timeouts.push(timeoutId);
    });

    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      controllers.forEach((controller) => controller.abort());
    };
  }, [locationSearches]);

  function handleAddHashtag() {
    const normalized = hashtagDraft.trim().replace(/^#/, '').toLowerCase();
    if (!normalized) {
      return;
    }
    if (hashtags.includes(normalized)) {
      setHashtagDraft('');
      return;
    }
    setHashtags([...hashtags, normalized]);
    setHashtagDraft('');
  }

  function handleRemoveHashtag(index: number) {
    setHashtags((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleRemoveLocation(locationId: string) {
    if (locationId.startsWith('pending-')) {
      const pendingIndex = Number.parseInt(locationId.split('-')[1] ?? '-1', 10);
      setPendingLocationsToAdd((prev) => prev.filter((_, index) => index !== pendingIndex));
      return;
    }
    setRemovedLocationIds((prev) => (prev.includes(locationId) ? prev : [...prev, locationId]));
  }

  function handleAddLocation(location: LocationInput) {
    setPendingLocationsToAdd((prev) => [...prev, location]);
  }

  function handleRemoveLocationSearch(searchId: string) {
    setLocationSearches((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((search) => search.id !== searchId);
      return next.length ? next : prev;
    });
    setLocationSuggestionsBySearch((prev) => {
      if (!(searchId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[searchId];
      return next;
    });
    setLocationSearchStatus((prev) => {
      if (!(searchId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[searchId];
      return next;
    });
  }

  function handleSelectLocation(searchId: string, suggestion: LocationSuggestion) {
    const isDuplicate = locations.some((location) => {
      const normalizedExisting =
        'display_name' in location ? location.display_name : location.displayName ?? '';
      return normalizedExisting.toLowerCase() === suggestion.displayName.toLowerCase();
    });

    if (isDuplicate) {
      setLocationSearches((prev) =>
        prev.map((search) => (search.id === searchId ? { ...search, query: '' } : search))
      );
      return;
    }

    handleAddLocation({
      displayName: suggestion.displayName,
      city: suggestion.city ?? null,
      region: suggestion.region ?? null,
      country: suggestion.country ?? null,
      lat: suggestion.lat,
      lng: suggestion.lng
    });
    setLocationSearches((prev) =>
      prev.map((search) => (search.id === searchId ? { ...search, query: '' } : search))
    );
    setFeedback('Location queued. Remember to save the day.');
  }

  function handleSelectPastCity(searchId: string, suggestion: PastCitySuggestion) {
    const isDuplicate = locations.some((location) => {
      const normalizedExisting =
        'display_name' in location ? location.display_name : location.displayName ?? '';
      return normalizedExisting.toLowerCase() === suggestion.displayName.toLowerCase();
    });

    if (!isDuplicate) {
      handleAddLocation({
        displayName: suggestion.displayName,
        city: suggestion.city ?? null,
        region: suggestion.region ?? null,
        country: suggestion.country ?? null,
        lat: suggestion.lat,
        lng: suggestion.lng
      });
      setFeedback('Location queued. Remember to save the day.');
    }

    setLocationSearches((prev) =>
      prev.map((search) => (search.id === searchId ? { ...search, query: '' } : search))
    );
  }

  const filteredHashtagSuggestions = useMemo(() => {
    if (!suggestions?.hashtags?.length || !hashtagDraft.trim()) {
      return [];
    }
    const draft = hashtagDraft.trim().replace(/^#/, '').toLowerCase();
    return suggestions.hashtags
      .filter((tag) => tag.includes(draft) && !hashtags.includes(tag))
      .slice(0, 6);
  }, [suggestions?.hashtags, hashtagDraft, hashtags]);
  const currentPhotoIds = useMemo(
    () => [...(day.photos ?? []).map((photo) => photo.id)].sort(),
    [day.photos]
  );
  const hasPhotoChanges = !areStringArraysEqual(currentPhotoIds, initialPhotoIds);
  const hasChanges =
    highlight !== initialHighlight ||
    journalEntry !== initialJournal ||
    !areHashtagsEqual(hashtags, initialHashtags) ||
    removedLocationIds.length > 0 ||
    pendingLocationsToAdd.length > 0 ||
    hasPhotoChanges;
  const effectiveIsLocked = isTripLocked || isDayLocked;
  const deferredHighlight = useDeferredValue(highlight);
  const deferredJournalEntry = useDeferredValue(journalEntry);

  async function handleToggleDayLock() {
    if (isTripLocked) {
      return;
    }
    if (hasChanges) {
      setLockError('Save this day before changing the lock.');
      return;
    }
    setLockError(null);
    setFeedback(null);
    try {
      const result = await mutateAsync({
        tripId,
        dayIndex: day.day_index,
        payload: {
          isLocked: !isDayLocked
        }
      });
      setIsDayLocked(result.is_locked ?? !isDayLocked);
      setFeedback(!isDayLocked ? 'Day locked.' : 'Day unlocked.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update day lock.';
      setLockError(message);
    }
  }

  async function handleSave() {
    const shouldNavigateAfterSave = hasNextDay;
    const shouldNavigateToReflection = !hasNextDay && typeof onNavigateToReflection === 'function';

    if (!hasChanges) {
      if (shouldNavigateAfterSave) {
        onNavigateToNext();
      } else if (shouldNavigateToReflection) {
        onNavigateToReflection();
      }
      return;
    }

    setFeedback(null);
    setLockError(null);
    try {
      const result = await mutateAsync({
        tripId,
        dayIndex: day.day_index,
        payload: {
          highlight,
          journalEntry,
          hashtags,
          locationsToAdd: pendingLocationsToAdd.length ? pendingLocationsToAdd : undefined,
          locationIdsToRemove: removedLocationIds.length ? removedLocationIds : undefined
        }
      });

      setHighlight(result.highlight ?? '');
      setJournalEntry(result.journal_entry ?? '');
      setHashtags(result.trip_day_hashtags.map((tag) => tag.hashtag));
      setRemovedLocationIds([]);
      setPendingLocationsToAdd([]);
      setInitialPhotoIds(currentPhotoIds);
      setFeedback('Day saved.');
      setIsDayLocked(result.is_locked ?? isDayLocked);

      if (shouldNavigateAfterSave) {
        onNavigateToNext();
      } else if (shouldNavigateToReflection) {
        onNavigateToReflection();
      }
    } catch (mutationError) {
      console.error(mutationError);
    }
  }

  async function handlePhotoSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    console.log(
      '[photo upload] selected files',
      Array.from(files).map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size
      }))
    );

    setPhotoError(null);
    setIsUploadingPhotos(true);

    try {
      await uploadFilesWithConcurrency(Array.from(files), 3);
    } catch (uploadError) {
      console.error(uploadError);
      setPhotoError(uploadError instanceof Error ? uploadError.message : 'Failed to upload photo.');
    } finally {
      setIsUploadingPhotos(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function uploadFilesWithConcurrency(files: File[], concurrencyLimit: number) {
    let cursor = 0;
    const workerCount = Math.min(concurrencyLimit, files.length);

    async function worker() {
      while (cursor < files.length) {
        const index = cursor;
        cursor += 1;
        await uploadSinglePhoto(files[index]);
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  async function uploadSinglePhoto(file: File) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Photos must be 10 MB or smaller.');
    }

    console.log('[photo upload] start', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tripId', tripId);
    formData.append('tripDayId', day.id);

    const response = await fetch('/api/photos/upload', {
      method: 'POST',
      body: formData
    });

    console.log('[photo upload] response', {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message = errorBody?.error ?? 'Failed to upload photo.';
      throw new Error(message);
    }

    const payload = (await response.json()) as { photo: TripPhoto };
    const uploadedPhoto = payload.photo;

    queryClient.setQueryData(['trip', tripId], (prev: TripDetail | undefined) => {
      if (!prev) {
        return prev;
      }
      const nextDays = prev.trip_days.map((existingDay) => {
        if (existingDay.id === day.id) {
          return { ...existingDay, photos: [...existingDay.photos, uploadedPhoto] };
        }
        return existingDay;
      });
      return { ...prev, trip_days: nextDays };
    });
  }

  async function handleDeletePhoto(photo: TripPhoto) {
    const confirmed = window.confirm('Delete this photo? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    await deletePhotoMutation({ tripId, tripDayId: day.id, photoId: photo.id });
  }

  const hasLocations = locations.length > 0;

  const lockButtonDisabled = isTripLocked || hasChanges || isPending;
  const lockButtonLabel = isTripLocked
    ? 'Trip locked'
    : isDayLocked
    ? 'Unlock day'
    : 'Lock day';
  const lockButtonTitle = isTripLocked
    ? 'Trip content lock overrides day locks. Unlock the trip to change this setting.'
    : hasChanges
    ? 'Save this day before changing the lock state.'
    : isDayLocked
    ? 'Unlock this day'
    : 'Lock this day';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-white">
            Day {day.day_index}{' '}
            <span className="text-sm font-normal text-slate-400">• {formatDateForDisplay(day.date)}</span>
          </h2>
          {isTripLocked ? (
            <p className="text-xs text-slate-400">
              Trip content is globally locked. Unlock the trip to adjust day-level privacy.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleToggleDayLock}
          disabled={lockButtonDisabled}
          aria-label={lockButtonLabel}
          title={lockButtonTitle}
        >
          {effectiveIsLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {lockButtonLabel}
        </Button>
      </header>
      {lockError ? <p className="text-sm text-red-300">{lockError}</p> : null}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPin className="h-4 w-4 text-slate-400" />
            Locations
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={() =>
              setLocationSearches((prev) => [
                ...prev,
                { id: createSearchId(), query: '' }
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add location
          </Button>
        </div>
        <div className="space-y-4">
          {locationSearches.map((search, index) => {
            const trimmedQuery = search.query.trim();
            const shouldShowSuggestions = trimmedQuery.length > 1;
            const suggestionsForRow = locationSuggestionsBySearch[search.id] ?? [];
            const status = locationSearchStatus[search.id];
            const isLoadingSuggestions = status?.isLoading ?? false;
            const errorMessage = status?.error ?? null;
            const normalizedQuery = trimmedQuery.toLowerCase();
            const matchingPastCities = pastCitySuggestions
              .filter((suggestion) => {
                if (!trimmedQuery) {
                  return true;
                }
                const fields = [
                  suggestion.city,
                  suggestion.region ?? '',
                  suggestion.country ?? '',
                  suggestion.displayName
                ];
                return fields.some((field) => field.toLowerCase().includes(normalizedQuery));
              })
              .slice(0, 6);

            let remoteSuggestionContent: ReactNode;

            if (!shouldShowSuggestions) {
              remoteSuggestionContent = (
                <p className="text-xs text-slate-500">Type at least two characters to see suggestions.</p>
              );
            } else if (isLoadingSuggestions) {
              remoteSuggestionContent = (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
                  Searching locations…
                </div>
              );
            } else if (errorMessage) {
              remoteSuggestionContent = (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              );
            } else if (suggestionsForRow.length) {
              remoteSuggestionContent = (
                <ul className="space-y-1 rounded-2xl border border-slate-800 bg-slate-950 p-2">
                  {suggestionsForRow.map((suggestion) => (
                    <li key={`${search.id}-${suggestion.id}`}>
                      <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                        onClick={() => handleSelectLocation(search.id, suggestion)}
                      >
                        <p className="font-medium text-white">{suggestion.displayName}</p>
                        <p className="text-xs text-slate-400">
                          {[suggestion.city, suggestion.region, suggestion.country]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            } else {
              remoteSuggestionContent = (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
                  No locations found. Keep typing to refine your search.
                </div>
              );
            }

            return (
              <div key={search.id} className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={search.query}
                    onChange={(event) =>
                      setLocationSearches((prev) =>
                        prev.map((item) =>
                          item.id === search.id ? { ...item, query: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Start typing to search for a location…"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                  />
                  {index > 0 ? (
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                      onClick={() => handleRemoveLocationSearch(search.id)}
                      aria-label="Remove search row"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                {matchingPastCities.length ? (
                  <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Previous cities this trip
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchingPastCities.map((suggestion) => {
                        const locationSecondary = [suggestion.region, suggestion.country]
                          .filter(Boolean)
                          .join(', ');
                        return (
                          <button
                            key={`${search.id}-past-${suggestion.id}`}
                            type="button"
                            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-brand hover:text-white"
                            onClick={() => handleSelectPastCity(search.id, suggestion)}
                          >
                            <span>{suggestion.city}</span>
                            {locationSecondary ? (
                              <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-500">
                                {locationSecondary}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {remoteSuggestionContent}
              </div>
            );
          })}
        </div>
        {hasLocations ? (
          <ul className="space-y-2">
            {locations.map((location) => {
              const displayName =
                'display_name' in location ? location.display_name : location.displayName ?? '';
              const city =
                'display_name' in location ? location.city ?? '' : location.city ?? '';
              const country =
                'display_name' in location ? location.country ?? '' : location.country ?? '';
              return (
                <li
                  key={location.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200"
                >
                  <div>
                    <p className="font-medium text-white">{displayName}</p>
                    <p className="text-xs text-slate-400">
                      {[city, country].filter(Boolean).join(', ')}
                      {location.id.startsWith('pending-') ? ' • Pending save' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-red-300"
                    onClick={() => handleRemoveLocation(location.id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
      <div className="grid gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-slate-200">Highlight</label>
            <button
              type="button"
              className="text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
              onClick={() => setShowHighlightPreview((prev) => !prev)}
            >
              {showHighlightPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
          <input
            type="text"
            value={highlight}
            onChange={(event) => setHighlight(event.target.value)}
            maxLength={240}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Best moment of the day"
          />
          <p className="text-xs text-slate-500">{240 - highlight.length} characters left</p>
          {showHighlightPreview ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <MinimalMarkdown value={deferredHighlight} />
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium text-slate-200">Journal entry</label>
            <button
              type="button"
              className="text-xs font-medium text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
              onClick={() => setShowJournalPreview((prev) => !prev)}
            >
              {showJournalPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
          <textarea
            value={journalEntry}
            onChange={(event) => setJournalEntry(event.target.value)}
            rows={6}
            maxLength={7000}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Write everything you want to remember."
          />
          <p className="text-xs text-slate-500">{7000 - journalEntry.length} characters left</p>
          {showJournalPreview ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
              <MinimalMarkdown value={deferredJournalEntry} />
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Hash className="h-4 w-4 text-slate-400" />
              Hashtags
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-100"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveHashtag(index)}
                  className="text-slate-400 transition hover:text-white"
                  aria-label={`Remove hashtag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={hashtagDraft}
              onChange={(event) => setHashtagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  handleAddHashtag();
                }
              }}
              placeholder="Type a tag and press space"
              className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <Button type="button" variant="secondary" onClick={handleAddHashtag}>
              Add
            </Button>
          </div>
          {filteredHashtagSuggestions.length ? (
            <div className="flex flex-wrap gap-2">
              {filteredHashtagSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-brand hover:text-white"
                  onClick={() => {
                    setHashtags([...hashtags, suggestion]);
                    setHashtagDraft('');
                  }}
                >
                  #{suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Photos</div>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelection}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhotos}
              >
                <Plus className="h-4 w-4" />
                Add photos
              </Button>
            </div>
          </div>
          {isUploadingPhotos ? <p className="text-xs text-slate-400">Uploading photos…</p> : null}
          {photoError ? <p className="text-xs text-red-300">{photoError}</p> : null}
          {day.photos?.length ? (
            <PhotoGallery photos={day.photos} onDelete={handleDeletePhoto} />
          ) : (
            <p className="text-sm text-slate-500">No photos added yet.</p>
          )}
          {isDeletingPhoto ? <p className="text-xs text-slate-400">Removing photo…</p> : null}
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error.message}</p> : null}
      {feedback ? <p className="text-sm text-emerald-300">{feedback}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" disabled={isPending || !hasChanges} onClick={handleSave}>
          {isPending ? 'Saving…' : 'Save day'}
        </Button>
      </div>
    </div>
  );
}

