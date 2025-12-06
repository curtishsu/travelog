import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

import { badRequest, created, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const tripId = formData.get('tripId');
    const tripDayId = formData.get('tripDayId');
    const tripLocationId = formData.get('tripLocationId');

    if (!(file instanceof File)) {
      return badRequest('Photo file is required.');
    }

    if (typeof tripId !== 'string' || !tripId) {
      return badRequest('tripId is required.');
    }

    if (typeof tripDayId !== 'string' || !tripDayId) {
      return badRequest('tripDayId is required.');
    }

    if (file.size > 10 * 1024 * 1024) {
      return badRequest('Photos must be 10 MB or smaller.');
    }

    if (file.type && !file.type.startsWith('image/')) {
      return badRequest('Only image uploads are supported.');
    }

    const { supabase, user } = await getSupabaseForRequest();

    if (!user) {
      return unauthorized();
    }

    const { data: tripDay, error: tripDayError } = await supabase
      .from('trip_days')
      .select('id,trip_id')
      .eq('id', tripDayId)
      .maybeSingle();

    if (tripDayError || !tripDay) {
      return badRequest('Trip day not found.');
    }

    const { data: owningTrip, error: tripOwnershipError } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', tripDay.trip_id)
      .single();

    if (tripOwnershipError || owningTrip?.user_id !== user.id) {
      return unauthorized();
    }

    if (tripDay.trip_id !== tripId) {
      return badRequest('Photo trip reference mismatch.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const processor = sharp(inputBuffer, { failOn: 'none' }).rotate();
    const metadata = await processor.metadata();

    const [fullBuffer, thumbnailBuffer] = await Promise.all([
      processor.clone().jpeg({ quality: 90 }).toBuffer(),
      processor
        .clone()
        .resize(400, 400, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toBuffer()
    ]);

    const width = metadata.width ?? null;
    const height = metadata.height ?? null;

    const photoId = randomUUID();
    const basePath = `${user.id}/${tripId}/${tripDayId}`;
    const fullPath = `${basePath}/full/${photoId}.jpg`;
    const thumbnailPath = `${basePath}/thumb/${photoId}.jpg`;

    const fullUpload = await supabase.storage.from('photos').upload(fullPath, fullBuffer, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false
    });

    if (fullUpload.error) {
      throw fullUpload.error;
    }

    const thumbUpload = await supabase.storage.from('photos').upload(thumbnailPath, thumbnailBuffer, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false
    });

    if (thumbUpload.error) {
      throw thumbUpload.error;
    }

    const fullUrl = supabase.storage.from('photos').getPublicUrl(fullPath).data.publicUrl;
    const thumbnailUrl = supabase.storage.from('photos').getPublicUrl(thumbnailPath).data.publicUrl;

    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        trip_id: tripId,
        trip_day_id: tripDayId,
        trip_location_id:
          typeof tripLocationId === 'string' && tripLocationId.length ? tripLocationId : null,
        thumbnail_url: thumbnailUrl,
        full_url: fullUrl,
        width,
        height
      })
      .select()
      .single();

    if (insertError || !photo) {
      throw insertError ?? new Error('Failed to save photo metadata.');
    }

    return created({ photo });
  } catch (error) {
    console.error('[POST /api/photos/upload] failed', error);
    return serverError('Failed to process photo upload.');
  }
}



