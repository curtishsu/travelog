'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

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
  const [trendGrouping, setTrendGrouping] = useState<'year' | 'month'>('year');

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

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
          <SummaryCard title="Total trips" value={stats.totalTrips.toString()} />
          <SummaryCard title="Travel days" value={stats.totalTravelDays.toString()} />
          <SummaryCard title="Countries visited" value={stats.countriesVisited.toString()} />
          <SummaryCard title="Locations visited" value={stats.locationsVisited.toString()} />
        </div>
        {stats.mostVisitedLocation ? (
          <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-wide text-slate-500">Most visited</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-lg font-semibold text-white">
                {[stats.mostVisitedLocation.city, stats.mostVisitedLocation.country].filter(Boolean).join(', ')}
              </p>
              <p className="text-xs text-slate-400">
                [{stats.mostVisitedLocation.daysHere}] days here
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Visited on {stats.mostVisitedLocation.tripCount}{' '}
              {stats.mostVisitedLocation.tripCount === 1 ? 'trip' : 'trips'}
            </p>
          </div>
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
  const tooltipClasses = `pointer-events-none absolute top-full z-30 hidden min-w-[14rem] max-w-xs translate-y-2 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-left text-xs text-slate-100 shadow-xl transition group-hover:pointer-events-auto group-hover:block group-focus-within:pointer-events-auto group-focus-within:block ${positionClasses}`;

  return (
    <div className="group relative inline-flex">
      <span
        tabIndex={0}
        className="cursor-help focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
      >
        {trigger}
      </span>
      <div className={tooltipClasses} role="tooltip">
        <div className="max-h-64 overflow-y-auto">{children}</div>
      </div>
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

type TrendChartProps =
  | {
      title: string;
      variant: 'trips';
      data: TripTrendPoint[];
      emptyMessage: string;
    }
  | {
      title: string;
      variant: 'days';
      data: TravelDayTrendPoint[];
      emptyMessage: string;
    };

type RenderableTripPoint = TripTrendPoint & { value: number; x: number; y: number };
type RenderableTravelDayPoint = TravelDayTrendPoint & { value: number; x: number; y: number };

function TrendChart(props: TrendChartProps) {
  const { title, variant, data, emptyMessage } = props;

  const valueLabel = variant === 'trips' ? 'Trips' : 'Trip days';
  const hasData = data.length > 0;

  const chartWidth = 100;
  const chartHeight = 60;
  const verticalPadding = 10;
  const baselineY = chartHeight - verticalPadding;

  const values =
    variant === 'trips'
      ? (data as TripTrendPoint[]).map((point) => point.tripCount)
      : (data as TravelDayTrendPoint[]).map((point) => point.dayCount);
  const maxValue = hasData ? Math.max(...values) : 0;

  const [activeBucket, setActiveBucket] = useState<string | null>(null);
  const [pinnedBucket, setPinnedBucket] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<TrendExpandedSections>({});

  const renderablePoints: Array<RenderableTripPoint | RenderableTravelDayPoint> = hasData
    ? data.map((point, index) => {
        const rawValue =
          variant === 'trips'
            ? (point as TripTrendPoint).tripCount
            : (point as TravelDayTrendPoint).dayCount;
        const x = data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth;
        const ratio = maxValue ? rawValue / maxValue : 0;
        const y = baselineY - ratio * (chartHeight - verticalPadding * 2);
        return { ...point, value: rawValue, x, y };
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
          <div className="relative h-40 w-full" onMouseLeave={handleChartLeave}>
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
              const left = `${point.x}%`;
              const top = `${point.y}%`;
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
                />
              )
            ) : null}
          </div>
          <div
            className="grid gap-2 text-xs text-slate-400"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {data.map((point) => (
              <span key={point.bucket} className="text-center font-medium">
                {point.label}
              </span>
            ))}
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
      isTripDaysExpanded?: never;
      onToggleTripDays?: never;
    }
  | {
      variant: 'days';
      point: RenderableTravelDayPoint;
      valueLabel: string;
      isTripsExpanded: boolean;
      onToggleTrips: () => void;
      isTripDaysExpanded: boolean | undefined;
      onToggleTripDays: (() => void) | undefined;
    };

function TrendTooltipPanel(props: TrendTooltipPanelProps) {
  const { variant, point, valueLabel } = props;

  const clampedX = Math.min(Math.max(point.x, 12), 88);
  const topTarget = Math.max(point.y, 18);

  if (variant === 'trips') {
    const showToggle = point.trips.length > 3;
    const isExpanded = props.isTripsExpanded;
    const tripsToShow = showToggle && !isExpanded ? point.trips.slice(0, 3) : point.trips;
    const remainingTrips = point.trips.length - tripsToShow.length;

    return (
      <div
        className="absolute z-30 w-72 max-w-xs -translate-x-1/2 -translate-y-[110%] rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-100 shadow-xl"
        style={{ left: `${clampedX}%`, top: `${topTarget}%` }}
      >
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
    );
  }

  const showTripToggle = point.trips.length > 3;
  const showTripDaysToggle = point.tripDays.length > 3;
  const tripsExpanded = props.isTripsExpanded;
  const tripDaysExpanded = props.isTripDaysExpanded ?? false;
  const tripsToShow = showTripToggle && !tripsExpanded ? point.trips.slice(0, 3) : point.trips;
  const tripDaysToShow =
    showTripDaysToggle && !tripDaysExpanded ? point.tripDays.slice(0, 3) : point.tripDays;
  const remainingTrips = point.trips.length - tripsToShow.length;
  const remainingTripDays = point.tripDays.length - tripDaysToShow.length;

  return (
    <div
      className="absolute z-30 w-80 max-w-xs -translate-x-1/2 -translate-y-[110%] rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-100 shadow-xl"
      style={{ left: `${clampedX}%`, top: `${topTarget}%` }}
    >
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
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Trip days</p>
          {point.tripDays.length === 0 ? (
            <p className="text-slate-400">No trip days yet.</p>
          ) : (
            <>
              <ul className="space-y-1 text-left text-slate-200">
                {tripDaysToShow.map((entry) => (
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
              {showTripDaysToggle && props.onToggleTripDays ? (
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase text-brand hover:underline"
                  onClick={props.onToggleTripDays}
                >
                  {tripDaysExpanded ? 'See less' : `See more (${remainingTripDays} more)`}
                </button>
              ) : null}
            </>
          )}
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

