'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import type { MapLocationEntry } from '@/features/trips/server';
import { env } from '@/lib/env';
import { formatDateForDisplay } from '@/lib/date';

type TimelinePin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  country: string | null;
  tripId: string;
  tripName: string;
  date: string;
  dayIndex: number;
};

type TimelineStep = {
  id: string;
  monthKey: string;
  date: string;
  tripId: string;
  tripName: string;
  dayIndex: number;
  pin: TimelinePin | null;
  favoriteHighlight: string | null;
  dayPhotos: Array<{
    id: string;
    thumbnailUrl: string;
    fullUrl: string;
  }>;
};

type TimelineMonth = {
  key: string;
  label: string;
  steps: TimelineStep[];
};

type TimelinePlayerProps = {
  locations: MapLocationEntry[];
};

type TimelineStats = {
  travelDays: number;
  trips: number;
  countries: number;
};

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});

const CITY_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="none">
  <path
    d="M12 22s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11Z"
    fill="currentColor"
    fill-opacity="0.9"
  />
  <circle cx="12" cy="11" r="3.2" fill="#0f172a" />
</svg>
`;
const EMPTY_MONTH_ADVANCE_MS = 260;
const CITY_STEP_DURATION_MS = 1300;
const CITY_FLY_MIN_DURATION_MS = 850;
const CITY_FLY_MAX_DURATION_MS = 1400;
const CITY_FLY_MS_PER_KM = 0.065;

function formatMonthLabel(monthKey: string) {
  return monthFormatter.format(new Date(`${monthKey}-01T00:00:00Z`));
}

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function buildMonthRange(startMonthKey: string, endMonthKey: string) {
  const [startYear, startMonth] = startMonthKey.split('-').map((value) => Number(value));
  const [endYear, endMonth] = endMonthKey.split('-').map((value) => Number(value));
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonth - 1, 1));
  const keys: string[] = [];

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

function normalizeCityKey(entry: {
  city: string | null;
  region: string | null;
  country: string | null;
  displayName: string;
  lat: number;
  lng: number;
}) {
  const city = (entry.city ?? entry.displayName).trim().toLowerCase();
  const region = (entry.region ?? '').trim().toLowerCase();
  const country = (entry.country ?? '').trim().toLowerCase();
  // Keep this city-level for "same city again within trip" dedup, but include region/country
  // so different places with the same name don't collapse as easily.
  return `${city}|${region}|${country}`;
}

function hashStringToUnitInterval(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return (hash % 10_000) / 10_000;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  from: { lat: number; lng: number } | null,
  to: { lat: number; lng: number }
) {
  if (!from) return 0;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function clampDurationMs(value: number) {
  return Math.max(CITY_FLY_MIN_DURATION_MS, Math.min(CITY_FLY_MAX_DURATION_MS, value));
}

function buildTimeline(locations: MapLocationEntry[]): TimelineMonth[] {
  if (!locations.length) return [];

  type DayRecord = {
    tripDayId: string;
    tripId: string;
    tripName: string;
    tripStartDate: string;
    date: string;
    dayIndex: number;
    isFavorite: boolean;
    highlight: string | null;
    photos: Array<{
      id: string;
      thumbnailUrl: string;
      fullUrl: string;
    }>;
    locations: Array<{
      locationId: string;
      displayName: string;
      city: string | null;
      region: string | null;
      country: string | null;
      lat: number;
      lng: number;
    }>;
  };

  const dayMap = new Map<string, DayRecord>();

  for (const entry of locations) {
    const key = entry.tripDayId;
    const prev = dayMap.get(key);
    if (!prev) {
      dayMap.set(key, {
        tripDayId: entry.tripDayId,
        tripId: entry.tripId,
        tripName: entry.tripName,
        tripStartDate: entry.tripStartDate,
        date: entry.date,
        dayIndex: entry.dayIndex,
        isFavorite: Boolean(entry.dayIsFavorite),
        highlight: entry.highlight ?? null,
        photos: entry.dayPhotos,
        locations: [
          {
            locationId: entry.locationId,
            displayName: entry.displayName,
            city: entry.city,
            region: entry.region,
            country: entry.country,
            lat: entry.lat,
            lng: entry.lng
          }
        ]
      });
      continue;
    }

    prev.isFavorite = prev.isFavorite || Boolean(entry.dayIsFavorite);
    prev.highlight = prev.highlight ?? entry.highlight ?? null;
    if (entry.dayPhotos.length) {
      const seenPhotoIds = new Set(prev.photos.map((photo) => photo.id));
      for (const photo of entry.dayPhotos) {
        if (!seenPhotoIds.has(photo.id)) {
          prev.photos.push(photo);
          seenPhotoIds.add(photo.id);
        }
      }
    }
    prev.locations.push({
      locationId: entry.locationId,
      displayName: entry.displayName,
      city: entry.city,
      region: entry.region,
      country: entry.country,
      lat: entry.lat,
      lng: entry.lng
    });
  }

  const days = Array.from(dayMap.values()).sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byTripStart = a.tripStartDate.localeCompare(b.tripStartDate);
    if (byTripStart !== 0) return byTripStart;
    const byTripId = a.tripId.localeCompare(b.tripId);
    if (byTripId !== 0) return byTripId;
    return a.dayIndex - b.dayIndex;
  });

  const startMonthKey = getMonthKey(days[0]!.date);
  const endMonthKey = getMonthKey(days[days.length - 1]!.date);
  const monthKeys = buildMonthRange(startMonthKey, endMonthKey);

  const seenCitiesByTrip = new Map<string, Set<string>>();
  const stepsByMonth = new Map<string, TimelineStep[]>();

  const pushStep = (step: TimelineStep) => {
    const bucket = stepsByMonth.get(step.monthKey);
    if (bucket) {
      bucket.push(step);
      return;
    }
    stepsByMonth.set(step.monthKey, [step]);
  };

  for (const day of days) {
    const monthKey = getMonthKey(day.date);
    const seenSet = seenCitiesByTrip.get(day.tripId) ?? new Set<string>();
    if (!seenCitiesByTrip.has(day.tripId)) {
      seenCitiesByTrip.set(day.tripId, seenSet);
    }

    const dedupWithinDay = new Map<string, DayRecord['locations'][number]>();
    for (const location of day.locations) {
      const cityKey = normalizeCityKey(location);
      if (!dedupWithinDay.has(cityKey)) {
        dedupWithinDay.set(cityKey, location);
      }
    }

    const uniqueLocations = Array.from(dedupWithinDay.values()).sort((a, b) => {
      const labelA = (a.city ?? a.displayName).localeCompare(b.city ?? b.displayName);
      if (labelA !== 0) return labelA;
      return a.locationId.localeCompare(b.locationId);
    });

    let favoriteAttached = false;

    for (const location of uniqueLocations) {
      const cityKey = normalizeCityKey(location);
      if (seenSet.has(cityKey)) {
        continue;
      }
      seenSet.add(cityKey);

      const label =
        [location.city, location.country].filter(Boolean).join(', ') || location.displayName;

      const pin: TimelinePin = {
        id: `${day.tripDayId}|${cityKey}`,
        lat: location.lat,
        lng: location.lng,
        label,
        country: location.country,
        tripId: day.tripId,
        tripName: day.tripName,
        date: day.date,
        dayIndex: day.dayIndex
      };

      pushStep({
        id: pin.id,
        monthKey,
        date: day.date,
        tripId: day.tripId,
        tripName: day.tripName,
        dayIndex: day.dayIndex,
        pin,
        favoriteHighlight: !favoriteAttached && day.isFavorite ? day.highlight ?? 'Favorite day' : null,
        dayPhotos: day.photos
      });

      favoriteAttached = favoriteAttached || day.isFavorite;
    }

    if (day.isFavorite && !favoriteAttached) {
      pushStep({
        id: `${day.tripDayId}|favorite`,
        monthKey,
        date: day.date,
        tripId: day.tripId,
        tripName: day.tripName,
        dayIndex: day.dayIndex,
        pin: null,
        favoriteHighlight: day.highlight ?? 'Favorite day',
        dayPhotos: day.photos
      });
    }
  }

  return monthKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
    steps: stepsByMonth.get(key) ?? []
  }));
}

function TimelineGlobe({
  pins,
  activePin,
  onActivePinSettled
}: {
  pins: TimelinePin[];
  activePin: TimelinePin | null;
  onActivePinSettled?: (pinId: string | null) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const previousActivePinRef = useRef<TimelinePin | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) return;

    const markers = markersRef.current;
    mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe',
      zoom: 3.2,
      center: [0, 20]
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.on('load', () => {
      setMapLoaded(true);
    });
    mapRef.current = map;

    return () => {
      setMapLoaded(false);
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    for (const pin of pins) {
      if (markersRef.current.has(pin.id)) continue;
      const markerEl = document.createElement('div');
      markerEl.className = 'timeline-marker';
      markerEl.style.cursor = 'default';
      markerEl.style.color = '#38bdf8';
      markerEl.innerHTML = CITY_MARKER_SVG;
      markerEl.style.filter = 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))';

      const marker = new mapboxgl.Marker(markerEl, { anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
      markersRef.current.set(pin.id, marker);
    }
  }, [pins, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!activePin) {
      onActivePinSettled?.(null);
      return;
    }

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      onActivePinSettled?.(activePin.id);
    };

    const onMoveEnd = () => settle();
    map.once('moveend', onMoveEnd);
    const previousPin = previousActivePinRef.current;
    const distanceKm = haversineDistanceKm(
      previousPin ? { lat: previousPin.lat, lng: previousPin.lng } : null,
      { lat: activePin.lat, lng: activePin.lng }
    );
    const duration = clampDurationMs(CITY_FLY_MIN_DURATION_MS + distanceKm * CITY_FLY_MS_PER_KM);
    map.flyTo({
      center: [activePin.lng, activePin.lat],
      zoom: 5,
      duration,
      essential: true
    });

    previousActivePinRef.current = activePin;
    const fallbackTimer = window.setTimeout(() => settle(), duration + 350);
    return () => {
      window.clearTimeout(fallbackTimer);
      map.off('moveend', onMoveEnd);
    };
  }, [activePin, mapLoaded, onActivePinSettled]);

  return (
    <div
      ref={mapContainerRef}
      className="timeline-mapbox-shell h-[520px] w-full overflow-hidden rounded-3xl border border-slate-800"
    />
  );
}

export function TimelinePlayer({ locations }: TimelinePlayerProps) {
  const searchParams = useSearchParams();

  const months = useMemo(() => buildTimeline(locations), [locations]);

  const [running, setRunning] = useState(true);
  const [monthIndex, setMonthIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [pinsShown, setPinsShown] = useState<TimelinePin[]>([]);
  const [activePin, setActivePin] = useState<TimelinePin | null>(null);
  const [settledPinId, setSettledPinId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<TimelineStep | null>(null);
  const [initializedStepId, setInitializedStepId] = useState<string | null>(null);
  const [displayStartedAtMs, setDisplayStartedAtMs] = useState<number | null>(null);
  const [showLocationCard, setShowLocationCard] = useState(false);
  const [photoMoment, setPhotoMoment] = useState<{
    id: string;
    thumbnailUrl: string;
    fullUrl: string;
  } | null>(null);
  const [favoriteOverlay, setFavoriteOverlay] = useState<{
    tripName: string;
    date: string;
    dayIndex: number;
    highlight: string;
  } | null>(null);
  const [changedStats, setChangedStats] = useState<{
    travelDays: boolean;
    trips: boolean;
    countries: boolean;
  }>({
    travelDays: false,
    trips: false,
    countries: false
  });
  const previousStatsRef = useRef<TimelineStats | null>(null);

  const currentMonth = months[monthIndex] ?? null;
  const currentLabel = currentMonth?.label ?? 'Timeline';

  const jumpToMonth = (targetMonthIndex: number) => {
    const clampedMonthIndex = Math.max(0, Math.min(targetMonthIndex, Math.max(months.length - 1, 0)));
    const historicalPins: TimelinePin[] = [];
    const historicalPinIds = new Set<string>();
    for (let index = 0; index < clampedMonthIndex; index += 1) {
      for (const step of months[index]?.steps ?? []) {
        if (!step.pin) continue;
        if (historicalPinIds.has(step.pin.id)) continue;
        historicalPins.push(step.pin);
        historicalPinIds.add(step.pin.id);
      }
    }

    setRunning(false);
    setMonthIndex(clampedMonthIndex);
    setStepIndex(0);
    setPinsShown(historicalPins);
    setActivePin(null);
    setSettledPinId(null);
    setActiveStep(null);
    setInitializedStepId(null);
    setDisplayStartedAtMs(null);
    setShowLocationCard(false);
    setPhotoMoment(null);
    setFavoriteOverlay(null);
  };

  const stats = useMemo<TimelineStats>(() => {
    const dayKeys = new Set<string>();
    const tripIds = new Set<string>();
    const countries = new Set<string>();

    for (const pin of pinsShown) {
      dayKeys.add(`${pin.tripId}|${pin.date}`);
      tripIds.add(pin.tripId);
      if (pin.country) {
        countries.add(pin.country);
      }
    }

    return {
      travelDays: dayKeys.size,
      trips: tripIds.size,
      countries: countries.size
    };
  }, [pinsShown]);

  useEffect(() => {
    const previousStats = previousStatsRef.current;
    if (!previousStats) {
      previousStatsRef.current = stats;
      return;
    }

    const nextChangedStats = {
      travelDays: previousStats.travelDays !== stats.travelDays,
      trips: previousStats.trips !== stats.trips,
      countries: previousStats.countries !== stats.countries
    };

    previousStatsRef.current = stats;

    if (!nextChangedStats.travelDays && !nextChangedStats.trips && !nextChangedStats.countries) {
      return;
    }

    setChangedStats(nextChangedStats);
    const timer = window.setTimeout(() => {
      setChangedStats({
        travelDays: false,
        trips: false,
        countries: false
      });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [stats]);

  const backHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/map?${query}` : '/map';
  }, [searchParams]);

  useEffect(() => {
    if (!running) return;
    if (!months.length) return;
    if (monthIndex >= months.length) return;

    const month = months[monthIndex]!;

    if (month.steps.length === 0) {
      setInitializedStepId(null);
      setDisplayStartedAtMs(null);
      setFavoriteOverlay(null);
      setPhotoMoment(null);
      setShowLocationCard(false);
      const timer = window.setTimeout(() => {
        setMonthIndex((prev) => prev + 1);
        setStepIndex(0);
      }, EMPTY_MONTH_ADVANCE_MS);
      return () => window.clearTimeout(timer);
    }

    if (stepIndex >= month.steps.length) {
      setInitializedStepId(null);
      setDisplayStartedAtMs(null);
      setFavoriteOverlay(null);
      setPhotoMoment(null);
      setShowLocationCard(false);
      const timer = window.setTimeout(() => {
        setMonthIndex((prev) => prev + 1);
        setStepIndex(0);
      }, 250);
      return () => window.clearTimeout(timer);
    }

    const step = month.steps[stepIndex]!;
    if (initializedStepId === step.id) {
      return;
    }
    setInitializedStepId(step.id);
    setActiveStep(step);
    setDisplayStartedAtMs(null);
    setShowLocationCard(false);

    if (step.pin) {
      setSettledPinId(null);
      setPinsShown((prev) => {
        if (prev.some((pin) => pin.id === step.pin!.id)) {
          return prev;
        }
        return [...prev, step.pin!];
      });
      setActivePin(step.pin);
    } else {
      setActivePin(null);
      setSettledPinId(null);
    }

    if (step.dayPhotos.length > 0) {
      const photoIndex = Math.floor(hashStringToUnitInterval(`${step.id}|photo-index`) * step.dayPhotos.length);
      setPhotoMoment(step.dayPhotos[Math.min(photoIndex, step.dayPhotos.length - 1)] ?? null);
    } else {
      setPhotoMoment(null);
    }

    if (step.favoriteHighlight) {
      setFavoriteOverlay({
        tripName: step.tripName,
        date: step.date,
        dayIndex: step.dayIndex,
        highlight: step.favoriteHighlight
      });
    } else {
      setFavoriteOverlay(null);
    }

  }, [running, months, monthIndex, stepIndex, initializedStepId]);

  useEffect(() => {
    if (!running) return;
    if (!months.length) return;
    if (monthIndex >= months.length) return;
    const month = months[monthIndex]!;
    if (stepIndex >= month.steps.length) return;

    const step = month.steps[stepIndex]!;
    const landed = !step.pin || settledPinId === step.pin.id;
    if (!landed) return;

    if (displayStartedAtMs === null) {
      setDisplayStartedAtMs(Date.now());
      setShowLocationCard(Boolean(step.pin));
      return;
    }

    const delay = step.favoriteHighlight
      ? step.dayPhotos.length > 0
        ? 3800
        : 3000
      : CITY_STEP_DURATION_MS;
    const elapsed = Date.now() - displayStartedAtMs;
    const remaining = Math.max(delay - elapsed, 0);
    const timer = window.setTimeout(() => {
      setShowLocationCard(false);
      setStepIndex((prev) => prev + 1);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [running, months, monthIndex, stepIndex, displayStartedAtMs, settledPinId]);

  if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-300">
        <p className="text-lg font-semibold">Mapbox token missing.</p>
        <p className="mt-2 text-sm text-slate-400">
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to enable the timeline globe.
        </p>
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-300">
        <p className="text-lg font-semibold">No travel locations yet.</p>
        <p className="mt-2 text-sm text-slate-400">Add locations to your trip days and they’ll appear here.</p>
      </div>
    );
  }

  const finished = months.length > 0 && monthIndex >= months.length;

  return (
    <div className="space-y-5">
      <div className="relative flex items-start justify-end">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Timeline</p>
          <div className="pointer-events-auto mt-1 flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9"
              disabled={monthIndex <= 0}
              onClick={() => jumpToMonth(monthIndex - 1)}
              aria-label="Go to previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="min-w-[160px] text-center text-3xl font-semibold text-white md:min-w-[220px] md:text-5xl">
              {currentLabel}
            </h1>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8 md:h-9 md:w-9"
              disabled={!months.length || monthIndex >= months.length - 1}
              onClick={() => jumpToMonth(monthIndex + 1)}
              aria-label="Go to next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={() => setRunning((prev) => !prev)}>
            {running ? 'Pause' : 'Play'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-300 hover:text-white"
            asChild
          >
            <a href={backHref} aria-label="Exit timeline">
              <X className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="relative">
        <TimelineGlobe pins={pinsShown} activePin={activePin} onActivePinSettled={setSettledPinId} />

        {showLocationCard && activeStep?.pin ? (
          <div className="pointer-events-none absolute left-4 top-4 z-20 w-full max-w-xs rounded-2xl border border-sky-400/35 bg-slate-950/85 p-4 shadow-xl shadow-black/40 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">Now visiting</p>
            <p className="mt-2 text-lg font-semibold text-white">{activeStep.pin.label}</p>
            <p className="mt-1 text-xs text-slate-300">
              {activeStep.tripName} • Day {activeStep.dayIndex} • {formatDateForDisplay(activeStep.date)}
            </p>
          </div>
        ) : null}

        {photoMoment && !favoriteOverlay ? (
          <div className="pointer-events-none absolute bottom-[88px] right-3 z-40 w-36 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/90 shadow-xl shadow-black/45 backdrop-blur md:bottom-4 md:right-4 md:z-20 md:w-44">
            <div className="relative h-28 w-full">
              <Image
                src={photoMoment.thumbnailUrl}
                alt="Timeline memory"
                fill
                sizes="176px"
                className="object-cover"
              />
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Memory</p>
            </div>
          </div>
        ) : null}

        {favoriteOverlay ? (
          <>
            <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-4">
              <div className="pointer-events-auto w-full max-w-lg rounded-3xl border border-amber-500/30 bg-slate-950/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Favorite day</p>
                <p className="mt-2 text-sm font-semibold text-white">{favoriteOverlay.tripName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Day {favoriteOverlay.dayIndex} • {formatDateForDisplay(favoriteOverlay.date)}
                </p>
                {photoMoment ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/80">
                    <div className="relative h-44 w-full">
                      <Image
                        src={photoMoment.thumbnailUrl}
                        alt="Favorite day photo"
                        fill
                        sizes="(min-width: 768px) 520px, 92vw"
                        className="object-cover"
                      />
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-slate-200">{favoriteOverlay.highlight}</p>
              </div>
            </div>
            <div className="absolute inset-0 z-10 rounded-3xl bg-slate-950/45 backdrop-blur-[1px]" />
          </>
        ) : null}

        {!favoriteOverlay ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 md:hidden">
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`rounded-xl border bg-slate-950/88 px-2.5 py-2 shadow-lg shadow-black/30 backdrop-blur transition-all duration-300 ${
                  changedStats.travelDays
                    ? 'scale-[1.03] border-sky-300/70 bg-sky-500/18'
                    : 'border-slate-700/90'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Days</p>
                <p className="mt-1 text-xl font-semibold text-white">{stats.travelDays}</p>
              </div>
              <div
                className={`rounded-xl border bg-slate-950/88 px-2.5 py-2 shadow-lg shadow-black/30 backdrop-blur transition-all duration-300 ${
                  changedStats.trips
                    ? 'scale-[1.03] border-sky-300/70 bg-sky-500/18'
                    : 'border-slate-700/90'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Trips</p>
                <p className="mt-1 text-xl font-semibold text-white">{stats.trips}</p>
              </div>
              <div
                className={`rounded-xl border bg-slate-950/88 px-2.5 py-2 shadow-lg shadow-black/30 backdrop-blur transition-all duration-300 ${
                  changedStats.countries
                    ? 'scale-[1.03] border-sky-300/70 bg-sky-500/18'
                    : 'border-slate-700/90'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">Countries</p>
                <p className="mt-1 text-xl font-semibold text-white">{stats.countries}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden gap-3 md:grid md:grid-cols-3">
        <div className="rounded-3xl border border-slate-700 bg-slate-950/75 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Travel days</p>
          <p className="mt-2 text-4xl font-semibold text-white">{stats.travelDays}</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-950/75 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Trips</p>
          <p className="mt-2 text-4xl font-semibold text-white">{stats.trips}</p>
        </div>
        <div className="rounded-3xl border border-slate-700 bg-slate-950/75 p-5 shadow-lg shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Unique countries</p>
          <p className="mt-2 text-4xl font-semibold text-white">{stats.countries}</p>
        </div>
      </div>

      {finished ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5 text-slate-200">
          <p className="font-semibold text-white">Timeline finished.</p>
          <p className="mt-1 text-sm text-slate-400">Use Exit to return to the globe.</p>
        </div>
      ) : null}
    </div>
  );
}

