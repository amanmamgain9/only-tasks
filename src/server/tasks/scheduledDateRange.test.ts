import { describe, expect, test } from "vitest";
import { getScheduledDateRange } from "./scheduledDateRange";

describe("scheduled date ranges", () => {
  test("builds today and tomorrow from the user's local current date", () => {
    expect(getScheduledDateRange("today", "2026-06-02")).toEqual({
      dueDateStart: "2026-06-02T00:00:00.000Z",
      dueDateEnd: "2026-06-03T00:00:00.000Z",
      startDate: "2026-06-02",
      endDateExclusive: "2026-06-03",
    });

    expect(getScheduledDateRange("tomorrow", "2026-06-02")).toEqual({
      dueDateStart: "2026-06-03T00:00:00.000Z",
      dueDateEnd: "2026-06-04T00:00:00.000Z",
      startDate: "2026-06-03",
      endDateExclusive: "2026-06-04",
    });
  });

  test("keeps this-week inclusive through Sunday", () => {
    expect(getScheduledDateRange("this-week", "2026-06-02")).toMatchObject({
      dueDateStart: "2026-06-02T00:00:00.000Z",
      dueDateEnd: "2026-06-08T00:00:00.000Z",
      startDate: "2026-06-02",
      endDateExclusive: "2026-06-08",
    });

    expect(getScheduledDateRange("this-week", "2026-06-07")).toMatchObject({
      dueDateStart: "2026-06-07T00:00:00.000Z",
      dueDateEnd: "2026-06-08T00:00:00.000Z",
      startDate: "2026-06-07",
      endDateExclusive: "2026-06-08",
    });
  });
});
