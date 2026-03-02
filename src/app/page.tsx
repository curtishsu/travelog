import { redirect } from 'next/navigation';

import { getSupabaseForRequest } from '@/lib/supabase/context';
import { getDayIndexFromISODate, getTodayISOInTimeZone } from '@/lib/timezone';
import type { Tables } from '@/types/database';

export const dynamic = 'force-dynamic';

const FALLBACK_TIME_ZONE = 'UTC';

type HomeTrip = Pick<Tables<'trips'>, 'id' | 'start_date' | 'end_date' | 'timezone'>;

export default async function HomePage() {
  const { supabase, user, isDemoMode } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
    redirect('/journal');
  }

  const userId = user?.id ?? '';
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id,start_date,end_date,timezone')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .returns<HomeTrip[]>();

  if (error || !trips?.length) {
    redirect('/journal');
  }

  const activeTrip = trips
    .map((trip) => {
      const timezone = trip.timezone ?? FALLBACK_TIME_ZONE;
      const todayISO = getTodayISOInTimeZone(timezone);
      return {
        trip,
        todayISO
      };
    })
    .find(({ trip, todayISO }) => trip.start_date <= todayISO && trip.end_date >= todayISO);

  if (!activeTrip) {
    redirect('/journal');
  }

  const dayIndex = getDayIndexFromISODate(activeTrip.trip.start_date, activeTrip.todayISO);

  if (!Number.isFinite(dayIndex) || dayIndex < 1) {
    redirect('/journal');
  }

  redirect(`/trips/${activeTrip.trip.id}/edit?tab=day-${dayIndex}`);
}

