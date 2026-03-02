function getDateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function isValidTimeZone(timeZone: string) {
  try {
    getDateFormatter(timeZone).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return isValidTimeZone(normalized) ? normalized : null;
}

export function toISODateInTimeZone(value: Date, timeZone: string) {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  if (!normalizedTimeZone) {
    throw new Error('Invalid time zone');
  }
  const parts = getDateFormatter(normalizedTimeZone).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Could not format date in time zone');
  }
  return `${year}-${month}-${day}`;
}

export function getTodayISOInTimeZone(timeZone: string, now = new Date()) {
  return toISODateInTimeZone(now, timeZone);
}

function parseISODateParts(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) {
    throw new Error('Invalid ISO date');
  }
  return { year, month, day };
}

export function getDayIndexFromISODate(startDateISO: string, targetDateISO: string) {
  const startParts = parseISODateParts(startDateISO);
  const targetParts = parseISODateParts(targetDateISO);
  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const targetUtc = Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day);
  return Math.floor((targetUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
}
