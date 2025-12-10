'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useGuestModeSettings, useUpdateGuestModeSettings } from '@/features/settings/hooks';

const AUTH_DISABLED = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

export function GuestModeSettings() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useGuestModeSettings();
  const {
    mutateAsync: updateGuestMode,
    isPending: isUpdating
  } = useUpdateGuestModeSettings();
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function refreshAfterUpdate() {
    router.refresh();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.location.reload();
      }, 0);
    }
  }

  async function handleEnable() {
    setFormError(null);
    try {
      await updateGuestMode({ guestModeEnabled: true });
      setPassword('');
      refreshAfterUpdate();
    } catch (updateError) {
      setFormError((updateError as Error).message);
    }
  }

  async function handleDisable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!AUTH_DISABLED && password.trim().length === 0) {
      setFormError('Enter your account password to exit Guest Mode.');
      return;
    }

    try {
      await updateGuestMode({
        guestModeEnabled: false,
        password: password.trim().length ? password : undefined
      });
      setPassword('');
      refreshAfterUpdate();
    } catch (updateError) {
      setFormError((updateError as Error).message);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Privacy & Guest Mode</h1>
        <p className="text-sm text-slate-400">Loading Guest Mode preferences…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Privacy & Guest Mode</h1>
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
          <p className="font-medium">Couldn’t load your guest mode settings.</p>
          <p className="mt-2 text-red-200/80">{error.message}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => refetch()}
            className="mt-4"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const guestModeEnabled = data?.guestModeEnabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Privacy & Guest Mode</h1>
        <p className="text-sm text-slate-400">
          Control what sensitive trip content appears when you hand your device to someone else.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Guest Mode</h2>
            <p className="text-sm text-slate-400">
              {guestModeEnabled
                ? 'Private reflections, trip journals, and photos are hidden. Trips stay viewable.'
                : 'Private content remains visible. Enable Guest Mode when sharing your travel log.'}
            </p>
          </div>
          {guestModeEnabled ? (
            <form className="flex w-full max-w-sm flex-col gap-3" onSubmit={handleDisable}>
              {!AUTH_DISABLED ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Supabase password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                    autoComplete="current-password"
                    disabled={isUpdating}
                  />
                </div>
              ) : null}
              {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? 'Turning off…' : 'Turn off Guest Mode'}
                </Button>
              </div>
              {AUTH_DISABLED ? (
                <p className="text-xs text-slate-500">
                  Password verification is skipped in demo mode.
                </p>
              ) : null}
            </form>
          ) : (
            <Button type="button" onClick={handleEnable} disabled={isUpdating} className="self-start">
              {isUpdating ? 'Turning on…' : 'Enable Guest Mode'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


