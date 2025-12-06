'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Compass, Globe2, X } from 'lucide-react';

import type { MapLocationEntry } from '@/features/trips/server';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { formatDateForDisplay } from '@/lib/date';

type GroupingMode = 'city' | 'country';

const COUNTRY_SOURCE_ID = 'globe-country-boundaries';
const COUNTRY_FILL_LAYER_ID = 'globe-country-fill';
const COUNTRY_OUTLINE_LAYER_ID = 'globe-country-outline';
const COUNTRY_NAME_FIELDS = ['name_en', 'name'];

type MapboxExpression = Exclude<Parameters<mapboxgl.Map['setFilter']>[1], undefined>;
const CITY_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none">
  <path
    d="M12 22s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11Z"
    fill="currentColor"
    fill-opacity="0.9"
  />
  <circle cx="12" cy="11" r="3.2" fill="#0f172a" />
</svg>
`;

type LocationGroup = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
  country: string | null;
  entries: Array<{
    tripId: string;
    tripName: string;
    date: string;
    dayIndex: number;
    highlight: string | null;
    hashtags: string[];
  }>;
};

type MapGlobeProps = {
  locations: MapLocationEntry[];
};

export function MapGlobe({ locations }: MapGlobeProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mode, setMode] = useState<GroupingMode>('city');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);
  const focusedGroupIdRef = useRef<string | null>(null);
  const selectedGroupIdRef = useRef<string | null>(null);

  const groups = useMemo(() => groupLocations(locations, mode), [locations, mode]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );
  const selectedEntry = selectedGroup?.entries[activeEntryIndex] ?? null;
  const totalEntries = selectedGroup?.entries.length ?? 0;
  const goToPreviousEntry = () => {
    setActiveEntryIndex((prev) => Math.max(prev - 1, 0));
  };
  const goToNextEntry = () => {
    setActiveEntryIndex((prev) => Math.min(prev + 1, Math.max(totalEntries - 1, 0)));
  };

  useEffect(() => {
    if (focusedGroupId && !groups.some((group) => group.id === focusedGroupId)) {
      setFocusedGroupId(null);
      focusedGroupIdRef.current = null;
    }
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
      selectedGroupIdRef.current = null;
    }
  }, [groups, focusedGroupId, selectedGroupId]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }
    if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      return;
    }
    mapboxgl.accessToken = env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe',
      zoom: 1.8,
      center: [0, 20]
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.on('load', () => {
      setMapLoaded(true);
      ensureCountryLayers(map);
    });
    mapRef.current = map;
    return () => {
      setMapLoaded(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (mode !== 'city') {
      return;
    }

    groups.forEach((group) => {
      const markerEl = document.createElement('div');
      markerEl.className =
        'group-marker flex h-10 w-10 items-center justify-center rounded-full bg-brand shadow-lg shadow-brand/40 ring-4 ring-brand/20';
      markerEl.innerHTML = CITY_MARKER_SVG;
      markerEl.style.cursor = 'pointer';
      markerEl.setAttribute('aria-label', group.label);
      markerEl.addEventListener('click', () => {
        const isFocused = focusedGroupIdRef.current === group.id;
        if (!isFocused) {
          setFocusedGroupId(group.id);
          focusedGroupIdRef.current = group.id;
          setSelectedGroupId(null);
          selectedGroupIdRef.current = null;
          setActiveEntryIndex(0);
          map.flyTo({ center: [group.lng, group.lat], zoom: 5, speed: 0.8 });
          return;
        }

        if (selectedGroupIdRef.current === group.id) {
          return;
        }

        setSelectedGroupId(group.id);
        selectedGroupIdRef.current = group.id;
        setActiveEntryIndex(0);
      });

      const marker = new mapboxgl.Marker(markerEl, { anchor: 'bottom' })
        .setLngLat([group.lng, group.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (groups.length) {
      const bounds = new mapboxgl.LngLatBounds();
      groups.forEach((group) => bounds.extend([group.lng, group.lat]));
      map.fitBounds(bounds, { padding: 100, maxZoom: 5.2 });
    }
  }, [groups, mode, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const hideLayer = (fillLayerId: string, outlineLayerId: string) => {
      if (map.getLayer(fillLayerId)) {
        map.setLayoutProperty(fillLayerId, 'visibility', 'none');
      }
      if (map.getLayer(outlineLayerId)) {
        map.setLayoutProperty(outlineLayerId, 'visibility', 'none');
      }
    };

    hideLayer(COUNTRY_FILL_LAYER_ID, COUNTRY_OUTLINE_LAYER_ID);

    if (mode === 'city') {
      return;
    }

    const { fillLayerId, outlineLayerId, propertyNames } = getHighlightConfig();
    if (!map.getLayer(fillLayerId) || !map.getLayer(outlineLayerId)) {
      return;
    }

    const targetNames = groups
      .map((group) => group.country)
      .filter(Boolean)
      .map((value) => normalizeName(value));
    const uniqueNames = Array.from(new Set(targetNames));

    const filterExpression = buildMultiPropertyMatchExpression(propertyNames, uniqueNames);

    if (!filterExpression) {
      hideLayer(fillLayerId, outlineLayerId);
      return;
    }

    map.setLayoutProperty(fillLayerId, 'visibility', 'visible');
    map.setLayoutProperty(outlineLayerId, 'visibility', 'visible');

    map.setFilter(fillLayerId, filterExpression);
    map.setFilter(outlineLayerId, filterExpression);

    if (groups.length) {
      const bounds = new mapboxgl.LngLatBounds();
      groups.forEach((group) => bounds.extend([group.lng, group.lat]));
      map.fitBounds(bounds, { padding: 120, maxZoom: 4.3 });
    }
  }, [mapLoaded, mode, groups]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (mode === 'city') {
      const canvas = map.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = '';
      }
      return;
    }

    const { fillLayerId, outlineLayerId, propertyNames } = getHighlightConfig();
    if (!map.getLayer(fillLayerId) || !map.getLayer(outlineLayerId)) {
      return;
    }

    const handleClick = (event: mapboxgl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const featureName = extractFirstMatchingName(feature, propertyNames);
      if (!featureName) return;

      const matchingGroup = groups.find((group) => normalizeName(group.country) === featureName);

      if (!matchingGroup) return;

      const isFocused = focusedGroupIdRef.current === matchingGroup.id;
      if (!isFocused) {
        setFocusedGroupId(matchingGroup.id);
        focusedGroupIdRef.current = matchingGroup.id;
        setSelectedGroupId(null);
        selectedGroupIdRef.current = null;
        setActiveEntryIndex(0);

        const bounds = computeFeatureBounds(feature);
        if (bounds) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 4.8 });
        } else if (typeof matchingGroup.lng === 'number' && typeof matchingGroup.lat === 'number') {
          map.flyTo({ center: [matchingGroup.lng, matchingGroup.lat], zoom: 4.2, speed: 0.8 });
        }
        return;
      }

      if (selectedGroupIdRef.current === matchingGroup.id) {
        return;
      }

      setSelectedGroupId(matchingGroup.id);
      selectedGroupIdRef.current = matchingGroup.id;
      setActiveEntryIndex(0);
    };

    const handleMouseEnter = () => {
      const canvas = map.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    };

    const handleMouseLeave = () => {
      const canvas = map.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = '';
      }
    };

    map.on('click', fillLayerId, handleClick);
    map.on('mouseenter', fillLayerId, handleMouseEnter);
    map.on('mouseleave', fillLayerId, handleMouseLeave);

    return () => {
      map.off('click', fillLayerId, handleClick);
      map.off('mouseenter', fillLayerId, handleMouseEnter);
      map.off('mouseleave', fillLayerId, handleMouseLeave);
      const canvas = map.getCanvas?.();
      if (canvas) {
        canvas.style.cursor = '';
      }
    };
  }, [mapLoaded, mode, groups]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (mode === 'city') {
      return;
    }

    const { fillLayerId, outlineLayerId, propertyNames } = getHighlightConfig();
    if (!map.getLayer(fillLayerId) || !map.getLayer(outlineLayerId)) {
      return;
    }

    const selectedValue = normalizeName(selectedGroup ? selectedGroup.country : null);

    if (!selectedValue) {
      map.setPaintProperty(fillLayerId, 'fill-opacity', 0.35);
      map.setPaintProperty(outlineLayerId, 'line-opacity', 0.7);
      return;
    }

    const isSelectedExpression = buildSingleValueMatchExpression(propertyNames, selectedValue);

    map.setPaintProperty(
      fillLayerId,
      'fill-opacity',
      ['case', isSelectedExpression, 0.65, 0.35] as any
    );
    map.setPaintProperty(
      outlineLayerId,
      'line-opacity',
      ['case', isSelectedExpression, 1, 0.6] as any
    );
  }, [mapLoaded, mode, selectedGroup]);

  useEffect(() => {
    setFocusedGroupId(null);
    focusedGroupIdRef.current = null;
    setSelectedGroupId(null);
    selectedGroupIdRef.current = null;
    setActiveEntryIndex(0);
  }, [mode]);

  useEffect(() => {
    if (!selectedGroup) {
      setActiveEntryIndex(0);
      return;
    }
    setActiveEntryIndex((prev) => Math.min(prev, selectedGroup.entries.length - 1));
  }, [selectedGroup]);

  if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-300">
        <p className="text-lg font-semibold">Mapbox token missing.</p>
        <p className="mt-2 text-sm text-slate-400">
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to enable the globe.
        </p>
      </div>
    );
  }

  if (!locations.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-300">
        <Globe2 className="mx-auto h-10 w-10 text-slate-500" />
        <p className="mt-3 text-lg font-semibold">No travel locations yet.</p>
        <p className="mt-2 text-sm text-slate-400">Add locations to your trip days and they’ll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold text-white">
          <Compass className="h-5 w-5 text-brand" />
          <span>Viewing by</span>
        </div>
        <div className="flex items-center gap-2">
          {(['city', 'country'] as GroupingMode[]).map((option) => (
            <Button
              key={option}
              type="button"
              variant={option === mode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setMode(option)}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div ref={mapContainerRef} className="h-[480px] w-full overflow-hidden rounded-3xl border border-slate-800" />
        {selectedGroup && selectedEntry ? (
          <>
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
              <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-black/50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {totalEntries} {totalEntries === 1 ? 'day' : 'days'} recorded
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">{selectedGroup.label}</h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-white"
                    onClick={() => {
                      setSelectedGroupId(null);
                      selectedGroupIdRef.current = null;
                    }}
                    aria-label="Close carousel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300 shadow-inner shadow-black/20">
                  <p className="text-sm font-semibold text-white">{selectedEntry.tripName}</p>
                  <p className="text-xs text-slate-400">
                    Day {selectedEntry.dayIndex} • {formatDateForDisplay(selectedEntry.date)}
                  </p>
                  {selectedEntry.highlight ? (
                    <p className="mt-2 text-sm text-slate-200">Highlight: {selectedEntry.highlight}</p>
                  ) : null}
                  {selectedEntry.hashtags.length ? (
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                      {selectedEntry.hashtags.map((tag) => `#${tag}`).join(' ')}
                    </p>
                  ) : null}
                  <Button variant="ghost" size="sm" className="mt-3 px-0 text-brand" asChild>
                    <a href={`/trips/${selectedEntry.tripId}#day-${selectedEntry.dayIndex}`}>Open trip</a>
                  </Button>
                </div>
                {totalEntries > 1 ? (
                  <div className="mt-4 flex items-center justify-between rounded-full border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={goToPreviousEntry}
                      disabled={activeEntryIndex === 0}
                      aria-label="Previous day"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-medium text-slate-300">
                      {activeEntryIndex + 1} / {totalEntries}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={goToNextEntry}
                      disabled={activeEntryIndex >= totalEntries - 1}
                      aria-label="Next day"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="absolute inset-0 z-20 rounded-3xl bg-slate-950/70 backdrop-blur-sm" />
          </>
        ) : null}
      </div>
    </div>
  );
}

