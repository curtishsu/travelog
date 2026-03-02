import { describe, expect, it } from 'vitest';

import { getDayIndexFromISODate, getTodayISOInTimeZone, normalizeTimeZone } from '@/lib/timezone';

describe('timezone utilities', () => {
  it('normalizes valid and invalid time zones', () => {
    expect(normalizeTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(normalizeTimeZone('  ')).toBeNull();
    expect(normalizeTimeZone('Mars/Olympus')).toBeNull();
  });

  it('gets calendar date in provided time zone', () => {
    const now = new Date('2025-01-01T07:30:00Z');
    expect(getTodayISOInTimeZone('America/Los_Angeles', now)).toBe('2024-12-31');
    expect(getTodayISOInTimeZone('Asia/Tokyo', now)).toBe('2025-01-01');
  });

  it('calculates inclusive day index from ISO dates', () => {
    expect(getDayIndexFromISODate('2025-03-01', '2025-03-01')).toBe(1);
    expect(getDayIndexFromISODate('2025-03-01', '2025-03-03')).toBe(3);
  });
});
