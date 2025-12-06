import { NextRequest } from 'next/server';

import { noContent, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import { removeStorageObjectByUrl } from '@/lib/storage';

type Params = { params: { photoId: string } };

export async function DELETE(_: NextRequest, { params }: Params) {
  const { supabase, user } = await getSupabaseForRequest();

  if (!user) {
    return unauthorized();
  }

  const userId = user.id;
  const { photoId } = params;
  const { data: photo, error: fetchError } = await supabase
    .from('photos')
    .select('id,thumbnail_url,full_url,trip_id')
    .eq('id', photoId)
    .maybeSingle();

  if (fetchError) {
    return serverError('Failed to load photo.');
  }

  if (photo) {
    const { data: owningTrip, error: tripOwnershipError } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', photo.trip_id)
      .single();

    if (tripOwnershipError || owningTrip?.user_id !== userId) {
      return unauthorized();
    }

    await Promise.all([
      removeStorageObjectByUrl(photo.thumbnail_url),
      removeStorageObjectByUrl(photo.full_url)
    ]);
  }

  const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId);

  if (deleteError) {
    return serverError('Failed to delete photo.');
  }

  return noContent();
}

