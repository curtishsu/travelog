'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import type { Geometry, GeometryCollection } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe2, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import type { MapLocationEntry } from '@/features/trips/server';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { formatDateForDisplay } from '@/lib/date';
import {
  buildTripGroupMembersIndex,
  filterTripIds,
  type TripFilterClause,
  type TripFilterTripMeta
} from '@/features/trips/filtering';
import { TripFiltersDialog } from '@/features/trips/components/trip-filters-dialog';
import { useTripGroups } from '@/features/trips/hooks';

type GroupingMode = 'city' | 'country';
type GroupByMode = 'none' | 'year' | 'tripType';

const COUNTRY_SOURCE_ID = 'globe-country-boundaries';
const COUNTRY_FILL_LAYER_ID = 'globe-country-fill';
const COUNTRY_OUTLINE_LAYER_ID = 'globe-country-outline';
const COUNTRY_NAME_FIELDS = ['name_en', 'name'];

type MapboxExpression = Exclude<Parameters<mapboxgl.Map['setFilter']>[1], undefined>;
type MapboxPaintValue = Exclude<Parameters<mapboxgl.Map['setPaintProperty']>[2], undefined>;
type GeometryWithCoordinates = Exclude<Geometry, GeometryCollection>;
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
    tripTypes: string[];
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
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<GroupingMode>('city');
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [controlsMenuOpen, setControlsMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterClauses, setFilterClauses] = useState<TripFilterClause[]>([]);
  const [draftFilterClauses, setDraftFilterClauses] = useState<TripFilterClause[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);
  const focusedGroupIdRef = useRef<string | null>(null);
  const selectedGroupIdRef = useRef<string | null>(null);

  const { data: tripGroups } = useTripGroups();
  const groupMembersIndex = useMemo(
    () => buildTripGroupMembersIndex(tripGroups ?? []),
    [tripGroups]
  );

  const tripMetas = useMemo(() => {
    const map = new Map<string, TripFilterTripMeta>();
    for (const entry of locations) {
      const prev = map.get(entry.tripId);
      const hasFavoriteDay = Boolean(entry.dayIsFavorite) || Boolean(prev?.hasFavoriteDay);
      if (!prev) {
        map.set(entry.tripId, {
          tripId: entry.tripId,
          startDate: entry.tripStartDate,
          endDate: entry.tripEndDate,
          tripTypes: entry.tripTypes ?? [],
          companionGroupIds: entry.companionGroupIds ?? [],
          companionPersonIds: entry.companionPersonIds ?? [],
          hasFavoriteDay
        });
      } else if (prev.hasFavoriteDay !== hasFavoriteDay) {
        map.set(entry.tripId, { ...prev, hasFavoriteDay });
      }
    }
    return Array.from(map.values());
  }, [locations]);

  const allowedTripIds = useMemo(
    () => filterTripIds(tripMetas, filterClauses, groupMembersIndex),
    [tripMetas, filterClauses, groupMembersIndex]
  );

  const hasFavoritesFilter = useMemo(
    () => (filterClauses ?? []).some((clause) => clause.kind === 'favorites'),
    [filterClauses]
  );

  const visibleLocations = useMemo(
    () =>
      locations.filter(
        (entry) => allowedTripIds.has(entry.tripId) && (!hasFavoritesFilter || Boolean(entry.dayIsFavorite))
      ),
    [locations, allowedTripIds, hasFavoritesFilter]
  );

  const groups = useMemo(() => groupLocations(visibleLocations, mode), [visibleLocations, mode]);
  const hasActiveFilters = useMemo(
    () => (filterClauses ?? []).some(isTripFilterClauseActive),
    [filterClauses]
  );
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

  const timelineHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/timeline?${query}` : '/timeline';
  }, [searchParams]);
  const showQuickAddCta = searchParams.get('quickAdd') === '1';

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
      zoom: 3.2,
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

    const { groupKeyToColor, otherColor, getEntryKeysForGroupBy } = computeGroupByPalette(
      visibleLocations,
      groupBy
    );

    groups.forEach((group) => {
      const markerEl = document.createElement('div');
      markerEl.className = 'group-marker flex h-12 w-12 items-center justify-center';
      const markerColors = getMarkerColorsForGroup(group, {
        groupKeyToColor,
        otherColor,
        getEntryKeysForGroupBy
      });
      markerEl.innerHTML = buildCityMarkerSvg(markerColors);
      applyMarkerChrome(markerEl, markerColors[0] ?? otherColor);
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

    const validGroups = groups.filter((group) => Number.isFinite(group.lng) && Number.isFinite(group.lat));

    if (validGroups.length) {
      const bounds = new mapboxgl.LngLatBounds();
      validGroups.forEach((group) => bounds.extend([group.lng, group.lat]));
      map.fitBounds(bounds, { padding: 100, maxZoom: 5.2 });
    }
  }, [groups, mode, mapLoaded, groupBy, visibleLocations]);

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

    applyCountryGroupByPaint(map, {
      mode,
      groupBy,
      visibleLocations,
      groups,
      fillLayerId,
      outlineLayerId
    });

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
  }, [mapLoaded, mode, groups, groupBy, visibleLocations]);

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

    const selectedFillOpacity: MapboxPaintValue = ['case', isSelectedExpression, 0.65, 0.35];
    const selectedLineOpacity: MapboxPaintValue = ['case', isSelectedExpression, 1, 0.6];

    map.setPaintProperty(fillLayerId, 'fill-opacity', selectedFillOpacity);
    map.setPaintProperty(outlineLayerId, 'line-opacity', selectedLineOpacity);
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold text-white">Globe</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={timelineHref}>Show Timeline</a>
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setControlsMenuOpen((prev) => !prev)}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Controls
              </Button>
              {controlsMenuOpen ? (
                <div className="absolute right-0 top-10 z-40 w-56 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setDraftFilterClauses(filterClauses);
                      setFiltersOpen(true);
                      setControlsMenuOpen(false);
                    }}
                  >
                    Filter…
                  </button>
                  <div className="border-t border-slate-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Group by
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setGroupBy('year');
                      setControlsMenuOpen(false);
                    }}
                  >
                    <span>Year</span>
                    {groupBy === 'year' ? <span className="text-xs text-brand">Active</span> : null}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setGroupBy('tripType');
                      setControlsMenuOpen(false);
                    }}
                  >
                    <span>Trip Type</span>
                    {groupBy === 'tripType' ? <span className="text-xs text-brand">Active</span> : null}
                  </button>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm text-slate-400 hover:bg-slate-800"
                    onClick={() => {
                      setGroupBy('none');
                      setControlsMenuOpen(false);
                    }}
                  >
                    Clear group by
                  </button>
                  <div className="border-t border-slate-800" />
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-800"
                    onClick={() => {
                      setGroupBy('none');
                      setFilterClauses([]);
                      setDraftFilterClauses([]);
                      setControlsMenuOpen(false);
                    }}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {showQuickAddCta ? (
          <div className="flex justify-start">
            <Button variant="secondary" size="sm" asChild>
              <a href="/journal/quick-add">Add more trips</a>
            </Button>
          </div>
        ) : null}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-500"
                  onClick={() => {
                    setFilterClauses([]);
                    setDraftFilterClauses([]);
                  }}
                  aria-label="Clear filters"
                >
                  <span>Filtered</span>
                  <X className="h-3.5 w-3.5 opacity-80" />
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <TripFiltersDialog
        open={filtersOpen}
        clauses={draftFilterClauses}
        onChange={setDraftFilterClauses}
        onClose={() => setFiltersOpen(false)}
        onApply={() => {
          setFilterClauses(draftFilterClauses);
        }}
        title="Filter globe"
        exclusiveKinds={['favorites']}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 p-1">
          {(['city', 'country'] as GroupingMode[]).map((option) => (
            <Button
              key={option}
              type="button"
              variant={option === mode ? 'primary' : 'secondary'}
              size="sm"
              className="h-8"
              onClick={() => setMode(option)}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Button>
          ))}
        </div>
        {groupBy !== 'none' ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-500"
            onClick={() => setGroupBy('none')}
            aria-label="Clear group by"
          >
            <span>Group: {groupBy === 'year' ? 'Year' : 'Trip type'}</span>
            <X className="h-3.5 w-3.5 opacity-80" />
          </button>
        ) : null}
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
      {groupBy !== 'none' ? <GroupByLegend groupBy={groupBy} locations={visibleLocations} /> : null}
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
      tripTypes: location.tripTypes ?? [],
      date: location.date,
      dayIndex: location.dayIndex,
      highlight: location.highlight,
      hashtags: location.hashtags
    });
  }

  return Array.from(map.values());
}

const GROUP_BY_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ef4444', '#f97316'] as const;

function computeGroupByPalette(locations: MapLocationEntry[], groupBy: GroupByMode) {
  const getEntryKeysForGroupBy = (entry: Pick<MapLocationEntry, 'date' | 'tripTypes'>): string[] => {
    if (groupBy === 'year') {
      const year = entry.date?.slice(0, 4);
      return year ? [year] : [];
    }
    if (groupBy === 'tripType') {
      return (entry.tripTypes ?? []).map((value) => value.trim()).filter(Boolean);
    }
    return [];
  };

  if (groupBy === 'none') {
    return {
      groupKeyToColor: new Map<string, string>(),
      otherColor: '#2563EB',
      topKeys: [] as string[],
      getEntryKeysForGroupBy
    };
  }

  const counts = new Map<string, number>();
  for (const entry of locations) {
    for (const key of getEntryKeysForGroupBy(entry)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const topKeys = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key);

  const groupKeyToColor = new Map<string, string>();
  topKeys.forEach((key, idx) => {
    groupKeyToColor.set(key, GROUP_BY_COLORS[idx]);
  });

  const otherColor = GROUP_BY_COLORS[5];

  return { groupKeyToColor, otherColor, topKeys, getEntryKeysForGroupBy };
}

function getMarkerColorsForGroup(
  group: LocationGroup,
  opts: {
    groupKeyToColor: Map<string, string>;
    otherColor: string;
    getEntryKeysForGroupBy: (entry: Pick<LocationGroup['entries'][number], 'date' | 'tripTypes'>) => string[];
  }
): string[] {
  const { groupKeyToColor, otherColor, getEntryKeysForGroupBy } = opts;

  const keyCounts = new Map<string, number>();
  for (const entry of group.entries) {
    for (const key of getEntryKeysForGroupBy(entry)) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }

  if (!keyCounts.size) {
    return [otherColor];
  }

  const sortedKeys = Array.from(keyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  const mapped = sortedKeys.map((key) => groupKeyToColor.get(key) ?? otherColor);
  const unique = Array.from(new Set(mapped));

  if (unique.length <= 1) {
    return [unique[0] ?? otherColor];
  }

  return unique.slice(0, 2);
}

function buildCityMarkerSvg(colors: string[]) {
  const primary = colors[0] ?? '#38bdf8';
  const secondary = colors[1] ?? null;

  if (!secondary) {
    return CITY_MARKER_SVG.replace('fill="currentColor"', `fill="${primary}"`);
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34" fill="none">
  <defs>
    <pattern id="stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="3" height="6" fill="${primary}" />
      <rect x="3" width="3" height="6" fill="${secondary}" />
    </pattern>
  </defs>
  <path
    d="M12 22s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11Z"
    fill="url(#stripes)"
    fill-opacity="0.9"
  />
  <circle cx="12" cy="11" r="3.2" fill="#0f172a" />
</svg>
`;
  return svg.trim();
}

