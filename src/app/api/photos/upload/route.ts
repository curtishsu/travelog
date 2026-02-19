import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import heicConvert from 'heic-convert';

import { badRequest, created, serverError, unauthorized } from '@/lib/http';
import { getSupabaseForRequest } from '@/lib/supabase/context';
import type { Database } from '@/types/database';

type TripDayRow = Database['public']['Tables']['trip_days']['Row'];
type TripRow = Database['public']['Tables']['trips']['Row'];
type PhotoRow = Database['public']['Tables']['photos']['Row'];

export const runtime = 'nodejs';

const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'mif1',
  'msf1'
]);

function isLikelyHeic(inputBuffer: Buffer, file: File) {
  const lowerName = file.name.toLowerCase();
  if (
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  ) {
    return true;
  }

  if (inputBuffer.length < 16) {
    return false;
  }

  const boxType = inputBuffer.subarray(4, 8).toString('ascii').toLowerCase();
  if (boxType !== 'ftyp') {
    return false;
  }

  const majorBrand = inputBuffer.subarray(8, 12).toString('ascii').toLowerCase();
  if (HEIC_BRANDS.has(majorBrand)) {
    return true;
  }

  for (let offset = 16; offset + 4 <= Math.min(inputBuffer.length, 64); offset += 4) {
    const brand = inputBuffer.subarray(offset, offset + 4).toString('ascii').toLowerCase();
    if (HEIC_BRANDS.has(brand)) {
      return true;
    }
  }

  return false;
}

async function convertHeicBufferToJpeg(inputBuffer: Buffer) {
  const converted = await heicConvert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.9
  });
  return Buffer.isBuffer(converted) ? converted : Buffer.from(converted);
}

async function processImageBuffers(sourceBuffer: Buffer) {
  const processor = sharp(sourceBuffer, { failOn: 'none' }).rotate();
  const fullProcessor = processor
    .clone()
    .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 });
  const thumbnailProcessor = processor
    .clone()
    .resize(400, 400, { fit: 'cover', position: 'centre', withoutEnlargement: true })
    .jpeg({ quality: 75 });

  const [{ data: fullBuffer, info: fullInfo }, thumbnailBuffer] = await Promise.all([
    fullProcessor.toBuffer({ resolveWithObject: true }),
    thumbnailProcessor.toBuffer()
  ]);

  return { fullBuffer, fullInfo, thumbnailBuffer };
}

export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  const timings: Record<string, number> = {};
  try {
    const parseFormDataStart = Date.now();
    const formData = await request.formData();
    timings.parseFormDataMs = Date.now() - parseFormDataStart;
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

    const readInputBufferStart = Date.now();
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    timings.readInputBufferMs = Date.now() - readInputBufferStart;

    const imageProcessingStart = Date.now();
    const likelyHeic = isLikelyHeic(inputBuffer, file);
    let processingBuffer = inputBuffer;
    let wasConvertedFromHeic = false;

    if (likelyHeic) {
      const heicConvertStart = Date.now();
      processingBuffer = await convertHeicBufferToJpeg(inputBuffer);
      wasConvertedFromHeic = true;
      timings.heicConvertMs = Date.now() - heicConvertStart;
    }

    let fullBuffer: Buffer;
    let fullInfo: sharp.OutputInfo;
    let thumbnailBuffer: Buffer;

    try {
      const processed = await processImageBuffers(processingBuffer);
      fullBuffer = processed.fullBuffer;
      fullInfo = processed.fullInfo;
      thumbnailBuffer = processed.thumbnailBuffer;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isUnsupportedFormat = /unsupported image format/i.test(message);

      if (!wasConvertedFromHeic && isUnsupportedFormat) {
        const heicConvertStart = Date.now();
        processingBuffer = await convertHeicBufferToJpeg(inputBuffer);
        wasConvertedFromHeic = true;
        timings.heicConvertMs = Date.now() - heicConvertStart;

        const processed = await processImageBuffers(processingBuffer);
        fullBuffer = processed.fullBuffer;
        fullInfo = processed.fullInfo;
        thumbnailBuffer = processed.thumbnailBuffer;
      } else {
        throw error;
      }
    }

    timings.imageProcessingMs = Date.now() - imageProcessingStart;

    const width = fullInfo.width ?? null;
    const height = fullInfo.height ?? null;

    const photoId = randomUUID();
    const basePath = `${user.id}/${tripId}/${tripDayId}`;
    const fullPath = `${basePath}/full/${photoId}.jpg`;
    const thumbnailPath = `${basePath}/thumb/${photoId}.jpg`;

    const fullUploadStart = Date.now();
    const fullUpload = await supabase.storage.from('photos').upload(fullPath, fullBuffer, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false
    });
    timings.fullUploadMs = Date.now() - fullUploadStart;

    if (fullUpload.error) {
      throw fullUpload.error;
    }

    const thumbnailUploadStart = Date.now();
    const thumbUpload = await supabase.storage.from('photos').upload(thumbnailPath, thumbnailBuffer, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false
    });
    timings.thumbnailUploadMs = Date.now() - thumbnailUploadStart;

    if (thumbUpload.error) {
      throw thumbUpload.error;
    }

    const fullUrl = supabase.storage.from('photos').getPublicUrl(fullPath).data.publicUrl;
    const thumbnailUrl = supabase.storage.from('photos').getPublicUrl(thumbnailPath).data.publicUrl;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photosTable = supabase.from('photos') as any;

    const insertPhotoStart = Date.now();
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
    timings.insertPhotoRecordMs = Date.now() - insertPhotoStart;

    const typedPhoto = photo as PhotoRow | null;

    if (insertError || !typedPhoto) {
      throw insertError ?? new Error('Failed to save photo metadata.');
    }

    timings.totalMs = Date.now() - requestStart;
    console.log('[POST /api/photos/upload] success', {
      tripId,
      tripDayId,
      photoId,
      fileType: file.type,
      fileSize: file.size,
      wasConvertedFromHeic,
      timings
    });

    return created({ photo: typedPhoto });
  } catch (error) {
    console.error('[POST /api/photos/upload] failed', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : null,
      stack: error instanceof Error ? error.stack : null,
      timings: {
        ...timings,
        totalMs: Date.now() - requestStart
      }
    });
    return serverError('Failed to process photo upload.');
  }
}



