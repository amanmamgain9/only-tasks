import { describe, expect, test } from "vitest";
import { getProgressWindow } from "./progress-core";
import {
  addDaysToDateKey,
  formatLocalDateKey,
  getStartOfLocalDateUtc,
  getWeekStartDateKey,
  normalizeTimeZone,
} from "./timezone";

describe("progress timezone windows", () => {
  test("normalizes invalid time zones to UTC", () => {
    expect(normalizeTimeZone("Not/AZone")).toBe("UTC");
  });

  test("formats local date keys in the requested time zone", () => {
    const instant = new Date("2026-05-31T20:30:00.000Z");
    expect(formatLocalDateKey(instant, "Asia/Kolkata")).toBe("2026-06-01");
    expect(formatLocalDateKey(instant, "America/Los_Angeles")).toBe("2026-05-31");
  });

  test("converts local midnight to UTC without drifting the calendar day", () => {
    expect(getStartOfLocalDateUtc("2026-06-01", "Asia/Kolkata").toISOString()).toBe("2026-05-31T18:30:00.000Z");
  });

  test("handles daylight-saving offsets for local day starts", () => {
    expect(getStartOfLocalDateUtc("2026-03-09", "America/Los_Angeles").toISOString()).toBe("2026-03-09T07:00:00.000Z");
  });

  test("uses Monday as the explicit product week start", () => {
    expect(getWeekStartDateKey("2026-05-31", 1)).toBe("2026-05-25");
  });

  test("builds a 7-day history window ending at the user's local today", () => {
    const window = getProgressWindow({
      timeZone: "Asia/Kolkata",
      now: new Date("2026-05-31T20:30:00.000Z"),
    });

    expect(window.todayDate).toBe("2026-06-01");
    expect(window.firstHistoryDate).toBe("2026-05-26");
    expect(window.historyStartUtc).toBe("2026-05-25T18:30:00.000Z");
    expect(window.historyEndUtc).toBe("2026-06-01T18:30:00.000Z");
  });

  test("adds days with date-only semantics", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});
