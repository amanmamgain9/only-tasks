import { addDaysToDateKey, getWeekStartDateKey } from "../progress/timezone";
import type { RecurrenceScheduleInput } from "./recurrence";

export function getQuotaReferenceDateForScheduledRange(input: {
  schedule: RecurrenceScheduleInput;
  startDate: string;
  endDateExclusive: string;
}) {
  const { schedule, startDate, endDateExclusive } = input;
  if (schedule.mode === "none") return null;

  const activeStartDate = schedule.startDate > startDate ? schedule.startDate : startDate;
  const scheduleEndDateExclusive = schedule.endDate ? addDaysToDateKey(schedule.endDate, 1) : endDateExclusive;
  const activeEndDateExclusive = scheduleEndDateExclusive < endDateExclusive
    ? scheduleEndDateExclusive
    : endDateExclusive;

  return activeStartDate < activeEndDateExclusive ? activeStartDate : null;
}

export function getQuotaReferenceDatesForScheduledRange(input: {
  schedule: RecurrenceScheduleInput;
  startDate: string;
  endDateExclusive: string;
}) {
  const referenceDate = getQuotaReferenceDateForScheduledRange(input);
  if (!referenceDate) return [];
  if (input.schedule.mode !== "daily_quota") return [referenceDate];

  const scheduleEndDateExclusive = input.schedule.endDate
    ? addDaysToDateKey(input.schedule.endDate, 1)
    : input.endDateExclusive;
  const activeEndDateExclusive = scheduleEndDateExclusive < input.endDateExclusive
    ? scheduleEndDateExclusive
    : input.endDateExclusive;
  const dates: string[] = [];
  for (let cursor = referenceDate; cursor < activeEndDateExclusive; cursor = addDaysToDateKey(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function getQuotaProgressWindow(input: {
  schedule: Extract<RecurrenceScheduleInput, { mode: "daily_quota" | "weekly_quota" }>;
  todayDate: string;
}) {
  const isDaily = input.schedule.mode === "daily_quota";
  const naturalPeriodStartDate = isDaily ? input.todayDate : getWeekStartDateKey(input.todayDate, 1);
  return {
    period: isDaily ? "day" as const : "week" as const,
    periodStartDate: naturalPeriodStartDate < input.schedule.startDate
      ? input.schedule.startDate
      : naturalPeriodStartDate,
    periodEndDateExclusive: addDaysToDateKey(naturalPeriodStartDate, isDaily ? 1 : 7),
  };
}
