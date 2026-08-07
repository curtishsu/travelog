export function parseISODate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date;
}

export function toISODate(value: Date | string) {
  return parseISODate(value).toISOString().slice(0, 10);
}

export function formatDateForDisplay(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = formatDateForDisplay(startDate);
  const end = formatDateForDisplay(endDate);
  return start === end ? start : `${start} - ${end}`;
}

export function getTripDuration(start: Date | string, end: Date | string) {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function getMonthValue(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function monthValueToRange(month: string, days: number) {
  const [yearString, monthString] = month.split('-');
  const year = Number.parseInt(yearString, 10);
  const monthIndex = Number.parseInt(monthString, 10) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + Math.max(days, 1) - 1);
  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
  };
}

export function getTodayISOInTimeZone(timeZone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    return toISODate(now);
  }
  return `${year}-${month}-${day}`;
}

export function getDayIndexFromISODate(startDateISO: string, targetDateISO: string) {
  const [startYear, startMonth, startDay] = startDateISO.split('-').map(Number);
  const [targetYear, targetMonth, targetDay] = targetDateISO.split('-').map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const targetUtc = Date.UTC(targetYear, targetMonth - 1, targetDay);
  return Math.floor((targetUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
}
