'use client';

import { useState } from 'react';

import type { LocationInput } from '@/features/trips/api';
import { Button } from '@/components/ui/button';

type AddLocationDialogProps = {
  onClose: () => void;
  onSubmit: (location: LocationInput) => void;
};

const DEFAULT_VALUES: LocationInput = {
  displayName: '',
  city: '',
  region: '',
  country: '',
  lat: 0,
  lng: 0
};

export function AddLocationDialog({ onClose, onSubmit }: AddLocationDialogProps) {
  const [values, setValues] = useState<LocationInput>(DEFAULT_VALUES);
  const [error, setError] = useState<string | null>(null);

  function handleChange<T extends keyof LocationInput>(field: T, value: LocationInput[T]) {
    setError(null);
    setValues((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.displayName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (Number.isNaN(values.lat) || values.lat < -90 || values.lat > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (Number.isNaN(values.lng) || values.lng < -180 || values.lng > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }

    onSubmit({
      displayName: values.displayName.trim(),
      city: values.city?.trim() || null,
      region: values.region?.trim() || null,
      country: values.country?.trim() || null,
      lat: values.lat,
      lng: values.lng
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">Add location</h3>
          <p className="text-sm text-slate-400">Fill in the details from your map lookup.</p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Display name</label>
          <input
            type="text"
            value={values.displayName}
            onChange={(event) => handleChange('displayName', event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            placeholder="Tokyo, Japan"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">City</label>
            <input
              type="text"
              value={values.city ?? ''}
              onChange={(event) => handleChange('city', event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Region</label>
            <input
              type="text"
              value={values.region ?? ''}
              onChange={(event) => handleChange('region', event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Country</label>
            <input
              type="text"
              value={values.country ?? ''}
              onChange={(event) => handleChange('country', event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Latitude</label>
            <input
              type="number"
              step="0.000001"
              value={values.lat}
              onChange={(event) => handleChange('lat', Number.parseFloat(event.target.value))}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Longitude</label>
            <input
              type="number"
              step="0.000001"
              value={values.lng}
              onChange={(event) => handleChange('lng', Number.parseFloat(event.target.value))}
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add location</Button>
        </div>
      </form>
    </div>
  );
}

