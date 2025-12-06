import { TripDetailActions } from '@/features/trips/components/trip-detail-actions';
import { TripDaySection } from '@/features/trips/components/trip-day-section';
import type { TripDetail } from '@/features/trips/types';
import { formatDateRange } from '@/lib/date';

type TripDetailViewProps = {
  trip: TripDetail;
};

export function TripDetailView({ trip }: TripDetailViewProps) {
  const tripTypes = trip.trip_types ?? [];
  const hasTripTypes = tripTypes.length > 0;

  // Debug diagnostics to track trip types reaching the detail view
  console.log('[TripDetailView] render', {
    tripId: trip.id,
    tripTypeCount: tripTypes.length,
    tripTypeValues: tripTypes.map((type) => type.type)
  });

  return (
    <div className="space-y-10">
      <header className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white">{trip.name}</h1>
            </div>
            <p className="text-sm text-slate-300">{formatDateRange(trip.start_date, trip.end_date)}</p>
            {trip.trip_group ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Trip group
                </p>
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
          <TripDetailActions tripId={trip.id} />
        </div>
        {hasTripTypes ? (
          <div className="flex flex-wrap gap-2">
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
      <main className="space-y-6">
        {trip.trip_days.map((day) => (
          <TripDaySection key={day.id} day={day} />
        ))}
      </main>
      {trip.reflection ? (
        <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Reflection</h2>
          <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{trip.reflection}</p>
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

