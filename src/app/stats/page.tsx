import { StatsDashboard } from '@/features/stats/components/stats-dashboard';
import { loadStats } from '@/features/trips/server';

export default async function StatsPage() {
  const stats = await loadStats();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Stats</h1>
      </header>
      <StatsDashboard stats={stats} />
    </div>
  );
}

