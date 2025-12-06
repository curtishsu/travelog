export function parseISODate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date');
  }
  return date;
}

export function toISODate(value: Date | string) {
  const date = parseISODate(value);
  return date.toISOString().slice(0, 10);
}

export function getDateRange(start: Date | string, end: Date | string) {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  if (startDate > endDate) {
    throw new Error('Start date cannot be after end date.');
  }

  const cursor = new Date(startDate);
  const dates: string[] = [];

  while (cursor <= endDate) {
    dates.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function getTripDuration(start: Date | string, end: Date | string) {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

export function formatDateForDisplay(date: string) {
  return displayFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function formatDateRange(startDate: string, endDate: string) {
  const start = formatDateForDisplay(startDate);
  const end = formatDateForDisplay(endDate);
  if (start === end) {
    return start;
  }
  return `${start} – ${end}`;
}

