import type { TripStatus } from '@/types/database';

export function deriveTripStatus(startDateISO: string, endDateISO: string, now = new Date()): TripStatus {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(startDateISO);
  const end = new Date(endDateISO);

  if (today < start) {
    return 'draft';
  }

  if (today >= start && today <= end) {
    return 'active';
  }

  return 'completed';
}

