import { ok, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';

export async function GET() {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;

  try {
    const { data: hashtagsData, error: hashtagsError } = await supabase
      .from('trip_day_hashtags')
      .select('hashtag, trip_day_id, trip_days(trip_id, trips(user_id))');
    if (hashtagsError) {
      throw hashtagsError;
    }

    const { data: tripTypesData, error: tripTypesError } = await supabase
      .from('trip_types')
      .select('type, trip_id, trips(user_id)');
    if (tripTypesError) {
      throw tripTypesError;
    }

    const hashtagsRows = hashtagsData ?? [];
    const tripTypesRows = tripTypesData ?? [];

    const hashtags = Array.from(
      new Set(
        hashtagsRows
          .filter(
            (item) =>
              item.trip_days?.trips && 'user_id' in item.trip_days.trips
                ? item.trip_days.trips.user_id === userId
                : false
          )
          .map((item) => item.hashtag)
      )
    ).filter(Boolean);
    const tripTypes = Array.from(
      new Set(
        tripTypesRows
          .filter((item) =>
            item.trips && 'user_id' in item.trips ? item.trips.user_id === userId : false
          )
          .map((item) => item.type)
      )
    ).filter(Boolean);

    return ok({
      hashtags,
      tripTypes
    });
  } catch (error) {
    console.error('[GET /api/trips/suggestions] failed', error);
    return serverError('Failed to load suggestions.');
  }
}

