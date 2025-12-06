import { MapGlobe } from '@/features/trips/components/map-globe';
import { loadMapLocations } from '@/features/trips/server';

export default async function MapPage() {
  const locations = await loadMapLocations();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Globe</h1>
      </header>
      <MapGlobe locations={locations} />
    </div>
  );
}

