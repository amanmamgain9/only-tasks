import { and, desc, eq, inArray } from "drizzle-orm";
import {
  DEFAULT_TIMER_SETTINGS,
  deriveNextTimerSession,
  getDurationSecondsForPhase,
  getTimerElapsedMs,
  isRunningTimerExpired,
  normalizeTimerSettings,
  type NextTimerSession,
  type TimerPhase,
  type TimerSessionLike,
  type TimerSessionState,
  type TimerSettings,
} from "@/features/timer/timer-core";
import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema/projects";
import { tasks } from "@/server/db/schema/tasks";
import {
  startTimerSchema,
  timerSessions,
  timerSettings,
  timerSettingsInputSchema,
  type StartTimerInput,
  type TimerSession,
  type TimerSettingsInput,
} from "@/server/db/schema/timer";

export type TimerSessionDto = {
  id: number;
  userId: number;
  taskId: number | null;
  taskTitle: string | null;
  projectId: number | null;
  phase: TimerPhase;
  state: TimerSessionState;
  workSessionNumber: number;
  durationSeconds: number;
  accumulatedMs: number;
  startedAt: string;
  lastResumedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimerStatus = {
  activeSession: TimerSessionDto | null;
  nextSession: NextTimerSession;
  settings: TimerSettings;
  serverNow: string;
};

type TaskLink = {
  taskId: number | null;
  taskTitle: string | null;
  projectId: number | null;
};

function nowIso(now = new Date()) {
  return now.toISOString();
}

function toSettings(record: typeof timerSettings.$inferSelect | null | undefined): TimerSettings {
  if (!record) return DEFAULT_TIMER_SETTINGS;

  return normalizeTimerSettings({
    focusDurationMinutes: record.focusDurationMinutes,
    shortBreakDurationMinutes: record.shortBreakDurationMinutes,
    longBreakDurationMinutes: record.longBreakDurationMinutes,
    sessionsBeforeLongBreak: record.sessionsBeforeLongBreak,
    soundEnabled: record.soundEnabled === 1,
    selectedSound: record.selectedSound,
  });
}

function asSessionLike(session: TimerSession): TimerSessionLike {
  return {
    phase: session.phase,
    state: session.state,
    durationSeconds: session.durationSeconds,
    accumulatedMs: session.accumulatedMs,
    lastResumedAt: session.lastResumedAt,
    workSessionNumber: session.workSessionNumber,
  };
}

async function getTaskLink(userId: number, taskId: number | null | undefined): Promise<TaskLink> {
  if (!taskId) {
    return { taskId: null, taskTitle: null, projectId: null };
  }

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), eq(tasks.deleted, 0)))
    .limit(1);

  const task = rows[0];
  if (!task) {
    throw new Error("Task not found");
  }

  return {
    taskId: task.id,
    taskTitle: task.title,
    projectId: task.projectId,
  };
}

async function getTaskTitle(taskId: number | null) {
  if (!taskId) return null;
  const rows = await db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return rows[0]?.title ?? null;
}

