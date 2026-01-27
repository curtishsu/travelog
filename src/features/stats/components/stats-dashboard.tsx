'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import type { StatsSummary } from '@/features/stats/types';
import { formatDateForDisplay } from '@/lib/date';

const chartColors = ['#60A5FA', '#34D399', '#FBBF24', '#F472B6', '#C084FC', '#F97316', '#38BDF8', '#4ADE80'];

type StatsDashboardProps = {
  stats: StatsSummary;
};

type TripTypeDistributionItem = {
  label: string;
  value: number;
  percentage: number;
  trips: StatsSummary['tripTypeDistribution'][number]['trips'];
};

type HashtagDistributionItem = {
  label: string;
  value: number;
  tripDays: StatsSummary['hashtagDistribution'][number]['tripDays'];
};

type CompanionPersonDistributionItem = {
  id: string;
  label: string;
  value: number;
  trips: StatsSummary['tripCompanionPersonDistribution'][number]['trips'];
};

type CompanionGroupDistributionItem = {
  id: string;
  label: string;
  value: number;
  trips: StatsSummary['tripCompanionGroupDistribution'][number]['trips'];
};

type TripTrendPoint = {
  bucket: string;
  label: string;
  tripCount: number;
  trips: StatsSummary['tripTrendsYear'][number]['trips'];
};

type TravelDayTrendPoint = {
  bucket: string;
  label: string;
  dayCount: number;
  trips: StatsSummary['travelDayTrendsYear'][number]['trips'];
  tripDays: StatsSummary['travelDayTrendsYear'][number]['tripDays'];
};

type TrendExpandedSections = Record<string, { trips?: boolean; tripDays?: boolean }>;

