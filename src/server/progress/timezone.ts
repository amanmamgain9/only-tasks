type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateKey(dateKey: string) {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("Invalid local date key. Expected YYYY-MM-DD.");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function getDateTimeParts(date: Date, timeZone: string): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return localAsUtcMs - date.getTime();
}

export function normalizeTimeZone(value: string | null | undefined) {
  const candidate = value?.trim() || "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

export function formatLocalDateKey(date: Date, timeZone: string) {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function getDateKeyWeekday(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getWeekStartDateKey(dateKey: string, weekStartsOn = 1) {
  const day = getDateKeyWeekday(dateKey);
  const delta = (day - weekStartsOn + 7) % 7;
  return addDaysToDateKey(dateKey, -delta);
}

export function getStartOfLocalDateUtc(dateKey: string, timeZone: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const localAsUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0);
  let utcMs = localAsUtcMs;

  for (let index = 0; index < 3; index += 1) {
    utcMs = localAsUtcMs - getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  }

  return new Date(utcMs);
}

export function enumerateDateKeys(startDateKey: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDaysToDateKey(startDateKey, index));
}

export function getDateKeyLabel(dateKey: string, options: { short?: boolean } = {}) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: options.short ? undefined : "short",
    day: options.short ? undefined : "numeric",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

export function getDateKeyWeekdayLabel(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}
