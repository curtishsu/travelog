import { describe, expect, it } from 'vitest';

import { formatDateRange, formatDateForDisplay, getDateRange, getTripDuration, toISODate } from '@/lib/date';

describe('date utilities', () => {
  it('converts Date objects to ISO yyyy-mm-dd', () => {
    const result = toISODate(new Date('2025-03-15T12:30:00Z'));
    expect(result).toBe('2025-03-15');
  });

  it('generates inclusive date ranges', () => {
    const range = getDateRange('2025-01-01', '2025-01-03');
    expect(range).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
  });

  it('calculates trip duration including both endpoints', () => {
    const duration = getTripDuration('2025-04-10', '2025-04-15');
    expect(duration).toBe(6);
  });

  it('formats dates for display', () => {
    const display = formatDateForDisplay('2025-09-05');
    expect(display).toBe('Sep 5, 2025');
  });

  it('formats identical dates without range separator', () => {
    expect(formatDateRange('2025-05-01', '2025-05-01')).toBe('May 1, 2025');
  });

  it('formats date ranges with separator when needed', () => {
    expect(formatDateRange('2025-12-24', '2025-12-31')).toBe('Dec 24, 2025 – Dec 31, 2025');
  });
});