export function StatsDashboard({ stats }: StatsDashboardProps) {
  const [distributionType, setDistributionType] = useState<'hashtags' | 'tripTypes'>('tripTypes');
  const [companionDistributionType, setCompanionDistributionType] = useState<'person' | 'group'>(
    'person'
  );
  const [trendGrouping, setTrendGrouping] = useState<'year' | 'month'>('year');
  const [mostVisitedMetric, setMostVisitedMetric] = useState<'trips' | 'days'>('trips');
  const [mostVisitedIndices, setMostVisitedIndices] = useState<Record<'trips' | 'days', number>>({
    trips: 0,
    days: 0
  });
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  const mostVisitedTrips = stats.mostVisited?.trips ?? [];
  const mostVisitedDays = stats.mostVisited?.days ?? [];
  const availableMostVisitedMetrics = useMemo(() => {
    const metrics: Array<'trips' | 'days'> = [];
    if (mostVisitedTrips.length > 0) {
      metrics.push('trips');
    }
    if (mostVisitedDays.length > 0) {
      metrics.push('days');
    }
    return metrics;
  }, [mostVisitedTrips.length, mostVisitedDays.length]);

  useEffect(() => {
    const preferred = availableMostVisitedMetrics[0] ?? 'trips';
    setMostVisitedMetric(preferred);
    setMostVisitedIndices({ trips: 0, days: 0 });
  }, [availableMostVisitedMetrics]);

  useEffect(() => {
    const query =
      typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)') : null;
    if (!query) {
      return;
    }

    const handleMatch = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsNarrowScreen(event.matches);
    };

    handleMatch(query);

    const listener = (event: MediaQueryListEvent) => handleMatch(event);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener);
      return () => {
        query.removeEventListener('change', listener);
      };
    }

    const legacyListener = (event: MediaQueryListEvent) => handleMatch(event);
    query.addListener(legacyListener);

    return () => {
      query.removeListener(legacyListener);
    };
  }, []);

  const tripTypeData: TripTypeDistributionItem[] = useMemo(() => {
    return stats.tripTypeDistribution.map((item) => ({
      label: item.type,
      value: item.tripCount,
      percentage: stats.totalTrips ? Math.round((item.tripCount / stats.totalTrips) * 100) : 0,
      trips: item.trips
    }));
  }, [stats.totalTrips, stats.tripTypeDistribution]);

  const hashtagData: HashtagDistributionItem[] = useMemo(() => {
    return stats.hashtagDistribution.map((item) => ({
      label: `#${item.hashtag}`,
      value: item.dayCount,
      tripDays: item.tripDays
    }));
  }, [stats.hashtagDistribution]);

  const companionPersonData: CompanionPersonDistributionItem[] = useMemo(() => {
    return stats.tripCompanionPersonDistribution.map((item) => ({
      id: item.personId,
      label: [item.firstName, item.lastName].filter(Boolean).join(' '),
      value: item.tripCount,
      trips: item.trips
    }));
  }, [stats.tripCompanionPersonDistribution]);

  const companionGroupData: CompanionGroupDistributionItem[] = useMemo(() => {
    return stats.tripCompanionGroupDistribution.map((item) => ({
      id: item.groupId,
      label: item.groupName,
      value: item.tripCount,
      trips: item.trips
    }));
  }, [stats.tripCompanionGroupDistribution]);

  const groupingLabel = trendGrouping === 'year' ? 'year' : 'month';

  const tripsTrendData: TripTrendPoint[] = useMemo(() => {
    const source = trendGrouping === 'year' ? stats.tripTrendsYear : stats.tripTrendsMonth;
    return source.map((entry) => ({
      bucket: entry.bucket,
      label: trendGrouping === 'year' ? entry.bucket : formatMonthLabel(entry.bucket),
      tripCount: entry.tripCount,
      trips: entry.trips
    }));
  }, [stats.tripTrendsMonth, stats.tripTrendsYear, trendGrouping]);

  const travelDayTrendData: TravelDayTrendPoint[] = useMemo(() => {
    const source = trendGrouping === 'year' ? stats.travelDayTrendsYear : stats.travelDayTrendsMonth;
    return source.map((entry) => ({
      bucket: entry.bucket,
      label: trendGrouping === 'year' ? entry.bucket : formatMonthLabel(entry.bucket),
      dayCount: entry.dayCount,
      trips: entry.trips,
      tripDays: entry.tripDays
    }));
  }, [stats.travelDayTrendsMonth, stats.travelDayTrendsYear, trendGrouping]);

  const isTripTypeView = distributionType === 'tripTypes';
  const distributionData: Array<TripTypeDistributionItem | HashtagDistributionItem> = isTripTypeView
    ? tripTypeData
    : hashtagData;
  const maxDistributionValue = distributionData.reduce((max, item) => Math.max(max, item.value), 0) || 1;

  const companionData: Array<CompanionPersonDistributionItem | CompanionGroupDistributionItem> =
    companionDistributionType === 'person' ? companionPersonData : companionGroupData;
  const maxCompanionValue = companionData.reduce((max, item) => Math.max(max, item.value), 0) || 1;
  const hasMostVisited = mostVisitedTrips.length > 0 || mostVisitedDays.length > 0;

  const activeMostVisitedList =
    mostVisitedMetric === 'trips' ? mostVisitedTrips : mostVisitedDays;
  const activeMostVisitedIndex = Math.min(
    mostVisitedIndices[mostVisitedMetric] ?? 0,
    Math.max(activeMostVisitedList.length - 1, 0)
  );
  const activeMostVisitedLocation = activeMostVisitedList[activeMostVisitedIndex];
  const showMostVisitedTie = activeMostVisitedList.length > 1;
  const mostVisitedMetricLabel = mostVisitedMetric === 'trips' ? 'Trips' : 'Days';

  useEffect(() => {
    setMostVisitedIndices((previous) => {
      const updated: Record<'trips' | 'days', number> = { ...previous };
      for (const key of ['trips', 'days'] as const) {
        const list = key === 'trips' ? mostVisitedTrips : mostVisitedDays;
        if (list.length === 0) {
          updated[key] = 0;
        } else if (updated[key] >= list.length) {
          updated[key] = 0;
        }
      }
      return updated;
    });
  }, [mostVisitedTrips, mostVisitedDays]);

  const handleMostVisitedToggle = () => {
    if (availableMostVisitedMetrics.length === 0) {
      return;
    }

    const metric = mostVisitedMetric;
    const entries = metric === 'trips' ? mostVisitedTrips : mostVisitedDays;
    if (entries.length === 0) {
      return;
    }

    const currentIndex = mostVisitedIndices[metric] ?? 0;
    const nextIndex = (currentIndex + 1) % entries.length;
    const wrapped = nextIndex === 0;

    setMostVisitedIndices((previous) => ({
      ...previous,
      [metric]: nextIndex
    }));

    if (!wrapped || availableMostVisitedMetrics.length === 1) {
      return;
    }

    const metricIndex = availableMostVisitedMetrics.indexOf(metric);
    const nextMetric =
      metricIndex === -1
        ? availableMostVisitedMetrics[0]
        : availableMostVisitedMetrics[(metricIndex + 1) % availableMostVisitedMetrics.length];

    setMostVisitedMetric(nextMetric);
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
          <SummaryCard title="Total trips" value={stats.totalTrips.toString()} />
          <SummaryCard title="Travel days" value={stats.totalTravelDays.toString()} />
          <SummaryCard title="Countries visited" value={stats.countriesVisited.toString()} />
          <SummaryCard title="Locations visited" value={stats.locationsVisited.toString()} />
        </div>
        {hasMostVisited ? (
          <button
            type="button"
            onClick={handleMostVisitedToggle}
            className="mt-4 w-full rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-left text-sm text-slate-300 transition hover:border-slate-700 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
            aria-label="Toggle most visited metric"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Most visited ({mostVisitedMetricLabel})
            </p>
            {activeMostVisitedLocation ? (
              <>
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-semibold text-white">
                    {[
                      activeMostVisitedLocation.city,
                      activeMostVisitedLocation.country
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Unknown location'}
                    {showMostVisitedTie ? ' (Tie)' : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    {mostVisitedMetric === 'trips'
                      ? `${activeMostVisitedLocation.tripCount} ${
                          activeMostVisitedLocation.tripCount === 1 ? 'trip' : 'trips'
                        }`
                      : `${activeMostVisitedLocation.daysHere} ${
                          activeMostVisitedLocation.daysHere === 1 ? 'day' : 'days'
                        }`}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {mostVisitedMetric === 'trips'
                    ? `${activeMostVisitedLocation.daysHere} ${
                        activeMostVisitedLocation.daysHere === 1 ? 'day' : 'days'
                      } spent`
                    : `${activeMostVisitedLocation.tripCount} ${
                        activeMostVisitedLocation.tripCount === 1 ? 'trip' : 'trips'
                      } logged`}
                </p>
                {availableMostVisitedMetrics.length > 1 || showMostVisitedTie ? (
                  <p className="mt-3 text-[11px] font-semibold uppercase text-brand">
                    Tap to switch
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No most visited locations yet.</p>
            )}
          </button>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={distributionType === 'tripTypes' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDistributionType('tripTypes')}
            >
              Trip types
            </Button>
            <Button
              type="button"
              variant={distributionType === 'hashtags' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setDistributionType('hashtags')}
            >
              Hashtags
            </Button>
          </div>
        </div>
        {distributionData.length === 0 ? (
          <p className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
            No data yet. Complete trips to populate this chart.
          </p>
        ) : (
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            {distributionData.map((item, index) => {
              const color = chartColors[index % chartColors.length];
              const width = `${(item.value / maxDistributionValue) * 100}%`;
              const label =
                isTripTypeView && 'trips' in item && item.trips.length > 0 ? (
                  <Tooltip trigger={<span className="text-slate-200 normal-case">{item.label}</span>} align="left">
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-100">
                        Trips tagged &ldquo;{item.label}&rdquo;
                      </p>
                      <ul className="max-h-48 space-y-1 overflow-y-auto text-left text-slate-200">
                        {item.trips.map((trip) => (
                          <li key={trip.tripId}>
                            <Link
                              href={`/trips/${trip.tripId}`}
                              className="text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                            >
                              {trip.tripName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Tooltip>
                ) : !isTripTypeView && 'tripDays' in item && item.tripDays.length > 0 ? (
                  <Tooltip trigger={<span className="text-slate-200 normal-case">{item.label}</span>} align="left">
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-100">Appears in</p>
                      <ul className="max-h-48 space-y-1 overflow-y-auto text-left text-slate-200">
                        {item.tripDays.map((entry) => (
                          <li key={`${entry.tripId}-${entry.dayIndex}`}>
                            <Link
                              href={`/trips/${entry.tripId}#day-${entry.dayIndex}`}
                              className="text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                            >
                              {entry.tripName} [Day {entry.dayIndex}]
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Tooltip>
                ) : (
                  <span className="text-slate-200 normal-case">{item.label}</span>
                );

              const valueDisplay = isTripTypeView && 'percentage' in item ? (
                <Tooltip
                  trigger={
                    <span className="cursor-help text-slate-300">
                      {item.value} ({item.percentage}
                      %)
                    </span>
                  }
                  align="right"
                >
                  <div className="space-y-1 text-left">
                    <p className="text-slate-200 font-semibold">
                      {item.value} {item.value === 1 ? 'trip' : 'trips'}
                    </p>
                    {stats.totalTrips > 0 ? (
                      <p className="text-slate-400">{item.percentage}% of {stats.totalTrips} trips</p>
                    ) : null}
                  </div>
                </Tooltip>
              ) : (
                <span className="text-slate-300">{item.value}</span>
              );

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                    <div className="flex items-center gap-2">{label}</div>
                    {valueDisplay}
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800">
                    <div className="h-2 rounded-full" style={{ width, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Trip group</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={companionDistributionType === 'person' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setCompanionDistributionType('person')}
            >
              Person
            </Button>
            <Button
              type="button"
              variant={companionDistributionType === 'group' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setCompanionDistributionType('group')}
            >
              Group
            </Button>
          </div>
        </div>
        {companionData.length === 0 ? (
          <p className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
            No trip group data yet. Add companions to completed trips to populate this chart.
          </p>
        ) : (
          <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
            {companionData.map((item, index) => {
              const color = chartColors[index % chartColors.length];
              const width = `${(item.value / maxCompanionValue) * 100}%`;
              const label =
                'trips' in item && item.trips.length > 0 ? (
                  <Tooltip trigger={<span className="text-slate-200 normal-case">{item.label}</span>} align="left">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-100">Trips</p>
                        <Link
                          href={
                            companionDistributionType === 'person'
                              ? `/map?person=${encodeURIComponent(item.id)}`
                              : `/map?group=${encodeURIComponent(item.id)}`
                          }
                          className="text-xs font-semibold uppercase tracking-wide text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                        >
                          Open on globe
                        </Link>
                      </div>
                      <ul className="max-h-48 space-y-1 overflow-y-auto text-left text-slate-200">
                        {item.trips.map((trip) => (
                          <li key={trip.tripId}>
                            <Link
                              href={`/trips/${trip.tripId}`}
                              className="text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                            >
                              {trip.tripName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Tooltip>
                ) : (
                  <span className="text-slate-200 normal-case">{item.label}</span>
                );

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                    <div className="flex items-center gap-2">{label}</div>
                    <span className="text-slate-300">{item.value}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800">
                    <div className="h-2 rounded-full" style={{ width, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Trends</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={trendGrouping === 'year' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTrendGrouping('year')}
            >
              Year
            </Button>
            <Button
              type="button"
              variant={trendGrouping === 'month' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTrendGrouping('month')}
            >
              Month
            </Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TrendChart
            title={`Trips per ${groupingLabel}`}
            data={tripsTrendData}
            variant="trips"
            emptyMessage={`No trip history per ${groupingLabel} yet.`}
          />
          <TrendChart
            title={`Travel days per ${groupingLabel}`}
            data={travelDayTrendData}
            variant="days"
            emptyMessage={`No travel day history per ${groupingLabel} yet.`}
            shouldCompressLabels={isNarrowScreen && trendGrouping === 'month'}
          />
        </div>
      </section>
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
};

type TooltipProps = {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
};

function Tooltip({ trigger, children, align = 'center' }: TooltipProps) {
  const positionClasses =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openTooltip = () => {
    clearCloseTimeout();
    setIsOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        (triggerRef.current && triggerRef.current.contains(target)) ||
        (tooltipRef.current && tooltipRef.current.contains(target))
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape') {
      clearCloseTimeout();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <span
        ref={triggerRef}
        tabIndex={0}
        className="cursor-help focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        onFocus={openTooltip}
        onBlur={scheduleClose}
        onTouchStart={openTooltip}
        onClick={openTooltip}
        onKeyDown={handleKeyDown}
      >
        {trigger}
      </span>
      {isOpen ? (
        <div
          ref={tooltipRef}
          className={`absolute top-full z-30 mt-2 min-w-[14rem] max-w-xs -translate-y-1 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-left text-xs text-slate-100 shadow-xl transition ${positionClasses}`}
          role="tooltip"
          onMouseEnter={openTooltip}
          onMouseLeave={scheduleClose}
        >
          <div className="max-h-64 overflow-y-auto">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ title, value }: SummaryCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

type BaseTrendChartProps = {
  title: string;
  emptyMessage: string;
  shouldCompressLabels?: boolean;
};

type TrendChartProps =
  | (BaseTrendChartProps & {
      variant: 'trips';
      data: TripTrendPoint[];
    })
  | (BaseTrendChartProps & {
      variant: 'days';
      data: TravelDayTrendPoint[];
    });

type RenderableTripPoint = TripTrendPoint & {
  value: number;
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
};
type RenderableTravelDayPoint = TravelDayTrendPoint & {
  value: number;
  x: number;
  y: number;
  xPercent: number;
  yPercent: number;
};

function TrendChart(props: TrendChartProps) {
  const { title, variant, data, emptyMessage, shouldCompressLabels = false } = props;

  const valueLabel = variant === 'trips' ? 'Trips' : 'Trip days';
  const hasData = data.length > 0;

  const chartWidth = 100;
  const chartHeight = 60;
  const verticalPadding = 10;
  const baselineY = chartHeight - verticalPadding;

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const values =
    variant === 'trips'
      ? (data as TripTrendPoint[]).map((point) => point.tripCount)
      : (data as TravelDayTrendPoint[]).map((point) => point.dayCount);
  const maxValue = hasData ? Math.max(...values) : 0;

  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [pinnedBucket, setPinnedBucket] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<TrendExpandedSections>({});

  const visibleLabelSet = useMemo(() => {
    if (!shouldCompressLabels || data.length <= 8) {
      return new Set(data.map((_, index) => index));
    }
    const maxLabels = Math.min(5, data.length);
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    const indices = new Set<number>();

    data.forEach((_, index) => {
      if (index === 0 || index === data.length - 1 || index % step === 0) {
        indices.add(index);
      }
    });

    return indices;
  }, [data, shouldCompressLabels]);

  const renderablePoints: Array<RenderableTripPoint | RenderableTravelDayPoint> = hasData
    ? data.map((point, index) => {
        const rawValue =
          variant === 'trips'
            ? (point as TripTrendPoint).tripCount
            : (point as TravelDayTrendPoint).dayCount;
        const x = data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth;
        const ratio = maxValue ? rawValue / maxValue : 0;
        const y = baselineY - ratio * (chartHeight - verticalPadding * 2);
        const xPercent = chartWidth ? (x / chartWidth) * 100 : 0;
        const yPercent = chartHeight ? (y / chartHeight) * 100 : 0;
        return { ...point, value: rawValue, x, y, xPercent, yPercent };
      })
    : [];

  const pathPoints =
    renderablePoints.length === 1
      ? [
          { x: 0, y: renderablePoints[0].y },
          { x: chartWidth, y: renderablePoints[0].y }
        ]
      : renderablePoints;

  const pathD = pathPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPathD =
    pathPoints.length > 0
      ? `${pathD} L ${pathPoints[pathPoints.length - 1].x} ${baselineY} L ${pathPoints[0].x} ${baselineY} Z`
      : '';

  const gradientId = `trend-gradient-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const latestValue = hasData ? renderablePoints[renderablePoints.length - 1].value : 0;

  const bucketKey = activeBucket ?? pinnedBucket;
  const activePoint =
    bucketKey && hasData
      ? (renderablePoints.find((point) => point.bucket === bucketKey) as
          | RenderableTripPoint
          | RenderableTravelDayPoint
          | undefined)
      : undefined;

  const handlePointEnter = (bucket: string) => {
    setActiveBucket(bucket);
  };

  const handlePointClick = (bucket: string) => {
    setPinnedBucket((previous) => {
      if (previous === bucket) {
        setActiveBucket(null);
        return null;
      }
      setActiveBucket(bucket);
      return bucket;
    });
  };

  const handleChartLeave = () => {
    if (!pinnedBucket) {
      setActiveBucket(null);
    }
  };

  useEffect(() => {
    if (!pinnedBucket) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!chartContainerRef.current) {
        return;
      }
      if (chartContainerRef.current.contains(event.target as Node)) {
        return;
      }
      setPinnedBucket(null);
      setActiveBucket(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [pinnedBucket]);

  const isExpanded = (bucket: string, section: 'trips' | 'tripDays') =>
    expandedSections[bucket]?.[section] ?? false;

  const toggleExpanded = (bucket: string, section: 'trips' | 'tripDays') => {
    setExpandedSections((previous) => {
      const current = previous[bucket] ?? {};
      const nextValue = !(current[section] ?? false);
      return {
        ...previous,
        [bucket]: {
          ...current,
          [section]: nextValue
        }
      };
    });
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {hasData ? (
          <span className="text-xs text-slate-400">
            Latest: {latestValue} {valueLabel.toLowerCase()}
          </span>
        ) : null}
      </div>
      {hasData ? (
        <div className="space-y-4">
          <div
            ref={chartContainerRef}
            className="relative h-40 w-full"
            onMouseLeave={handleChartLeave}
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              className="h-full w-full text-brand"
              role="img"
              aria-label={`${title} trend`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
                  <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
                </linearGradient>
              </defs>
              <line x1="0" y1={baselineY} x2={chartWidth} y2={baselineY} stroke="#1f2937" strokeWidth="0.5" />
              {areaPathD ? <path d={areaPathD} fill={`url(#${gradientId})`} stroke="none" /> : null}
              {pathD ? (
                <path d={pathD} fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
              ) : null}
              {renderablePoints.map((point) => (
                <circle key={point.bucket} cx={point.x} cy={point.y} r={1.8} fill="#38BDF8" />
              ))}
            </svg>
            {renderablePoints.map((point) => {
              const left = `${point.xPercent}%`;
              const top = `${point.yPercent}%`;
              const isPinned = pinnedBucket === point.bucket;
              const isActive = bucketKey === point.bucket;

              return (
                <button
                  key={`target-${point.bucket}`}
                  type="button"
                  className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
                  style={{ left, top }}
                  onMouseEnter={() => handlePointEnter(point.bucket)}
                  onFocus={() => handlePointEnter(point.bucket)}
                  onClick={() => handlePointClick(point.bucket)}
                  aria-label={`Show details for ${point.label}`}
                  aria-pressed={isPinned}
                >
                  <span
                    className={`pointer-events-none block h-full w-full rounded-full border-2 ${
                      isActive ? 'border-brand/80 bg-brand/10' : 'border-transparent'
                    }`}
                  />
                </button>
              );
            })}
            {activePoint ? (
              variant === 'trips' ? (
                <TrendTooltipPanel
                  variant="trips"
                  point={activePoint as RenderableTripPoint}
                  valueLabel={valueLabel}
                  isTripsExpanded={isExpanded(activePoint.bucket, 'trips')}
                  onToggleTrips={() => toggleExpanded(activePoint.bucket, 'trips')}
                  containerRef={chartContainerRef}
                />
              ) : (
                <TrendTooltipPanel
                  variant="days"
                  point={activePoint as RenderableTravelDayPoint}
                  valueLabel={valueLabel}
                  isTripsExpanded={isExpanded(activePoint.bucket, 'trips')}
                  onToggleTrips={() => toggleExpanded(activePoint.bucket, 'trips')}
                  isTripDaysExpanded={isExpanded(activePoint.bucket, 'tripDays')}
                  onToggleTripDays={() => toggleExpanded(activePoint.bucket, 'tripDays')}
                  containerRef={chartContainerRef}
                />
              )
            ) : null}
          </div>
          <div
            className="grid gap-2 text-xs text-slate-400"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {data.map((point, index) => {
              const isVisible = visibleLabelSet.has(index);
              return (
                <span
                  key={point.bucket}
                  className={`text-center font-medium ${isVisible ? '' : 'text-transparent'}`}
                  aria-hidden={!isVisible}
                >
                  {point.label}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      )}
    </div>
  );
}

type TrendTooltipPanelProps =
  | {
      variant: 'trips';
      point: RenderableTripPoint;
      valueLabel: string;
      isTripsExpanded: boolean;
      onToggleTrips: () => void;
      containerRef: RefObject<HTMLDivElement>;
      isTripDaysExpanded?: never;
      onToggleTripDays?: never;
    }
  | {
      variant: 'days';
      point: RenderableTravelDayPoint;
      valueLabel: string;
      isTripsExpanded: boolean;
      onToggleTrips: () => void;
      containerRef: RefObject<HTMLDivElement>;
      isTripDaysExpanded: boolean | undefined;
      onToggleTripDays: (() => void) | undefined;
    };

function TrendTooltipPanel(props: TrendTooltipPanelProps) {
  const { variant, point, valueLabel, containerRef } = props;

  type TooltipPlacement = 'above' | 'below';
  type TooltipPosition = {
    left: number;
    top: number;
    placement: TooltipPlacement;
    ready: boolean;
    maxHeight: number;
  };

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tripDayCount = 'tripDays' in point ? point.tripDays.length : 0;
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
    placement: 'above',
    ready: false,
    maxHeight: 0
  });

  const calculatePosition = useCallback(() => {
    const container = containerRef.current;
    const tooltipEl = tooltipRef.current;
    if (!container || !tooltipEl) {
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    if (containerWidth === 0 || containerHeight === 0) {
      return;
    }

    const tooltipWidth = tooltipEl.offsetWidth;
    const tooltipHeight = tooltipEl.offsetHeight;
    const containerRect = container.getBoundingClientRect();

    const pointX = (point.xPercent / 100) * containerWidth;
    const pointY = (point.yPercent / 100) * containerHeight;

    const horizontalPadding = 12;
    const pointGap = 12;
    const viewportPadding = 12;

    let left = pointX - tooltipWidth / 2;
    left = Math.max(horizontalPadding, Math.min(left, containerWidth - horizontalPadding - tooltipWidth));

    const naturalTop = pointY - tooltipHeight - pointGap;
    let placement: TooltipPlacement = 'above';

    const viewportTopLimit = viewportPadding;
    const viewportBottomLimit = window.innerHeight - viewportPadding;

    const naturalViewportTop = containerRect.top + naturalTop;
    const naturalViewportBottom = naturalViewportTop + tooltipHeight;

    const availableViewportHeight = Math.max(
      viewportBottomLimit - viewportTopLimit,
      200
    );

    const desiredViewportTop = Math.min(
      Math.max(naturalViewportTop, viewportTopLimit),
      viewportBottomLimit - tooltipHeight
    );

    let finalViewportTop = desiredViewportTop;
    let maxHeight = tooltipHeight;

    if (naturalViewportBottom > viewportBottomLimit) {
      placement = 'above';
      const adjustedHeight = Math.min(
        tooltipHeight,
        viewportBottomLimit - viewportTopLimit
      );
      finalViewportTop = Math.max(viewportTopLimit, naturalViewportBottom - adjustedHeight);
      maxHeight = adjustedHeight;
    } else if (naturalViewportTop < viewportTopLimit) {
      placement = 'above';
      const adjustedHeight = Math.min(
        tooltipHeight,
        viewportBottomLimit - viewportTopLimit
      );
      finalViewportTop = viewportTopLimit;
      maxHeight = adjustedHeight;
    } else {
      maxHeight = Math.min(tooltipHeight, availableViewportHeight);
    }

    const top = finalViewportTop - containerRect.top;

    setPosition((previous) => {
      const hasChanged =
        Math.abs(previous.left - left) > 0.5 ||
        Math.abs(previous.top - top) > 0.5 ||
        previous.placement !== placement ||
        Math.abs(previous.maxHeight - maxHeight) > 0.5 ||
        !previous.ready;

      if (!hasChanged) {
        return previous;
      }

      return {
        left,
        top,
        placement,
        ready: true,
        maxHeight
      };
    });
  }, [
    containerRef,
    point.xPercent,
    point.yPercent,
    point.trips.length,
    tripDayCount,
    props.isTripsExpanded,
    props.isTripDaysExpanded
  ]);

  useLayoutEffect(() => {
    calculatePosition();
  }, [calculatePosition]);

  useEffect(() => {
    if (!position.ready) {
      return;
    }
    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculatePosition, position.ready]);

  const commonStyle = {
    left: `${position.left}px`,
    top: `${position.top}px`,
    opacity: position.ready ? 1 : 0,
    pointerEvents: position.ready ? 'auto' : 'none',
    maxHeight: position.maxHeight ? `${position.maxHeight}px` : undefined
  } as const;

  if (variant === 'trips') {
    const showToggle = point.trips.length > 3;
    const isExpanded = props.isTripsExpanded;
    const tripsToShow = showToggle && !isExpanded ? point.trips.slice(0, 3) : point.trips;
    const remainingTrips = point.trips.length - tripsToShow.length;

    return (
      <div
        ref={tooltipRef}
        className="absolute z-30 w-72 max-w-xs overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 text-xs text-slate-100 shadow-xl transition"
        data-placement={position.placement}
        style={commonStyle}
      >
        <div className="max-h-full overflow-y-auto p-4 pr-3">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">{point.label}</p>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{valueLabel}</p>
              <p className="text-sm font-semibold text-white">{point.value}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Trips in bucket</p>
              <ul className="space-y-1 text-left text-slate-200">
                {tripsToShow.map((trip) => (
                  <li key={trip.tripId}>
                    <Link
                      href={`/trips/${trip.tripId}`}
                      className="text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                    >
                      {trip.tripName}
                    </Link>
                  </li>
                ))}
              </ul>
              {showToggle ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase text-brand hover:underline"
                  onClick={props.onToggleTrips}
                >
                  {isExpanded ? 'See less' : `See more (${remainingTrips} more)`}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showTripToggle = point.trips.length > 3;
  const showTripDaysToggle = point.tripDays.length > 0;
  const tripsExpanded = props.isTripsExpanded;
  const tripDaysExpanded = props.isTripDaysExpanded ?? false;
  const tripsToShow = showTripToggle && !tripsExpanded ? point.trips.slice(0, 3) : point.trips;
  const remainingTrips = point.trips.length - tripsToShow.length;

  return (
    <div
      ref={tooltipRef}
      className="absolute z-30 w-80 max-w-xs overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 text-xs text-slate-100 shadow-xl transition"
      data-placement={position.placement}
      style={commonStyle}
    >
      <div className="max-h-full overflow-y-auto p-4 pr-3">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">{point.label}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{valueLabel}</p>
              <p className="text-sm font-semibold text-white">{point.value}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Trips</p>
              <p className="text-sm font-semibold text-white">{point.trips.length}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Trips in bucket</p>
            {point.trips.length === 0 ? (
              <p className="text-slate-400">No trips yet.</p>
            ) : (
              <>
                <ul className="space-y-1 text-left text-slate-200">
                  {tripsToShow.map((trip) => (
                    <li key={trip.tripId}>
                      <Link
                        href={`/trips/${trip.tripId}`}
                        className="text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                      >
                        {trip.tripName}
                      </Link>
                    </li>
                  ))}
                </ul>
                {showTripToggle ? (
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase text-brand hover:underline"
                    onClick={props.onToggleTrips}
                  >
                    {tripsExpanded ? 'See less' : `See more (${remainingTrips} more)`}
                  </button>
                ) : null}
              </>
            )}
          </div>
          {showTripDaysToggle && props.onToggleTripDays ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Trip days</p>
              {tripDaysExpanded ? (
                <>
                  <ul className="space-y-1 text-left text-slate-200">
                    {point.tripDays.map((entry) => (
                      <li key={`${entry.tripId}-${entry.dayIndex}-${entry.date}`}>
                        <Link
                          href={`/trips/${entry.tripId}#day-${entry.dayIndex}`}
                          className="text-brand hover:underline focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                        >
                          {entry.tripName} [Day {entry.dayIndex}] • {formatDateForDisplay(entry.date)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="text-[11px] font-semibold uppercase text-brand hover:underline"
                    onClick={props.onToggleTripDays}
                  >
                    See less
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase text-brand hover:underline"
                  onClick={props.onToggleTripDays}
                >
                  See trip ({point.tripDays.length})
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatMonthLabel(monthKey: string) {
  if (!monthKey) {
    return monthKey;
  }
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return monthKey;
  }
  return new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' }).format(date);
}

