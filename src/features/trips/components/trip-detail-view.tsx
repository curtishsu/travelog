import { TripDetailActions } from '@/features/trips/components/trip-detail-actions';
import { TripDaySection } from '@/features/trips/components/trip-day-section';
import type { TripDetail } from '@/features/trips/types';
import { formatDateRange } from '@/lib/date';
import { MinimalMarkdown } from '@/components/ui/minimal-markdown';

type TripDetailViewProps = {
  trip: TripDetail;
  guestModeEnabled: boolean;
};

export function TripDetailView({ trip, guestModeEnabled }: TripDetailViewProps) {
  const tripTypes = trip.trip_types ?? [];
  const hasTripTypes = tripTypes.length > 0;
  const isTripLocked = trip.is_trip_content_locked ?? false;
  const isReflectionLocked = trip.is_reflection_locked ?? false;
  const isReflectionMasked = guestModeEnabled && (isTripLocked || isReflectionLocked);

  // Debug diagnostics to track trip types reaching the detail view
  console.log('[TripDetailView] render', {
    tripId: trip.id,
    tripTypeCount: tripTypes.length,
    tripTypeValues: tripTypes.map((type) => type.type),
    guestModeEnabled,
    isTripLocked
  });

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-white">{trip.name}</h1>
          </div>
          <div className="flex w-full items-center gap-3">
            <p className="text-sm text-slate-300">{formatDateRange(trip.start_date, trip.end_date)}</p>
            <TripDetailActions tripId={trip.id} disabled={guestModeEnabled} />
          </div>
          {trip.trip_group ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trip group</p>
              <p className="text-sm text-slate-200">
                {trip.trip_group.name}
                {trip.trip_group.members?.length ? (
                  <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                    {trip.trip_group.members
                      .map((member) => {
                        const first = member.first_name ?? '';
                        const lastInitial = (member.last_name?.[0] ?? '').toUpperCase();
                        return lastInitial ? `${first} ${lastInitial}.` : first;
                      })
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
        {guestModeEnabled ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
            Trip Log is locked
          </div>
        ) : null}
        {hasTripTypes ? (
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {tripTypes.map((type) => (
              <span
                key={type.id}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200"
              >
                {type.type}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No trip types logged yet.</p>
        )}
      </header>
      <main className="space-y-5">
        {trip.trip_days.map((day) => (
          <TripDaySection
            key={day.id}
            day={day}
            guestModeEnabled={guestModeEnabled}
            isTripLocked={isTripLocked}
          />
        ))}
      </main>
      {isReflectionMasked ? (
        <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Reflection</h2>
          <p className="text-sm text-slate-400">Reflection hidden while Guest Mode is enabled.</p>
        </section>
      ) : trip.reflection ? (
        <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Reflection</h2>
          <MinimalMarkdown value={trip.reflection} className="text-sm leading-relaxed" />
        </section>
      ) : null}
      {trip.trip_links?.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Links</h2>
          <ul className="space-y-2 text-sm text-brand">
            {trip.trip_links.map((link) => (
              <li key={link.id}>
                <a href={link.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

