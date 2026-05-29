import { describe, expect, test } from "vitest";
import {
  deriveNextTimerSession,
  formatTimerSeconds,
  getDisplaySecondsRemaining,
  getTimerElapsedMs,
  getTimerRemainingMs,
  shouldSuppressDisplayCorrection,
  type TimerSessionLike,
} from "./timer-core";

const baseRunningSession: TimerSessionLike = {
  phase: "work",
  state: "running",
  durationSeconds: 1500,
  accumulatedMs: 30_000,
  lastResumedAt: "2026-05-28T10:00:00.000Z",
  workSessionNumber: 1,
};

describe("timer core accounting", () => {
  test("running elapsed time includes accumulated time plus server elapsed time", () => {
    expect(getTimerElapsedMs(baseRunningSession, "2026-05-28T10:00:45.000Z")).toBe(75_000);
  });

  test("running elapsed time is clamped to the configured duration", () => {
    const elapsed = getTimerElapsedMs(baseRunningSession, "2026-05-28T11:00:00.000Z");
    expect(elapsed).toBe(1_500_000);
    expect(getTimerRemainingMs(baseRunningSession, "2026-05-28T11:00:00.000Z")).toBe(0);
  });

  test("paused timers do not keep accumulating time while displayed", () => {
    const paused: TimerSessionLike = {
      ...baseRunningSession,
      state: "paused",
      accumulatedMs: 120_000,
      lastResumedAt: "2026-05-28T10:00:00.000Z",
    };

    expect(getTimerElapsedMs(paused, "2026-05-28T10:30:00.000Z")).toBe(120_000);
  });

  test("display seconds use ceiling so tiny backend delay does not make the timer drop immediately", () => {
    const session: TimerSessionLike = {
      ...baseRunningSession,
      accumulatedMs: 0,
      durationSeconds: 60,
      lastResumedAt: "2026-05-28T10:00:00.000Z",
    };

    expect(getDisplaySecondsRemaining(session, "2026-05-28T10:00:00.250Z")).toBe(60);
    expect(formatTimerSeconds(60)).toBe("01:00");
  });

  test("drift tolerance suppresses tiny display corrections but allows meaningful reconciliation", () => {
    expect(shouldSuppressDisplayCorrection(1_000_000, 999_500)).toBe(true);
    expect(shouldSuppressDisplayCorrection(1_000_000, 997_000)).toBe(false);
  });
});

describe("timer phase progression", () => {
  const settings = {
    focusDurationMinutes: 25,
    shortBreakDurationMinutes: 5,
    longBreakDurationMinutes: 20,
    sessionsBeforeLongBreak: 4,
    soundEnabled: true,
    selectedSound: "chime",
  };

  test("work sequencing starts at session one and resumes work after a break", () => {
    expect(deriveNextTimerSession(null, settings)).toEqual({
      phase: "work",
      workSessionNumber: 1,
      durationSeconds: 1500,
    });

    expect(deriveNextTimerSession({ phase: "short_break", workSessionNumber: 4 }, settings)).toEqual({
      phase: "work",
      workSessionNumber: 5,
      durationSeconds: 1500,
    });
  });

  test("a completed non-boundary work session advances to a short break", () => {
    expect(deriveNextTimerSession({ phase: "work", workSessionNumber: 3 }, settings)).toEqual({
      phase: "short_break",
      workSessionNumber: 3,
      durationSeconds: 300,
    });
  });

  test("a completed boundary work session advances to a long break", () => {
    expect(deriveNextTimerSession({ phase: "work", workSessionNumber: 4 }, settings)).toEqual({
      phase: "long_break",
      workSessionNumber: 4,
      durationSeconds: 1200,
    });
  });

});
