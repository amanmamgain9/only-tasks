import {
  addDaysToDateKey,
  formatLocalDateKey,
  getLocalDateTimeParts,
  getStartOfLocalDateUtc,
  normalizeTimeZone,
} from "../progress/timezone";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeOfDay(value: string | null | undefined, fallback = "00:00") {
  const candidate = value?.trim() || fallback;
  const match = TIME_PATTERN.exec(candidate);
  if (!match) return parseTimeOfDay(fallback, "00:00");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function normalizeTimeOfDay(value: string | null | undefined, fallback = "00:00") {
  const minutes = parseTimeOfDay(value, fallback);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function getWorkdayWindow(input: {
  now?: Date;
  timeZone?: string | null;
  rolloverTime?: string | null;
}) {
  const timeZone = normalizeTimeZone(input.timeZone);
  const now = input.now ?? new Date();
  const rolloverTime = normalizeTimeOfDay(input.rolloverTime);
  const rolloverMinutes = parseTimeOfDay(rolloverTime);
  const parts = getLocalDateTimeParts(now, timeZone);
  const localNowMinutes = parts.hour * 60 + parts.minute;
  const calendarDate = formatLocalDateKey(now, timeZone);
  const workdayDate = localNowMinutes < rolloverMinutes
    ? addDaysToDateKey(calendarDate, -1)
    : calendarDate;
  const startUtcMs = getStartOfLocalDateUtc(workdayDate, timeZone).getTime() + rolloverMinutes * 60_000;
  const endUtcMs = startUtcMs + 24 * 60 * 60_000;
  const minutesSinceStart = Math.max(0, Math.floor((now.getTime() - startUtcMs) / 60_000));
  const minutesUntilRollover = Math.max(0, Math.ceil((endUtcMs - now.getTime()) / 60_000));

  return {
    timeZone,
    rolloverTime,
    rolloverMinutes,
    workdayDate,
    localNowMinutes,
    minutesSinceStart,
    minutesUntilRollover,
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

export function getReviewWindow(minutesUntilRollover: number) {
  return minutesUntilRollover <= 4 * 60 ? "same_workday_end" as const : "same_workday_midday" as const;
}

export function getReviewPhase(input: {
  completedTasks: number;
  reviewedTasks: number;
  localNowMinutes: number;
  minutesUntilRollover: number;
  middayReviewEnabled: boolean;
  middayReviewTime?: string | null;
}) {
  if (input.completedTasks === 0) return "quiet" as const;
  if (input.reviewedTasks >= input.completedTasks) return "reviewed" as const;
  if (input.minutesUntilRollover <= 4 * 60) return "end" as const;
  const middayMinutes = parseTimeOfDay(input.middayReviewTime, "12:00");
  if (input.middayReviewEnabled && input.localNowMinutes >= middayMinutes) return "midday" as const;
  return "quiet" as const;
}
