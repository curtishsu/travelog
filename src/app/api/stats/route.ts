import { calculateStats } from '@/features/stats/calculate';
import { ok, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';

export async function GET() {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  try {
    const summary = await calculateStats(supabase, user.id);
    return ok(summary);
  } catch (error) {
    console.error('[GET /api/stats] failed', error);
    return serverError('Failed to compute stats.');
  }
}

