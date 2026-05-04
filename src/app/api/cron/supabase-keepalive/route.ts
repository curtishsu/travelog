import { unauthorized } from '@/lib/http';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEEPALIVE_SOURCE = 'vercel-cron';
const KEEPALIVE_RETENTION_DAYS = 30;

function isAuthorized(request: Request) {
  const secret = env.CRON_SECRET;

  if (!secret) {
    throw new Error('CRON_SECRET is required for the Supabase keepalive cron route.');
  }

  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const userAgent = request.headers.get('user-agent');

  if (!isAuthorized(request)) {
    console.warn('[GET /api/cron/supabase-keepalive] unauthorized', {
      hasAuthorizationHeader: Boolean(request.headers.get('authorization')),
      userAgent
    });

    return unauthorized();
  }

  try {
    const supabase = createSupabaseServiceClient();
    const checkedAt = new Date();
    const retentionCutoff = new Date(checkedAt.getTime() - KEEPALIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase.from('keepalive_events').insert({
      source: KEEPALIVE_SOURCE
    });

    if (insertError) {
      throw insertError;
    }

    const { error: cleanupError } = await supabase
      .from('keepalive_events')
      .delete()
      .lt('created_at', retentionCutoff);

    if (cleanupError) {
      throw cleanupError;
    }

    console.log('[GET /api/cron/supabase-keepalive] success', {
      checkedAt: checkedAt.toISOString(),
      retentionCutoff,
      userAgent
    });

    return Response.json({
      ok: true,
      checkedAt: checkedAt.toISOString()
    });
  } catch (error) {
    console.error('[GET /api/cron/supabase-keepalive] failed', error);

    return Response.json(
      {
        ok: false,
        error: 'Failed to ping Supabase.',
        checkedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
