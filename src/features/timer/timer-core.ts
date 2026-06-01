export type TimerPhase = "work" | "short_break" | "long_break";
export type TimerSessionState = "running" | "paused" | "completed" | "skipped";

export type TimerSettings = {
  focusDurationMinutes: number;
  shortBreakDurationMinutes: number;
  longBreakDurationMinutes: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  selectedSound: string;
};

export type TimerSessionLike = {
  phase: TimerPhase;
  state: TimerSessionState;
  durationSeconds: number;
  accumulatedMs: number;
  lastResumedAt: string | null;
  workSessionNumber: number | null;
};

export type TerminalTimerSessionLike = Pick<TimerSessionLike, "phase" | "workSessionNumber"> | null;

export type NextTimerSession = {
  phase: TimerPhase;
  workSessionNumber: number;
  durationSeconds: number;
};

export const DEFAULT_TIMER_SETTINGS: TimerSettings = {
  focusDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  selectedSound: "chime",
};

export function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function normalizeTimerSettings(settings: Partial<TimerSettings> | null | undefined): TimerSettings {
  return {
    focusDurationMinutes: clamp(Math.round(settings?.focusDurationMinutes ?? DEFAULT_TIMER_SETTINGS.focusDurationMinutes), 1, 300),
    shortBreakDurationMinutes: clamp(Math.round(settings?.shortBreakDurationMinutes ?? DEFAULT_TIMER_SETTINGS.shortBreakDurationMinutes), 1, 300),
    longBreakDurationMinutes: clamp(Math.round(settings?.longBreakDurationMinutes ?? DEFAULT_TIMER_SETTINGS.longBreakDurationMinutes), 1, 300),
    sessionsBeforeLongBreak: clamp(Math.round(settings?.sessionsBeforeLongBreak ?? DEFAULT_TIMER_SETTINGS.sessionsBeforeLongBreak), 1, 12),
    soundEnabled: settings?.soundEnabled ?? DEFAULT_TIMER_SETTINGS.soundEnabled,
    selectedSound: settings?.selectedSound || DEFAULT_TIMER_SETTINGS.selectedSound,
  };
}

export function getDurationSecondsForPhase(phase: TimerPhase, settings: Partial<TimerSettings> | null | undefined) {
  const normalized = normalizeTimerSettings(settings);
  if (phase === "work") return normalized.focusDurationMinutes * 60;
  if (phase === "short_break") return normalized.shortBreakDurationMinutes * 60;
  return normalized.longBreakDurationMinutes * 60;
}

function toTimeMs(value: string | number | Date) {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

export function getTimerElapsedMs(session: TimerSessionLike, now: string | number | Date = Date.now()) {
  const durationMs = Math.max(0, session.durationSeconds * 1000);
  const accumulatedMs = Math.max(0, session.accumulatedMs || 0);

  if (session.state !== "running" || !session.lastResumedAt) {
    return clamp(accumulatedMs, 0, durationMs);
  }

  const elapsedSinceResume = Math.max(0, toTimeMs(now) - toTimeMs(session.lastResumedAt));
  return clamp(accumulatedMs + elapsedSinceResume, 0, durationMs);
}

export function getTimerRemainingMs(session: TimerSessionLike, now: string | number | Date = Date.now()) {
  return Math.max(0, session.durationSeconds * 1000 - getTimerElapsedMs(session, now));
}

export function getTimerProgressPercent(session: TimerSessionLike, now: string | number | Date = Date.now()) {
  if (session.durationSeconds <= 0) return 100;
  return clamp((getTimerElapsedMs(session, now) / (session.durationSeconds * 1000)) * 100, 0, 100);
}

export function getDisplaySecondsRemaining(session: TimerSessionLike, now: string | number | Date = Date.now()) {
  const remainingMs = getTimerRemainingMs(session, now);
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

export function isRunningTimerExpired(session: TimerSessionLike, now: string | number | Date = Date.now()) {
  return session.state === "running" && getTimerRemainingMs(session, now) <= 0;
}

export function deriveNextTimerSession(
  terminalSession: TerminalTimerSessionLike,
  settings: Partial<TimerSettings> | null | undefined,
): NextTimerSession {
  const normalized = normalizeTimerSettings(settings);

  if (!terminalSession) {
    return {
      phase: "work",
      workSessionNumber: 1,
      durationSeconds: getDurationSecondsForPhase("work", normalized),
    };
  }

  if (terminalSession.phase === "work") {
    const completedWorkSessionNumber = Math.max(1, terminalSession.workSessionNumber ?? 1);
    const phase = completedWorkSessionNumber % normalized.sessionsBeforeLongBreak === 0 ? "long_break" : "short_break";

    return {
      phase,
      workSessionNumber: completedWorkSessionNumber,
      durationSeconds: getDurationSecondsForPhase(phase, normalized),
    };
  }

  const nextWorkSessionNumber = Math.max(1, (terminalSession.workSessionNumber ?? 0) + 1);
  return {
    phase: "work",
    workSessionNumber: nextWorkSessionNumber,
    durationSeconds: getDurationSecondsForPhase("work", normalized),
  };
}

export function shouldSuppressDisplayCorrection(localRemainingMs: number, serverRemainingMs: number, thresholdMs = 750) {
  return Math.abs(localRemainingMs - serverRemainingMs) <= thresholdMs;
}

export function formatTimerSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function getTimerPhaseLabel(phase: TimerPhase) {
  if (phase === "work") return "Focus";
  if (phase === "short_break") return "Break";
  return "Long Break";
}
