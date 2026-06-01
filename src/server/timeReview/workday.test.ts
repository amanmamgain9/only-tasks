import { describe, expect, test } from "vitest";
import { getReviewPhase, getWorkdayWindow } from "./workday";

describe("time review workday windows", () => {
  test("keeps after-midnight work in the previous workday for night owl rollover", () => {
    const window = getWorkdayWindow({
      timeZone: "Asia/Kolkata",
      rolloverTime: "02:00",
      now: new Date("2026-05-31T20:00:00.000Z"),
    });

    expect(window.workdayDate).toBe("2026-05-31");
    expect(window.rolloverTime).toBe("02:00");
    expect(window.localNowMinutes).toBe(90);
    expect(window.minutesUntilRollover).toBe(30);
  });

  test("uses the calendar day after the configured rollover has passed", () => {
    const window = getWorkdayWindow({
      timeZone: "Asia/Kolkata",
      rolloverTime: "02:00",
      now: new Date("2026-05-31T21:00:00.000Z"),
    });

    expect(window.workdayDate).toBe("2026-06-01");
    expect(window.localNowMinutes).toBe(150);
  });

  test("highlights midday and end-of-workday without a next-day catch-up state", () => {
    expect(getReviewPhase({
      completedTasks: 3,
      reviewedTasks: 0,
      localNowMinutes: 13 * 60,
      minutesUntilRollover: 11 * 60,
      middayReviewEnabled: true,
      middayReviewTime: "12:00",
    })).toBe("midday");

    expect(getReviewPhase({
      completedTasks: 3,
      reviewedTasks: 0,
      localNowMinutes: 22 * 60,
      minutesUntilRollover: 2 * 60,
      middayReviewEnabled: true,
      middayReviewTime: "12:00",
    })).toBe("end");
  });
});