function groupLocations(locations: MapLocationEntry[], mode: GroupingMode): LocationGroup[] {
  const map = new Map<string, LocationGroup>();

  for (const location of locations) {
    let key: string;
    let label: string;

    if (mode === 'city') {
      key = `${location.city?.toLowerCase() ?? 'unknown'}|${location.country?.toLowerCase() ?? 'unknown'}`;
      label = [location.city, location.country].filter(Boolean).join(', ') || location.displayName;
    } else {
      key = location.country?.toLowerCase() ?? 'unknown';
      label = location.country ?? location.displayName;
    }

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        label,
        lat: location.lat,
        lng: location.lng,
        city: location.city,
        region: location.region,
        country: location.country,
        entries: []
      });
    }

    const group = map.get(key)!;
    group.entries.push({
      tripId: location.tripId,
      tripName: location.tripName,
      date: location.date,
      dayIndex: location.dayIndex,
      highlight: location.highlight,
      hashtags: location.hashtags
    });
  }

  return Array.from(map.values());
}

function ensureCountryLayers(map: mapboxgl.Map) {
  try {
    if (!map.getSource(COUNTRY_SOURCE_ID)) {
      map.addSource(COUNTRY_SOURCE_ID, {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
      });
    }

    if (!map.getLayer(COUNTRY_FILL_LAYER_ID)) {
      map.addLayer({
        id: COUNTRY_FILL_LAYER_ID,
        type: 'fill',
        source: COUNTRY_SOURCE_ID,
        'source-layer': 'country_boundaries',
        layout: {
          visibility: 'none'
        },
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.35
        }
      });
    }

    if (!map.getLayer(COUNTRY_OUTLINE_LAYER_ID)) {
      map.addLayer({
        id: COUNTRY_OUTLINE_LAYER_ID,
        type: 'line',
        source: COUNTRY_SOURCE_ID,
        'source-layer': 'country_boundaries',
        layout: {
          visibility: 'none'
        },
        paint: {
          'line-color': '#38bdf8',
          'line-width': 1.5,
          'line-opacity': 0.7
        }
      });
    }
  } catch (error) {
    console.warn('Unable to load country boundaries layer', error);
  }
}

