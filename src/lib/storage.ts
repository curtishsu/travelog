import { createSupabaseServiceClient } from '@/lib/supabase/service';

function parseStorageUrl(url: string) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const objectIndex = parts.indexOf('object');
    if (objectIndex === -1 || objectIndex + 2 >= parts.length) {
      return null;
    }
    const visibility = parts[objectIndex + 1]; // public | signed
    const bucketAndPath = parts.slice(objectIndex + 2);
    const bucket = bucketAndPath.shift();
    if (!bucket) {
      return null;
    }
    return {
      bucket,
      path: bucketAndPath.join('/'),
      visibility
    };
  } catch {
    return null;
  }
}

export async function removeStorageObjectByUrl(url: string) {
  const info = parseStorageUrl(url);
  if (!info) {
    return;
  }

  try {
    const client = createSupabaseServiceClient();
    const storage = client.storage.from(info.bucket);
    await storage.remove([info.path]);
  } catch (error) {
    // Log and continue – we don't want to block API response because of storage cleanup.
    console.error('Failed to remove storage object', error);
  }
}

