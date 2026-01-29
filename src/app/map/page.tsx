import { MapGlobe } from '@/features/trips/components/map-globe';
import { loadMapLocations } from '@/features/trips/server';

export default async function MapPage({
  searchParams
}: {
  searchParams?: { person?: string; group?: string };
}) {
  const locations = await loadMapLocations({
    personId: searchParams?.person ?? null,
    groupId: searchParams?.group ?? null
  });

  return (
    <MapGlobe locations={locations} />
  );
}

