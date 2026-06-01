import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlite } from "../db/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateKeySchema = z.string().regex(DATE_KEY_RE);
const weekdaySchema = z.number().int().min(0).max(6);

export const recurrenceScheduleSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({
    mode: z.literal("daily"),
    startDate: dateKeySchema,
    endDate: dateKeySchema.nullable().optional(),
    interval: z.number().int().min(1).max(365).optional(),
  }),
  z.object({
    mode: z.literal("weekdays"),
    startDate: dateKeySchema,
    endDate: dateKeySchema.nullable().optional(),
  }),
  z.object({
    mode: z.literal("weekly"),
    startDate: dateKeySchema,
    endDate: dateKeySchema.nullable().optional(),
    interval: z.number().int().min(1).max(52).optional(),
    weekdays: z.array(weekdaySchema).min(1).max(7).optional(),
  }),
]);

export type RecurrenceScheduleInput = z.infer<typeof recurrenceScheduleSchema>;

export type NormalizedRecurrenceRule =
  | { frequency: "daily"; interval: number }
  | { frequency: "weekly"; interval: number; weekdays: number[] };

export type RecurrenceSeriesRow = {
  id: number;
  user_id: number;
  template_task_id: number;
  status: "active" | "inactive";
  rule: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type TaskRow = {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  parent_task_id: number | null;
  project_id: number | null;
  path: string;
  due_date: string | null;
  original_due_date: string | null;
  rollover_history: string | null;
  is_completed: number;
  priority: number | null;
  estimated_time_minutes: number | null;
  completed_at: string | null;
  category_allocations: string | null;
  lifestyle_traits: string | null;
  system_type: string | null;
  recurrence_series_id: number | null;
  recurrence_role: "template" | "occurrence_root" | "occurrence_child" | null;
  recurrence_template_task_id: number | null;
  recurrence_occurrence_date: string | null;
  recurrence_status: "scheduled" | "skipped" | null;
  recurrence_is_override: number;
  client_id: string | null;
  position: string;
  deleted: number;
  archived: number;
  draft: number;
  draft_chat_id: number | null;
  created_at: string;
  updated_at: string;
};

type ChildRecurrenceMetadata = {
  recurrenceSeriesId?: number | null;
  recurrenceRole?: "template" | "occurrence_root" | "occurrence_child" | null;
  recurrenceTemplateTaskId?: number | null;
  recurrenceOccurrenceDate?: string | null;
  recurrenceStatus?: "scheduled" | "skipped" | null;
  recurrenceIsOverride?: number;
};

function assertDateKey(value: string) {
  if (!DATE_KEY_RE.test(value)) throw new Error(`Invalid recurrence date: ${value}`);
}

function dateKeyToTime(value: string) {
  assertDateKey(value);
  return Date.parse(`${value}T00:00:00.000Z`);
}

function dateKeyToDueDate(value: string) {
  assertDateKey(value);
  return `${value}T00:00:00.000Z`;
}

function addDaysToDateKey(value: string, days: number) {
  const next = new Date(dateKeyToTime(value) + days * DAY_MS);
  return next.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string) {
  return Math.floor((dateKeyToTime(end) - dateKeyToTime(start)) / DAY_MS);
}

function getUtcWeekday(value: string) {
  return new Date(dateKeyToTime(value)).getUTCDay();
}

function uniqueWeekdays(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function normalizeRecurrenceSchedule(input: RecurrenceScheduleInput): {
  startDate: string | null;
  endDate: string | null;
  rule: NormalizedRecurrenceRule | null;
} {
  const schedule = recurrenceScheduleSchema.parse(input);
  if (schedule.mode === "none") return { startDate: null, endDate: null, rule: null };

  if (schedule.endDate && schedule.endDate < schedule.startDate) {
    throw new Error("Recurrence end date cannot be before the start date.");
  }

  if (schedule.mode === "daily") {
    return {
      startDate: schedule.startDate,
      endDate: schedule.endDate ?? null,
      rule: { frequency: "daily", interval: schedule.interval ?? 1 },
    };
  }

  if (schedule.mode === "weekdays") {
    return {
      startDate: schedule.startDate,
      endDate: schedule.endDate ?? null,
      rule: { frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] },
    };
  }

  return {
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? null,
    rule: {
      frequency: "weekly",
      interval: schedule.interval ?? 1,
      weekdays: uniqueWeekdays(schedule.weekdays?.length ? schedule.weekdays : [getUtcWeekday(schedule.startDate)]),
    },
  };
}

function parseStoredRule(value: string): NormalizedRecurrenceRule {
  const parsed = JSON.parse(value) as unknown;
  const ruleSchema = z.discriminatedUnion("frequency", [
    z.object({ frequency: z.literal("daily"), interval: z.number().int().min(1).max(365) }),
    z.object({
      frequency: z.literal("weekly"),
      interval: z.number().int().min(1).max(52),
      weekdays: z.array(weekdaySchema).min(1).max(7).transform(uniqueWeekdays),
    }),
  ]);
  return ruleSchema.parse(parsed);
}

function stringifyRule(rule: NormalizedRecurrenceRule) {
  return JSON.stringify(rule);
}

function shouldOccurOnDate(rule: NormalizedRecurrenceRule, startDate: string, date: string) {
  const daysSinceStart = diffDays(startDate, date);
  if (daysSinceStart < 0) return false;

  if (rule.frequency === "daily") {
    return daysSinceStart % rule.interval === 0;
  }

  const weeksSinceStart = Math.floor(daysSinceStart / 7);
  return weeksSinceStart % rule.interval === 0 && rule.weekdays.includes(getUtcWeekday(date));
}

export function enumerateOccurrenceDates(input: {
  rule: NormalizedRecurrenceRule;
  startDate: string;
  endDate?: string | null;
  rangeStartDate: string;
  rangeEndDateExclusive: string;
}) {
  assertDateKey(input.startDate);
  assertDateKey(input.rangeStartDate);
  assertDateKey(input.rangeEndDateExclusive);
  if (input.endDate) assertDateKey(input.endDate);
  if (input.rangeStartDate >= input.rangeEndDateExclusive) return [];

  const dates: string[] = [];
  let cursor = input.rangeStartDate > input.startDate ? input.rangeStartDate : input.startDate;

  while (cursor < input.rangeEndDateExclusive) {
    if (input.endDate && cursor > input.endDate) break;
    if (shouldOccurOnDate(input.rule, input.startDate, cursor)) dates.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }

  return dates;
}

function getTaskByClientIdInDatabase(db: Database.Database, userId: number, clientId: string) {
  return db
    .prepare("SELECT * FROM pmwd_tasks WHERE user_id = ? AND client_id = ? AND deleted = 0 LIMIT 1")
    .get(userId, clientId) as TaskRow | undefined;
}

function getTaskByIdInDatabase(db: Database.Database, userId: number, taskId: number) {
  return db
    .prepare("SELECT * FROM pmwd_tasks WHERE user_id = ? AND id = ? LIMIT 1")
    .get(userId, taskId) as TaskRow | undefined;
}

function findActiveSeriesForTemplate(db: Database.Database, userId: number, templateTaskId: number) {
  return db
    .prepare(
      `SELECT * FROM pmwd_task_recurrence_series
       WHERE user_id = ? AND template_task_id = ? AND status = 'active'
       LIMIT 1`,
    )
    .get(userId, templateTaskId) as RecurrenceSeriesRow | undefined;
}

function upsertActiveSeries(input: {
  db: Database.Database;
  userId: number;
  templateTaskId: number;
  rule: NormalizedRecurrenceRule;
  startDate: string;
  endDate: string | null;
  now: string;
}) {
  const existing = findActiveSeriesForTemplate(input.db, input.userId, input.templateTaskId);
  if (existing) {
    input.db
      .prepare(
        `UPDATE pmwd_task_recurrence_series
         SET rule = @rule, start_date = @startDate, end_date = @endDate, updated_at = @now
         WHERE id = @id`,
      )
      .run({
        id: existing.id,
        rule: stringifyRule(input.rule),
        startDate: input.startDate,
        endDate: input.endDate,
        now: input.now,
      });
    return existing.id;
  }

  const result = input.db
    .prepare(
      `INSERT INTO pmwd_task_recurrence_series
       (user_id, template_task_id, status, rule, start_date, end_date, created_at, updated_at)
       VALUES (@userId, @templateTaskId, 'active', @rule, @startDate, @endDate, @now, @now)`,
    )
    .run({
      userId: input.userId,
      templateTaskId: input.templateTaskId,
      rule: stringifyRule(input.rule),
      startDate: input.startDate,
      endDate: input.endDate,
      now: input.now,
    });

  return Number(result.lastInsertRowid);
}

function markSubtreeAsTemplate(input: {
  db: Database.Database;
  userId: number;
  task: TaskRow;
  seriesId: number;
  now: string;
}) {
  const pathPrefix = `${input.task.path}${input.task.id}/%`;
  input.db
    .prepare(
      `UPDATE pmwd_tasks
       SET recurrence_series_id = @seriesId,
           recurrence_role = 'template',
           recurrence_template_task_id = NULL,
           recurrence_occurrence_date = NULL,
           recurrence_status = NULL,
           recurrence_is_override = 0,
           due_date = NULL,
           original_due_date = NULL,
           rollover_history = NULL,
           is_completed = 0,
           completed_at = NULL,
           updated_at = @now
       WHERE user_id = @userId
         AND deleted = 0
         AND archived = 0
         AND (id = @taskId OR path LIKE @pathPrefix)`,
    )
    .run({
      seriesId: input.seriesId,
      now: input.now,
      userId: input.userId,
      taskId: input.task.id,
      pathPrefix,
    });
}

function deactivateTemplateSeries(input: {
  db: Database.Database;
  userId: number;
  task: TaskRow;
  now: string;
}) {
  const series = findActiveSeriesForTemplate(input.db, input.userId, input.task.id);
  if (series) {
    input.db
      .prepare(
        `UPDATE pmwd_task_recurrence_series
         SET status = 'inactive', updated_at = @now
         WHERE id = @id`,
      )
      .run({ id: series.id, now: input.now });
  }

  const pathPrefix = `${input.task.path}${input.task.id}/%`;
  input.db
    .prepare(
      `UPDATE pmwd_tasks
       SET recurrence_series_id = NULL,
           recurrence_role = NULL,
           recurrence_template_task_id = NULL,
           recurrence_occurrence_date = NULL,
           recurrence_status = NULL,
           recurrence_is_override = 0,
           updated_at = @now
       WHERE user_id = @userId
         AND deleted = 0
         AND archived = 0
         AND (id = @taskId OR path LIKE @pathPrefix)
         AND recurrence_role = 'template'`,
    )
    .run({
      now: input.now,
      userId: input.userId,
      taskId: input.task.id,
      pathPrefix,
    });
}

export function setTaskRecurrenceInDatabase(input: {
  db: Database.Database;
  userId: number;
  clientId: string;
  recurrence: RecurrenceScheduleInput;
  timestamp: number;
}) {
  return input.db.transaction(() => {
    const now = new Date(input.timestamp).toISOString();
    const task = getTaskByClientIdInDatabase(input.db, input.userId, input.clientId);
    if (!task) throw new Error(`Task not found for clientId: ${input.clientId}`);
    if (task.system_type === "category_root") throw new Error("Category roots cannot recur.");
    if (task.recurrence_role === "occurrence_root" || task.recurrence_role === "occurrence_child") {
      throw new Error("Edit the recurring template, not a generated occurrence.");
    }

    const normalized = normalizeRecurrenceSchedule(input.recurrence);
    if (!normalized.rule || !normalized.startDate) {
      deactivateTemplateSeries({ db: input.db, userId: input.userId, task, now });
      return { seriesId: null, templateTaskId: task.id };
    }

    const seriesId = upsertActiveSeries({
      db: input.db,
      userId: input.userId,
      templateTaskId: task.id,
      rule: normalized.rule,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      now,
    });
    markSubtreeAsTemplate({ db: input.db, userId: input.userId, task, seriesId, now });

    return { seriesId, templateTaskId: task.id };
  })();
}

export async function setTaskRecurrence(input: {
  userId: number;
  clientId: string;
  recurrence: RecurrenceScheduleInput;
  timestamp: number;
}) {
  return setTaskRecurrenceInDatabase({ db: sqlite, ...input });
}

function findOccurrenceForTemplateDate(input: {
  db: Database.Database;
  userId: number;
  templateTaskId: number;
  occurrenceDate: string;
}) {
  return input.db
    .prepare(
      `SELECT * FROM pmwd_tasks
       WHERE user_id = @userId
         AND recurrence_template_task_id = @templateTaskId
         AND recurrence_occurrence_date = @occurrenceDate
       LIMIT 1`,
    )
    .get({
      userId: input.userId,
      templateTaskId: input.templateTaskId,
      occurrenceDate: input.occurrenceDate,
    }) as TaskRow | undefined;
}

function getTemplateChildren(input: {
  db: Database.Database;
  userId: number;
  templateTaskId: number;
}) {
  return input.db
    .prepare(
      `SELECT * FROM pmwd_tasks
       WHERE user_id = @userId
         AND parent_task_id = @templateTaskId
         AND recurrence_role = 'template'
         AND deleted = 0
         AND archived = 0
       ORDER BY position ASC, created_at DESC`,
    )
    .all({
      userId: input.userId,
      templateTaskId: input.templateTaskId,
    }) as TaskRow[];
}

function syncOccurrenceFromTemplate(input: {
  db: Database.Database;
  occurrence: TaskRow;
  template: TaskRow;
  parentTaskId: number | null;
  path: string;
  role: "occurrence_root" | "occurrence_child";
  occurrenceDate: string;
  now: string;
}) {
  if (input.occurrence.deleted === 1 || input.occurrence.recurrence_is_override === 1) {
    return input.occurrence;
  }

  input.db
    .prepare(
      `UPDATE pmwd_tasks
       SET title = @title,
           description = @description,
           parent_task_id = @parentTaskId,
           project_id = @projectId,
           path = @path,
           due_date = @dueDate,
           original_due_date = @dueDate,
           rollover_history = NULL,
           priority = @priority,
           estimated_time_minutes = @estimatedTimeMinutes,
           category_allocations = @categoryAllocations,
           lifestyle_traits = @lifestyleTraits,
           system_type = @systemType,
           recurrence_series_id = @recurrenceSeriesId,
           recurrence_role = @role,
           recurrence_status = 'scheduled',
           position = @position,
           draft = @draft,
           draft_chat_id = @chatId,
           updated_at = @now
       WHERE id = @id`,
    )
    .run({
      id: input.occurrence.id,
      title: input.template.title,
      description: input.template.description,
      parentTaskId: input.parentTaskId,
      projectId: input.template.project_id,
      path: input.path,
      dueDate: input.role === "occurrence_root" ? dateKeyToDueDate(input.occurrenceDate) : null,
      priority: input.template.priority,
      estimatedTimeMinutes: input.template.estimated_time_minutes,
      categoryAllocations: input.template.category_allocations,
      lifestyleTraits: input.template.lifestyle_traits,
      systemType: input.template.system_type,
      recurrenceSeriesId: input.template.recurrence_series_id,
      role: input.role,
      position: input.template.position,
      draft: input.template.draft,
      chatId: input.template.draft_chat_id,
      now: input.now,
    });

  return getTaskByIdInDatabase(input.db, input.template.user_id, input.occurrence.id) ?? input.occurrence;
}

function createOccurrenceFromTemplate(input: {
  db: Database.Database;
  template: TaskRow;
  parentTaskId: number | null;
  path: string;
  role: "occurrence_root" | "occurrence_child";
  occurrenceDate: string;
  now: string;
}) {
  const result = input.db
    .prepare(
      `INSERT INTO pmwd_tasks (
        user_id,
        title,
        description,
        parent_task_id,
        project_id,
        path,
        due_date,
        original_due_date,
        rollover_history,
        is_completed,
        priority,
        estimated_time_minutes,
        completed_at,
        category_allocations,
        lifestyle_traits,
        system_type,
        recurrence_series_id,
        recurrence_role,
        recurrence_template_task_id,
        recurrence_occurrence_date,
        recurrence_status,
        recurrence_is_override,
        client_id,
        position,
        deleted,
        archived,
        draft,
        draft_chat_id,
        created_at,
        updated_at
      )
      VALUES (
        @userId,
        @title,
        @description,
        @parentTaskId,
        @projectId,
        @path,
        @dueDate,
        @dueDate,
        NULL,
        0,
        @priority,
        @estimatedTimeMinutes,
        NULL,
        @categoryAllocations,
        @lifestyleTraits,
        @systemType,
        @recurrenceSeriesId,
        @role,
        @templateTaskId,
        @occurrenceDate,
        'scheduled',
        0,
        @clientId,
        @position,
        0,
        @archived,
        @draft,
        @chatId,
        @now,
        @now
      )`,
    )
    .run({
      userId: input.template.user_id,
      title: input.template.title,
      description: input.template.description,
      parentTaskId: input.parentTaskId,
      projectId: input.template.project_id,
      path: input.path,
      dueDate: input.role === "occurrence_root" ? dateKeyToDueDate(input.occurrenceDate) : null,
      priority: input.template.priority,
      estimatedTimeMinutes: input.template.estimated_time_minutes,
      categoryAllocations: input.template.category_allocations,
      lifestyleTraits: input.template.lifestyle_traits,
      systemType: input.template.system_type,
      recurrenceSeriesId: input.template.recurrence_series_id,
      role: input.role,
      templateTaskId: input.template.id,
      occurrenceDate: input.occurrenceDate,
      clientId: randomUUID(),
      position: input.template.position,
      archived: input.template.archived,
      draft: input.template.draft,
      chatId: input.template.draft_chat_id,
      now: input.now,
    });

  const inserted = getTaskByIdInDatabase(input.db, input.template.user_id, Number(result.lastInsertRowid));
  if (!inserted) throw new Error("Failed to create recurring occurrence.");
  return inserted;
}

function ensureOccurrenceForTemplate(input: {
  db: Database.Database;
  template: TaskRow;
  occurrenceDate: string;
  parentOccurrence: TaskRow | null;
  role: "occurrence_root" | "occurrence_child";
  now: string;
}) {
  const parentTaskId = input.parentOccurrence ? input.parentOccurrence.id : input.template.parent_task_id;
  const path = input.parentOccurrence ? `${input.parentOccurrence.path}${input.parentOccurrence.id}/` : input.template.path;
  const existing = findOccurrenceForTemplateDate({
    db: input.db,
    userId: input.template.user_id,
    templateTaskId: input.template.id,
    occurrenceDate: input.occurrenceDate,
  });

  if (existing) {
    return syncOccurrenceFromTemplate({
      db: input.db,
      occurrence: existing,
      template: input.template,
      parentTaskId,
      path,
      role: input.role,
      occurrenceDate: input.occurrenceDate,
      now: input.now,
    });
  }

  return createOccurrenceFromTemplate({
    db: input.db,
    template: input.template,
    parentTaskId,
    path,
    role: input.role,
    occurrenceDate: input.occurrenceDate,
    now: input.now,
  });
}

function materializeTemplateNode(input: {
  db: Database.Database;
  template: TaskRow;
  occurrenceDate: string;
  parentOccurrence: TaskRow | null;
  role: "occurrence_root" | "occurrence_child";
  now: string;
}) {
  const occurrence = ensureOccurrenceForTemplate(input);
  const children = getTemplateChildren({
    db: input.db,
    userId: input.template.user_id,
    templateTaskId: input.template.id,
  });

  for (const childTemplate of children) {
    materializeTemplateNode({
      db: input.db,
      template: childTemplate,
      occurrenceDate: input.occurrenceDate,
      parentOccurrence: occurrence,
      role: "occurrence_child",
      now: input.now,
    });
  }

  return occurrence;
}

function getActiveSeriesForRange(input: {
  db: Database.Database;
  userId: number;
  projectId?: number;
  startDate: string;
  endDateExclusive: string;
}) {
  return input.db
    .prepare(
      `SELECT series.*
       FROM pmwd_task_recurrence_series series
       INNER JOIN pmwd_tasks template ON template.id = series.template_task_id
       WHERE series.user_id = @userId
         AND series.status = 'active'
         AND series.start_date < @endDateExclusive
         AND (series.end_date IS NULL OR series.end_date >= @startDate)
         AND template.deleted = 0
         AND template.archived = 0
         AND template.recurrence_role = 'template'
         AND (@projectId IS NULL OR template.project_id = @projectId)
       ORDER BY series.id ASC`,
    )
    .all({
      userId: input.userId,
      projectId: input.projectId ?? null,
      startDate: input.startDate,
      endDateExclusive: input.endDateExclusive,
    }) as RecurrenceSeriesRow[];
}

export function materializeRecurringTasksForDateRangeInDatabase(input: {
  db: Database.Database;
  userId: number;
  projectId?: number;
  startDate: string;
  endDateExclusive: string;
  now?: string;
}) {
  return input.db.transaction(() => {
    assertDateKey(input.startDate);
    assertDateKey(input.endDateExclusive);
    const now = input.now ?? new Date().toISOString();
    const seriesRows = getActiveSeriesForRange(input);

    for (const series of seriesRows) {
      const template = getTaskByIdInDatabase(input.db, input.userId, series.template_task_id);
      if (!template || template.deleted === 1 || template.archived === 1 || template.recurrence_role !== "template") {
        continue;
      }

      const rule = parseStoredRule(series.rule);
      const dates = enumerateOccurrenceDates({
        rule,
        startDate: series.start_date,
        endDate: series.end_date,
        rangeStartDate: input.startDate,
        rangeEndDateExclusive: input.endDateExclusive,
      });

      for (const occurrenceDate of dates) {
        materializeTemplateNode({
          db: input.db,
          template,
          occurrenceDate,
          parentOccurrence: null,
          role: "occurrence_root",
          now,
        });
      }
    }
  })();
}

export async function materializeRecurringTasksForDateRange(input: {
  userId: number;
  projectId?: number;
  startDate: string;
  endDateExclusive: string;
  now?: string;
}) {
  return materializeRecurringTasksForDateRangeInDatabase({ db: sqlite, ...input });
}

export function getRecurrenceMetadataForNewChild(parentTask: {
  recurrenceSeriesId?: number | null;
  recurrenceRole?: string | null;
  recurrenceOccurrenceDate?: string | null;
} | null): ChildRecurrenceMetadata {
  if (!parentTask?.recurrenceRole) return {};

  if (parentTask.recurrenceRole === "template") {
    return {
      recurrenceSeriesId: parentTask.recurrenceSeriesId ?? null,
      recurrenceRole: "template",
      recurrenceTemplateTaskId: null,
      recurrenceOccurrenceDate: null,
      recurrenceStatus: null,
      recurrenceIsOverride: 0,
    };
  }

  if (parentTask.recurrenceRole === "occurrence_root" || parentTask.recurrenceRole === "occurrence_child") {
    return {
      recurrenceSeriesId: parentTask.recurrenceSeriesId ?? null,
      recurrenceRole: "occurrence_child",
      recurrenceTemplateTaskId: null,
      recurrenceOccurrenceDate: parentTask.recurrenceOccurrenceDate ?? null,
      recurrenceStatus: "scheduled",
      recurrenceIsOverride: 1,
    };
  }

  return {};
}

export function isOccurrenceRole(role: string | null | undefined) {
  return role === "occurrence_root" || role === "occurrence_child";
}
