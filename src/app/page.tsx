import { redirect } from 'next/navigation';

import { toISODate } from '@/lib/date';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Tables } from '@/types/database';

export const dynamic = 'force-dynamic';

type HomeTrip = Pick<Tables<'trips'>, 'id' | 'start_date' | 'end_date'>;

export default async function HomePage() {
  const { supabase, user, isDemoMode } = await getSupabaseForRequest();

  if (!user && !isDemoMode) {
    redirect('/journal');
  }

  const userId = user?.id ?? '';
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id,start_date,end_date')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .returns<HomeTrip[]>();

  if (error || !trips?.length) {
    redirect('/journal');
  }

  const todayISO = toISODate(new Date());
  const activeTrip = trips.find(
    (trip) => trip.start_date <= todayISO && trip.end_date >= todayISO
  );

  if (!activeTrip) {
    redirect('/journal');
  }

  const start = new Date(`${activeTrip.start_date}T00:00:00Z`);
  const today = new Date(`${todayISO}T00:00:00Z`);
  const dayIndex =
    Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (!Number.isFinite(dayIndex) || dayIndex < 1) {
    redirect('/journal');
  }

  redirect(`/trips/${activeTrip.id}/edit?tab=day-${dayIndex}`);
}

