import { TripCreateForm } from '@/features/trips/components/trip-create-form';

export default function TripCreatePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Add trip</h1>
      </header>
      <TripCreateForm />
    </div>
  );
}