function applyMarkerChrome(markerEl: HTMLDivElement, color: string) {
  markerEl.style.filter = 'drop-shadow(0 16px 22px rgba(0,0,0,0.45))';
  markerEl.style.borderRadius = '9999px';
  void color;
}

function applyCountryGroupByPaint(
  map: mapboxgl.Map,
  args: {
    mode: GroupingMode;
    groupBy: GroupByMode;
    visibleLocations: MapLocationEntry[];
    groups: LocationGroup[];
    fillLayerId: string;
    outlineLayerId: string;
  }
) {
  const { groupBy, visibleLocations, groups, fillLayerId, outlineLayerId } = args;

  if (groupBy === 'none') {
    map.setPaintProperty(fillLayerId, 'fill-color', '#2563EB');
    map.setPaintProperty(outlineLayerId, 'line-color', '#2563EB');
    return;
  }

  const { groupKeyToColor, otherColor, getEntryKeysForGroupBy } = computeGroupByPalette(
    visibleLocations,
    groupBy
  );

  const countryToColor = new Map<string, string>();

  for (const group of groups) {
    const countryName = normalizeName(group.country);
    if (!countryName) continue;

    const keyCounts = new Map<string, number>();
    for (const entry of group.entries) {
      for (const key of getEntryKeysForGroupBy(entry)) {
        keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
      }
    }

    const topKey = Array.from(keyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const color = topKey ? groupKeyToColor.get(topKey) ?? otherColor : otherColor;
    countryToColor.set(countryName, color);
  }

  const buckets = new Map<string, string[]>();
  for (const [countryName, color] of countryToColor.entries()) {
    const list = buckets.get(color) ?? [];
    list.push(countryName);
    buckets.set(color, list);
  }

  const input = ['downcase', ['coalesce', ['get', 'name_en'], ['get', 'name'], '']] as MapboxExpression;
  const expression: MapboxPaintValue = ['match', input];
  for (const [color, names] of buckets.entries()) {
    expression.push(names);
    expression.push(color);
  }
  expression.push(otherColor);

  map.setPaintProperty(fillLayerId, 'fill-color', expression);
  map.setPaintProperty(outlineLayerId, 'line-color', '#0f172a');
}

function isTripFilterClauseActive(clause: TripFilterClause) {
  if (clause.kind === 'dateRange') {
    return Boolean(clause.startDate || clause.endDate);
  }
  if (clause.kind === 'tripType') {
    return clause.tripTypes.length > 0;
  }
  if (clause.kind === 'tripGroup') {
    return clause.tripGroupIds.length > 0;
  }
  if (clause.kind === 'tripPeople') {
    return clause.personIds.length > 0;
  }
  if (clause.kind === 'favorites') {
    return true;
  }
  return false;
}

function GroupByLegend({ groupBy, locations }: { groupBy: Exclude<GroupByMode, 'none'>; locations: MapLocationEntry[] }) {
  const { groupKeyToColor, otherColor, topKeys } = computeGroupByPalette(locations, groupBy);
  const title = groupBy === 'year' ? 'Group by year' : 'Group by trip type';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {topKeys.map((key) => {
          const color = groupKeyToColor.get(key) ?? otherColor;
          return (
            <div key={key} className="flex items-center gap-2 text-sm text-slate-200">
              <span
                className="h-3 w-3 rounded-sm border border-black/30"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="text-sm">{key}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span
            className="h-3 w-3 rounded-sm border border-black/30"
            style={{ backgroundColor: otherColor }}
            aria-hidden
          />
          <span className="text-sm">Other</span>
        </div>
      </div>
    </div>
  );
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

  const extendWithCoordinates = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return;
    }

    const [longitude, latitude] = coordinates;

    if (typeof longitude === 'number' && typeof latitude === 'number') {
      bounds.extend([longitude, latitude]);
      return;
    }

    coordinates.forEach((value) => {
      extendWithCoordinates(value);
    });
  };

  const addGeometryCoordinates = (geometry: Geometry): void => {
    if (geometry.type === 'GeometryCollection') {
      geometry.geometries.forEach(addGeometryCoordinates);
      return;
    }

    const geometryWithCoordinates = geometry as GeometryWithCoordinates;
    extendWithCoordinates(geometryWithCoordinates.coordinates);
  };

  addGeometryCoordinates(feature.geometry);

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

  return matches.length === 1 ? matches[0] : (['any', ...matches] as MapboxExpression);
}

function buildSingleValueMatchExpression(
  propertyNames: string[],
  targetName: string
): MapboxExpression {
  if (!propertyNames.length) {
    return ['literal', false] as MapboxExpression;
  }

  const comparisons = propertyNames.map(
    (property) =>
      [
        '==',
        ['downcase', ['coalesce', ['get', property], '']],
        targetName
      ] as MapboxExpression
  );

  return comparisons.length === 1 ? comparisons[0] : (['any', ...comparisons] as MapboxExpression);
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

