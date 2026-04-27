import { unauthorized } from '@/lib/http';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const secret = env.CRON_SECRET;

  if (!secret) {
    throw new Error('CRON_SECRET is required for the Supabase keepalive cron route.');
  }

  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from('trips').select('id', { head: true, count: 'estimated' }).limit(1);

    if (error) {
      throw error;
    }

    return Response.json({
      ok: true,
      checkedAt: new Date().toISOString()
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
