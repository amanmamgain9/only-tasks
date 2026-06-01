import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { projects } from "./projects";
import { tasks } from "./tasks";
import { users } from "./users";

export const timerPhases = ["work", "short_break", "long_break"] as const;
export const timerSessionStates = ["running", "paused", "completed", "skipped"] as const;

export const timerSessions = sqliteTable("pmwd_timer_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  phase: text("phase", { enum: timerPhases }).notNull(),
  state: text("state", { enum: timerSessionStates }).notNull().default("running"),
  workSessionNumber: integer("work_session_number").notNull().default(1),
  durationSeconds: integer("duration_seconds").notNull(),
  accumulatedMs: integer("accumulated_ms").notNull().default(0),
  startedAt: text("started_at").notNull(),
  lastResumedAt: text("last_resumed_at"),
  pausedAt: text("paused_at"),
  endedAt: text("ended_at"),
  clientMutationId: text("client_mutation_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const timerSettings = sqliteTable("pmwd_timer_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  focusDurationMinutes: integer("focus_duration_minutes").notNull().default(25),
  shortBreakDurationMinutes: integer("short_break_duration_minutes").notNull().default(5),
  longBreakDurationMinutes: integer("long_break_duration_minutes").notNull().default(15),
  sessionsBeforeLongBreak: integer("sessions_before_long_break").notNull().default(4),
  soundEnabled: integer("sound_enabled").notNull().default(1),
  selectedSound: text("selected_sound").notNull().default("chime"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type TimerSession = InferSelectModel<typeof timerSessions>;
export type InsertTimerSession = InferInsertModel<typeof timerSessions>;
export type TimerSettingsRecord = InferSelectModel<typeof timerSettings>;

export const startTimerSchema = z.object({
  phase: z.enum(timerPhases).optional(),
  durationSeconds: z.number().int().min(30).max(60 * 60 * 6).optional(),
  taskId: z.number().int().positive().nullable().optional(),
  clientMutationId: z.string().min(8).max(128).optional(),
});

export const timerSettingsInputSchema = z.object({
  focusDurationMinutes: z.number().int().min(1).max(300),
  shortBreakDurationMinutes: z.number().int().min(1).max(300),
  longBreakDurationMinutes: z.number().int().min(1).max(300),
  sessionsBeforeLongBreak: z.number().int().min(1).max(12),
  soundEnabled: z.boolean(),
  selectedSound: z.string().min(1).max(64).default("chime"),
});

export type StartTimerInput = z.infer<typeof startTimerSchema>;
export type TimerSettingsInput = z.infer<typeof timerSettingsInputSchema>;
