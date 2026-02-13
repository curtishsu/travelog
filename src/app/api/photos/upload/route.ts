import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

import { badRequest, created, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripDayRow = Database['public']['Tables']['trip_days']['Row'];
type TripRow = Database['public']['Tables']['trips']['Row'];
type PhotoRow = Database['public']['Tables']['photos']['Row'];

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const tripId = formData.get('tripId');
    const tripDayId = formData.get('tripDayId');
    const tripLocationId = formData.get('tripLocationId');

    console.log('[POST /api/photos/upload] incoming', {
      hasFile: file instanceof File,
      fileType: file instanceof File ? file.type : null,
      fileSize: file instanceof File ? file.size : null,
      tripId,
      tripDayId,
      tripLocationId
    });

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
      .maybeSingle<Pick<TripDayRow, 'id' | 'trip_id'>>();

    if (tripDayError || !tripDay) {
      return badRequest('Trip day not found.');
    }

    const { data: owningTrip, error: tripOwnershipError } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', tripDay.trip_id)
      .single<Pick<TripRow, 'user_id'>>();

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photosTable = supabase.from('photos') as any;

    const { data: photo, error: insertError } = await photosTable
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

    const typedPhoto = photo as PhotoRow | null;

    if (insertError || !typedPhoto) {
      throw insertError ?? new Error('Failed to save photo metadata.');
    }

    return created({ photo: typedPhoto });
  } catch (error) {
    console.error('[POST /api/photos/upload] failed', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : null,
      stack: error instanceof Error ? error.stack : null
    });
    return serverError('Failed to process photo upload.');
  }
}



