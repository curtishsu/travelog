type ApiError = {
  error: string;
  issues?: unknown;
};

type GuestModeResponse = {
  guestModeEnabled: boolean;
};

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: ApiError | null = null;
    try {
      body = (await response.json()) as ApiError;
    } catch {
      // ignore JSON parse errors
    }
    const message = body?.error ?? `Request failed with status ${response.status}`;
    const error = new Error(message);
    (error as Error & { issues?: unknown }).issues = body?.issues;
    throw error;
  }
  return (await response.json()) as T;
}

export async function fetchGuestModeSettings(): Promise<GuestModeResponse> {
  const response = await fetch('/api/settings/guest-mode', { cache: 'no-store' });
  return handleJson<GuestModeResponse>(response);
}

export async function updateGuestModeSettings(payload: {
  guestModeEnabled: boolean;
  password?: string;
}): Promise<GuestModeResponse> {
  const response = await fetch('/api/settings/guest-mode', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleJson<GuestModeResponse>(response);
}


