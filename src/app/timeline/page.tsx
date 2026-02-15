import { TimelinePlayer } from '@/features/timeline/components/timeline-player';
import { loadMapLocations } from '@/features/trips/server';

export const dynamic = 'force-dynamic';

export default async function TimelinePage({
  searchParams
}: {
  searchParams?: { person?: string; group?: string };
}) {
  const locations = await loadMapLocations({
    personId: searchParams?.person ?? null,
    groupId: searchParams?.group ?? null
  });

  return <TimelinePlayer locations={locations} />;
}

