export type TimeframeMode = 'exact' | 'flexible';

/** Local calendar date at midnight (avoids UTC day shifts). */
export function localCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function startOfDay(date: Date): Date {
  return localCalendarDate(date);
}

export function endOfDay(date: Date): Date {
  const d = localCalendarDate(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = localCalendarDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Parse YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseDateInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return localCalendarDate(new Date(value));
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
}

/** Format a Date as YYYY-MM-DD in the local timezone. */
export function formatDateInputValue(date: Date): string {
  const d = localCalendarDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse stored job dates without shifting the calendar day. */
export function parseJobDateIso(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return parseDateInput(iso);
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return localCalendarDate(new Date());

  const utcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  if (utcMidnight) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
  }

  return localCalendarDate(d);
}

/** Serialize a calendar date for the API (noon UTC keeps the intended day stable). */
export function jobDateToIso(date: Date): string {
  const d = localCalendarDate(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)).toISOString();
}

function jobDateEndToIso(date: Date): string {
  const d = localCalendarDate(date);
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
  ).toISOString();
}

export function formatJobDate(date: Date): string {
  return localCalendarDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Human-readable timeframe for job detail views. */
export function formatJobTimeframe(startIso: string, endIso?: string | null): string {
  const start = parseJobDateIso(startIso);
  if (!endIso) {
    return formatJobDate(start);
  }

  const end = parseJobDateIso(endIso);
  if (start.getTime() === end.getTime()) {
    return formatJobDate(start);
  }

  return `${formatJobDate(start)} – ${formatJobDate(end)}`;
}

export function jobTimeframeHeading(startIso: string, endIso?: string | null): string {
  if (!endIso) return 'Preferred date';
  const startDay = parseJobDateIso(startIso);
  const endDay = parseJobDateIso(endIso);
  return startDay.getTime() === endDay.getTime() ? 'Preferred date' : 'Flexible timeframe';
}

export function defaultExactDate(): Date {
  return startOfDay(addDays(new Date(), 1));
}

export function defaultFlexibleRange(): { start: Date; end: Date } {
  const start = startOfDay(addDays(new Date(), 1));
  return { start, end: startOfDay(addDays(start, 7)) };
}

export function validateTimeframe(
  mode: TimeframeMode,
  exactDate: Date,
  flexibleStart: Date,
  flexibleEnd: Date,
): string | null {
  const today = startOfDay(new Date());

  if (mode === 'exact') {
    if (startOfDay(exactDate) < today) {
      return 'Please choose a date today or in the future.';
    }
    return null;
  }

  const start = startOfDay(flexibleStart);
  const end = startOfDay(flexibleEnd);
  if (start < today) {
    return 'The start of your date range must be today or later.';
  }
  if (end < start) {
    return 'The end date cannot be before the start date.';
  }
  return null;
}

export function timeframeToApi(
  mode: TimeframeMode,
  exactDate: Date,
  flexibleStart: Date,
  flexibleEnd: Date,
): { desiredDatetimeStart: string; desiredDatetimeEnd?: string } {
  if (mode === 'exact') {
    return { desiredDatetimeStart: jobDateToIso(exactDate) };
  }
  return {
    desiredDatetimeStart: jobDateToIso(flexibleStart),
    desiredDatetimeEnd: jobDateEndToIso(flexibleEnd),
  };
}

/** Populate post/edit job form fields from stored job dates. */
export function jobToTimeframeForm(
  startIso: string,
  endIso?: string | null,
): {
  mode: TimeframeMode;
  exactDate: Date;
  flexibleStart: Date;
  flexibleEnd: Date;
} {
  const start = parseJobDateIso(startIso);
  if (!endIso) {
    return {
      mode: 'exact',
      exactDate: start,
      flexibleStart: start,
      flexibleEnd: start,
    };
  }

  const end = parseJobDateIso(endIso);
  if (start.getTime() === end.getTime()) {
    return {
      mode: 'exact',
      exactDate: start,
      flexibleStart: start,
      flexibleEnd: end,
    };
  }

  return {
    mode: 'flexible',
    exactDate: start,
    flexibleStart: start,
    flexibleEnd: end,
  };
}