type HighlightConfig = {
  fillLayerId: string;
  outlineLayerId: string;
  propertyNames: string[];
};

function getHighlightConfig(): HighlightConfig {
  return {
    fillLayerId: COUNTRY_FILL_LAYER_ID,
    outlineLayerId: COUNTRY_OUTLINE_LAYER_ID,
    propertyNames: COUNTRY_NAME_FIELDS
  };
}

function normalizeName(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function computeFeatureBounds(feature: mapboxgl.MapboxGeoJSONFeature): mapboxgl.LngLatBounds | null {
  if (!feature.geometry) {
    return null;
  }

  const bounds = new mapboxgl.LngLatBounds();

  const extendWithCoordinates = (coordinates: any): void => {
    if (!coordinates) return;
    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      bounds.extend([coordinates[0], coordinates[1]]);
      return;
    }
    for (const coord of coordinates) {
      extendWithCoordinates(coord);
    }
  };

  extendWithCoordinates((feature.geometry as any).coordinates);

  return bounds.isEmpty() ? null : bounds;
}

function buildMultiPropertyMatchExpression(
  propertyNames: string[],
  targetNames: string[]
): MapboxExpression | null {
  if (!propertyNames.length || !targetNames.length) {
    return null;
  }

  const matches = propertyNames.map(
    (property) =>
      [
        'match',
        ['downcase', ['coalesce', ['get', property], '']],
        targetNames,
        true,
        false
      ] as MapboxExpression
  );

  return matches.length === 1 ? matches[0] : (['any', ...matches] as any);
}

function buildSingleValueMatchExpression(
  propertyNames: string[],
  targetName: string
): MapboxExpression {
  if (!propertyNames.length) {
    return ['literal', false] as any;
  }

  const comparisons = propertyNames.map(
    (property) =>
      [
        '==',
        ['downcase', ['coalesce', ['get', property], '']],
        targetName
      ] as MapboxExpression
  );

  return comparisons.length === 1 ? comparisons[0] : (['any', ...comparisons] as any);
}

function extractFirstMatchingName(
  feature: mapboxgl.MapboxGeoJSONFeature,
  propertyNames: string[]
): string | null {
  if (!feature?.properties) {
    return null;
  }

  for (const property of propertyNames) {
    const value = normalizeName(feature.properties[property] as string | undefined);
    if (value) {
      return value;
    }
  }

  return null;
}

