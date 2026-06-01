import { addDaysToDateKey, getDateKeyWeekday } from "../progress/timezone";

export type ScheduledDateRange = "today" | "tomorrow" | "this-week";

function dateKeyToDueDate(dateKey: string) {
  return `${dateKey}T00:00:00.000Z`;
}

export function getScheduledDateRange(dateRange: ScheduledDateRange, workdayDate: string) {
  switch (dateRange) {
    case "today": {
      const endDateExclusive = addDaysToDateKey(workdayDate, 1);
      return {
        dueDateStart: dateKeyToDueDate(workdayDate),
        dueDateEnd: dateKeyToDueDate(endDateExclusive),
        startDate: workdayDate,
        endDateExclusive,
      };
    }
    case "tomorrow": {
      const startDate = addDaysToDateKey(workdayDate, 1);
      const endDateExclusive = addDaysToDateKey(workdayDate, 2);
      return {
        dueDateStart: dateKeyToDueDate(startDate),
        dueDateEnd: dateKeyToDueDate(endDateExclusive),
        startDate,
        endDateExclusive,
      };
    }
    case "this-week": {
      const weekday = getDateKeyWeekday(workdayDate);
      const daysUntilSunday = (7 - weekday) % 7;
      const endDateExclusive = addDaysToDateKey(workdayDate, daysUntilSunday + 1);
      return {
        dueDateStart: dateKeyToDueDate(workdayDate),
        dueDateEnd: dateKeyToDueDate(endDateExclusive),
        startDate: workdayDate,
        endDateExclusive,
      };
    }
  }
}