async function toSessionDto(session: TimerSession): Promise<TimerSessionDto> {
  return {
    id: session.id,
    userId: session.userId,
    taskId: session.taskId,
    taskTitle: await getTaskTitle(session.taskId),
    projectId: session.projectId,
    phase: session.phase,
    state: session.state,
    workSessionNumber: session.workSessionNumber,
    durationSeconds: session.durationSeconds,
    accumulatedMs: session.accumulatedMs,
    startedAt: session.startedAt,
    lastResumedAt: session.lastResumedAt,
    pausedAt: session.pausedAt,
    endedAt: session.endedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

async function findActiveTimerSession(userId: number) {
  const rows = await db
    .select()
    .from(timerSessions)
    .where(and(eq(timerSessions.userId, userId), inArray(timerSessions.state, ["running", "paused"])))
    .orderBy(desc(timerSessions.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

async function findTimerSessionForUser(userId: number, timerId: number) {
  const rows = await db
    .select()
    .from(timerSessions)
    .where(and(eq(timerSessions.userId, userId), eq(timerSessions.id, timerId)))
    .limit(1);

  return rows[0] ?? null;
}

async function findSessionByMutationId(userId: number, clientMutationId: string | undefined) {
  if (!clientMutationId) return null;

  const rows = await db
    .select()
    .from(timerSessions)
    .where(and(eq(timerSessions.userId, userId), eq(timerSessions.clientMutationId, clientMutationId)))
    .limit(1);

  return rows[0] ?? null;
}

async function findLatestTerminalSession(userId: number) {
  const rows = await db
    .select()
    .from(timerSessions)
    .where(and(eq(timerSessions.userId, userId), inArray(timerSessions.state, ["completed", "skipped"])))
    .orderBy(desc(timerSessions.endedAt), desc(timerSessions.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

async function getSettingsRecord(userId: number) {
  const rows = await db.select().from(timerSettings).where(eq(timerSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

async function finalizeExpiredActiveTimer(userId: number, now = new Date()) {
  const active = await findActiveTimerSession(userId);
  if (!active || !isRunningTimerExpired(asSessionLike(active), now)) return null;

  const durationMs = active.durationSeconds * 1000;
  const remainingBeforeResumeMs = Math.max(0, durationMs - active.accumulatedMs);
  const expectedEndMs = active.lastResumedAt
    ? new Date(active.lastResumedAt).getTime() + remainingBeforeResumeMs
    : now.getTime();
  const endedAt = new Date(Math.min(now.getTime(), expectedEndMs)).toISOString();
  const updatedAt = nowIso(now);

  const [updated] = await db
    .update(timerSessions)
    .set({
      state: "completed",
      accumulatedMs: durationMs,
      endedAt,
      pausedAt: null,
      updatedAt,
    })
    .where(eq(timerSessions.id, active.id))
    .returning();

  return updated ?? null;
}

export async function getTimerSettingsForUser(userId: number) {
  return toSettings(await getSettingsRecord(userId));
}

export async function saveTimerSettingsForUser(userId: number, input: TimerSettingsInput) {
  const parsed = timerSettingsInputSchema.parse(input);
  const currentTime = nowIso();
  const values = {
    focusDurationMinutes: parsed.focusDurationMinutes,
    shortBreakDurationMinutes: parsed.shortBreakDurationMinutes,
    longBreakDurationMinutes: parsed.longBreakDurationMinutes,
    sessionsBeforeLongBreak: parsed.sessionsBeforeLongBreak,
    soundEnabled: parsed.soundEnabled ? 1 : 0,
    selectedSound: parsed.selectedSound,
    updatedAt: currentTime,
  };

  const [record] = await db
    .insert(timerSettings)
    .values({
      userId,
      ...values,
      createdAt: currentTime,
    })
    .onConflictDoUpdate({
      target: timerSettings.userId,
      set: values,
    })
    .returning();

  return toSettings(record);
}

export async function getTimerStatusForUser(userId: number, now = new Date()): Promise<TimerStatus> {
  await finalizeExpiredActiveTimer(userId, now);

  const settings = await getTimerSettingsForUser(userId);
  const active = await findActiveTimerSession(userId);
  const terminal = active ? null : await findLatestTerminalSession(userId);
  const nextSession = deriveNextTimerSession(terminal, settings);

  return {
    activeSession: active ? await toSessionDto(active) : null,
    nextSession,
    settings,
    serverNow: nowIso(now),
  };
}

export async function startTimerForUser(userId: number, input: StartTimerInput = {}) {
  const parsed = startTimerSchema.parse(input);
  const existingMutation = await findSessionByMutationId(userId, parsed.clientMutationId);
  if (existingMutation) {
    return getTimerStatusForUser(userId);
  }

  await finalizeExpiredActiveTimer(userId);

  const active = await findActiveTimerSession(userId);
  if (active) {
    return getTimerStatusForUser(userId);
  }

  const taskLink = await getTaskLink(userId, parsed.taskId);
  const settings = await getTimerSettingsForUser(userId);
  const terminal = await findLatestTerminalSession(userId);
  const nextSession = deriveNextTimerSession(terminal, settings);
  const phase = parsed.phase ?? nextSession.phase;
  const workSessionNumber = phase === "work" ? nextSession.workSessionNumber : nextSession.workSessionNumber;
  const currentTime = nowIso();

  await db.insert(timerSessions).values({
    userId,
    taskId: taskLink.taskId,
    projectId: taskLink.projectId,
    phase,
    state: "running",
    workSessionNumber,
    durationSeconds: parsed.durationSeconds ?? getDurationSecondsForPhase(phase, settings),
    accumulatedMs: 0,
    startedAt: currentTime,
    lastResumedAt: currentTime,
    pausedAt: null,
    endedAt: null,
    clientMutationId: parsed.clientMutationId,
    createdAt: currentTime,
    updatedAt: currentTime,
  });

  return getTimerStatusForUser(userId);
}

export async function pauseTimerForUser(userId: number, timerId: number) {
  const session = await findTimerSessionForUser(userId, timerId);
  if (!session) throw new Error("Timer not found");
  if (session.state !== "running") return getTimerStatusForUser(userId);

  const now = new Date();
  const currentTime = nowIso(now);
  const accumulatedMs = getTimerElapsedMs(asSessionLike(session), now);

  await db
    .update(timerSessions)
    .set({
      state: "paused",
      accumulatedMs,
      pausedAt: currentTime,
      updatedAt: currentTime,
    })
    .where(eq(timerSessions.id, session.id));

  return getTimerStatusForUser(userId);
}

export async function resumeTimerForUser(userId: number, timerId: number) {
  const session = await findTimerSessionForUser(userId, timerId);
  if (!session) throw new Error("Timer not found");
  if (session.state !== "paused") return getTimerStatusForUser(userId);

  const currentTime = nowIso();

  await db
    .update(timerSessions)
    .set({
      state: "running",
      lastResumedAt: currentTime,
      pausedAt: null,
      updatedAt: currentTime,
    })
    .where(eq(timerSessions.id, session.id));

  return getTimerStatusForUser(userId);
}

export async function skipTimerForUser(userId: number, timerId: number) {
  const session = await findTimerSessionForUser(userId, timerId);
  if (!session) throw new Error("Timer not found");
  if (session.state !== "running" && session.state !== "paused") return getTimerStatusForUser(userId);

  const now = new Date();
  const currentTime = nowIso(now);
  const accumulatedMs = getTimerElapsedMs(asSessionLike(session), now);

  await db
    .update(timerSessions)
    .set({
      state: "skipped",
      accumulatedMs,
      endedAt: currentTime,
      pausedAt: null,
      updatedAt: currentTime,
    })
    .where(eq(timerSessions.id, session.id));

  return getTimerStatusForUser(userId);
}

export async function completeTimerForUser(userId: number, timerId: number) {
  const session = await findTimerSessionForUser(userId, timerId);
  if (!session) throw new Error("Timer not found");
  if (session.state !== "running" && session.state !== "paused") return getTimerStatusForUser(userId);

  const currentTime = nowIso();

  await db
    .update(timerSessions)
    .set({
      state: "completed",
      accumulatedMs: session.durationSeconds * 1000,
      endedAt: currentTime,
      pausedAt: null,
      updatedAt: currentTime,
    })
    .where(eq(timerSessions.id, session.id));

  return getTimerStatusForUser(userId);
}

export async function resetTimerForUser(userId: number, timerId: number) {
  const session = await findTimerSessionForUser(userId, timerId);
  if (!session) throw new Error("Timer not found");
  if (session.state !== "running" && session.state !== "paused") return getTimerStatusForUser(userId);

  const currentTime = nowIso();

  await db
    .update(timerSessions)
    .set({
      state: "running",
      accumulatedMs: 0,
      startedAt: currentTime,
      lastResumedAt: currentTime,
      pausedAt: null,
      endedAt: null,
      updatedAt: currentTime,
    })
    .where(eq(timerSessions.id, session.id));

  return getTimerStatusForUser(userId);
}

export async function getTimerProjectContext(projectId: number | null) {
  if (!projectId) return null;
  const rows = await db.select({ title: projects.title }).from(projects).where(eq(projects.id, projectId)).limit(1);
  return rows[0] ?? null;
}
