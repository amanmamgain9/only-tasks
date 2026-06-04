import { describe, expect, test } from "vitest";
import { getQuotaProgressWindow, getQuotaReferenceDateForScheduledRange } from "./quotaProgress";

describe("quota progress windows", () => {
  test("counts a weekly quota from the schedule start during its first partial week", () => {
    expect(getQuotaProgressWindow({
      schedule: {
        mode: "weekly_quota",
        startDate: "2026-06-04",
        endDate: null,
        targetCount: 3,
        comparator: "at_least",
      },
      todayDate: "2026-06-05",
    })).toEqual({
      period: "week",
      periodStartDate: "2026-06-04",
      periodEndDateExclusive: "2026-06-08",
    });
  });

  test("uses the natural week start after the first weekly quota week", () => {
    expect(getQuotaProgressWindow({
      schedule: {
        mode: "weekly_quota",
        startDate: "2026-06-04",
        endDate: null,
        targetCount: 3,
        comparator: "at_least",
      },
      todayDate: "2026-06-10",
    })).toEqual({
      period: "week",
      periodStartDate: "2026-06-08",
      periodEndDateExclusive: "2026-06-15",
    });
  });

  test("keeps future-starting quota targets visible inside the selected week range", () => {
    expect(getQuotaReferenceDateForScheduledRange({
      schedule: {
        mode: "weekly_quota",
        startDate: "2026-06-06",
        endDate: null,
        targetCount: 3,
        comparator: "at_least",
      },
      startDate: "2026-06-03",
      endDateExclusive: "2026-06-08",
    })).toBe("2026-06-06");
  });

  test("omits quota targets when their active dates do not overlap the selected range", () => {
    expect(getQuotaReferenceDateForScheduledRange({
      schedule: {
        mode: "daily_quota",
        startDate: "2026-06-06",
        endDate: null,
        targetCount: 8,
        comparator: "at_least",
      },
      startDate: "2026-06-03",
      endDateExclusive: "2026-06-04",
    })).toBeNull();
  });
});
