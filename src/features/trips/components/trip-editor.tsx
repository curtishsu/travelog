'use client';

import { useEffect, useMemo, useState } from 'react';
import { TripOverviewForm, type TripOverviewFormValues } from '@/features/trips/components/trip-overview-form';
import { TripDayEditor } from '@/features/trips/components/trip-day-editor';
import { TripReflectionForm } from '@/features/trips/components/trip-reflection-form';
import { useTripDetail, useUpdateTrip } from '@/features/trips/hooks';
import type { TripDetail } from '@/features/trips/types';
import { useRouter } from 'next/navigation';

type TripEditorProps = {
  trip: TripDetail;
  initialTab: string;
  showOverlapNotice: boolean;
};

const OVERVIEW_TAB = 'overview';
const REFLECTION_TAB = 'reflection';

export function TripEditor({ trip, initialTab, showOverlapNotice }: TripEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [overviewWarning, setOverviewWarning] = useState<string | null>(
    showOverlapNotice ? 'This trip overlaps with other trips.' : null
  );
  const [overviewSuccess, setOverviewSuccess] = useState<string | null>(null);
  const { data: liveTrip } = useTripDetail(trip.id, trip);
  const { mutateAsync: updateTrip, isPending: isUpdatingTrip, error: overviewError } = useUpdateTrip();
  const [tripLockMessage, setTripLockMessage] = useState<string | null>(null);
  const [tripLockError, setTripLockError] = useState<string | null>(null);
  const [isTogglingTripLock, setIsTogglingTripLock] = useState(false);
  const [reflectionLockMessage, setReflectionLockMessage] = useState<string | null>(null);
  const [reflectionLockError, setReflectionLockError] = useState<string | null>(null);
  const [isTogglingReflectionLock, setIsTogglingReflectionLock] = useState(false);

  const tabs = useMemo(() => {
    const dayTabs = (liveTrip?.trip_days ?? []).map((day) => `day-${day.day_index}`);
    return [OVERVIEW_TAB, ...dayTabs, REFLECTION_TAB];
  }, [liveTrip?.trip_days]);

  const activeTrip = liveTrip ?? trip;
  const isTripLocked = activeTrip.is_trip_content_locked ?? false;
  const isReflectionLocked = activeTrip.is_reflection_locked ?? false;

  const overviewValues: TripOverviewFormValues = useMemo(
    () => ({
      name: activeTrip.name,
      startDate: activeTrip.start_date,
      endDate: activeTrip.end_date,
      links: activeTrip.trip_links.map((link) => ({ label: link.label, url: link.url })),
      tripTypes: activeTrip.trip_types.map((type) => type.type),
      reflection: activeTrip.reflection ?? null,
      tripGroupId: activeTrip.trip_group_id ?? null,
      tripGroupName: activeTrip.trip_group?.name ?? '',
      companionGroupIds:
        activeTrip.trip_companion_groups?.map((row) => row.trip_group_id) ??
        (activeTrip.trip_group_id ? [activeTrip.trip_group_id] : []),
      companionPersonIds: activeTrip.trip_companion_people?.map((row) => row.person_id) ?? []
    }),
    [activeTrip]
  );

  useEffect(() => {
    console.log('[TripEditor] active trip types snapshot', {
      tripId: activeTrip.id,
      source: liveTrip ? 'live' : 'initial',
      tripTypeCount: activeTrip.trip_types.length,
      tripTypeValues: activeTrip.trip_types.map((type) => type.type)
    });
  }, [activeTrip.id, activeTrip.trip_types, liveTrip]);

  async function handleOverviewSubmit(values: TripOverviewFormValues) {
    setOverviewSuccess(null);
    setOverviewWarning(null);
    const result = await updateTrip({
      tripId: activeTrip.id,
      payload: {
        name: values.name,
        startDate: values.startDate,
        endDate: values.endDate,
        links: values.links,
        tripTypes: values.tripTypes,
        tripGroupId: values.tripGroupId ?? null,
        companionGroupIds: values.companionGroupIds ?? [],
        companionPersonIds: values.companionPersonIds ?? []
      }
    });
    if (result.overlapWarning?.message) {
      setOverviewWarning(result.overlapWarning.message);
    }
    setOverviewSuccess('Trip overview saved.');
  }

  async function handleToggleTripLock() {
    setTripLockMessage(null);
    setTripLockError(null);
    setIsTogglingTripLock(true);
    try {
      const result = await updateTrip({
        tripId: activeTrip.id,
        payload: { isTripContentLocked: !isTripLocked }
      });
      const nextLocked = result.trip.is_trip_content_locked ?? !isTripLocked;
      setTripLockMessage(nextLocked ? 'Trip content locked.' : 'Trip content unlocked.');
      if (nextLocked) {
        setReflectionLockMessage(null);
        setReflectionLockError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update trip lock state.';
      setTripLockError(message);
    } finally {
      setIsTogglingTripLock(false);
    }
    }

  async function handleToggleReflectionLock() {
    if (isTripLocked) {
      return;
    }
    setReflectionLockMessage(null);
    setReflectionLockError(null);
    setIsTogglingReflectionLock(true);
    try {
      const result = await updateTrip({
        tripId: activeTrip.id,
        payload: { isReflectionLocked: !isReflectionLocked }
      });
      const nextLocked = result.trip.is_reflection_locked ?? !isReflectionLocked;
      setReflectionLockMessage(nextLocked ? 'Reflection locked.' : 'Reflection unlocked.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update reflection lock.';
      setReflectionLockError(message);
    } finally {
      setIsTogglingReflectionLock(false);
    }
  }

  useEffect(() => {
    if (!tabs.includes(activeTab) && tabs.length) {
      setActiveTab(tabs[0]);
    }
  }, [tabs, activeTab]);

  function renderTabContent() {
    if (activeTab === OVERVIEW_TAB) {
      return (
        <div className="space-y-4">
          {overviewError ? <p className="text-sm text-red-300">{overviewError.message}</p> : null}
          {overviewSuccess ? <p className="text-sm text-emerald-300">{overviewSuccess}</p> : null}
          <TripOverviewForm
            initialValues={overviewValues}
            submitLabel="Save overview"
            isSubmitting={isUpdatingTrip}
            onSubmit={handleOverviewSubmit}
            overlapWarning={overviewWarning}
            isTripLocked={isTripLocked}
            onToggleTripLock={handleToggleTripLock}
            isTogglingTripLock={isTogglingTripLock || isUpdatingTrip}
            tripLockMessage={tripLockMessage}
            tripLockError={tripLockError}
          />
        </div>
      );
    }

    if (activeTab === REFLECTION_TAB) {
      return (
        <TripReflectionForm
          tripId={activeTrip.id}
          initialReflection={activeTrip.reflection}
          onSaved={() => router.push(`/map?trip=${activeTrip.id}`)}
          isTripLocked={isTripLocked}
          isReflectionLocked={isReflectionLocked}
          onToggleLock={handleToggleReflectionLock}
          lockMessage={reflectionLockMessage}
          lockError={reflectionLockError}
          isTogglingLock={isTogglingReflectionLock || isUpdatingTrip}
        />
      );
    }

    const dayIndex = Number.parseInt(activeTab.replace('day-', ''), 10);
    const day = activeTrip.trip_days.find((item) => item.day_index === dayIndex);
    if (!day) {
      return <p className="text-sm text-slate-400">Day not found.</p>;
    }

    const hasNextDay = activeTrip.trip_days.some((item) => item.day_index === dayIndex + 1);

    return (
      <TripDayEditor
        tripId={activeTrip.id}
        day={day}
        hasNextDay={hasNextDay}
        onNavigateToNext={() => setActiveTab(`day-${dayIndex + 1}`)}
        onNavigateToReflection={() => setActiveTab(REFLECTION_TAB)}
        isTripLocked={isTripLocked}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">{activeTrip.name}</h1>
        <p className="text-sm text-slate-400">Manage trip details, daily notes, and privacy locks.</p>
      </header>
      <nav className="overflow-x-auto">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            const label =
              tab === OVERVIEW_TAB
                ? 'Overview'
                : tab === REFLECTION_TAB
                ? 'Reflection'
                : `Day ${tab.replace('day-', '')}`;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand text-white shadow-lg shadow-brand/30'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">{renderTabContent()}</div>
    </div>
  );
}

