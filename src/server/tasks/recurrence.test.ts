import Database from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { initializeDatabase } from "../db/init";
import {
  addRecurrenceTargetCompletionInDatabase,
  getRecurrenceTargetCompletionCountInDatabase,
  materializeRecurringTasksForDateRangeInDatabase,
  recurrenceScheduleFromStoredSeries,
  setTaskRecurrenceInDatabase,
} from "./recurrence";

const NOW = Date.parse("2026-06-01T09:00:00.000Z");
const NOW_ISO = new Date(NOW).toISOString();

function createTestDatabase() {
  const sqlite = new Database(":memory:");
  initializeDatabase(sqlite);
  return sqlite;
}

function insertUser(sqlite: Database.Database) {
  const result = sqlite
    .prepare(
      `INSERT INTO users (email, auth_provider, created_at, updated_at)
       VALUES ('recurrence-test@example.com', 'test', @now, @now)`,
    )
    .run({ now: NOW_ISO });
  return Number(result.lastInsertRowid);
}

function insertProject(sqlite: Database.Database, userId: number) {
  const result = sqlite
    .prepare(
      `INSERT INTO pmwd_projects (user_id, title, type, status, created_at, updated_at)
       VALUES (@userId, 'Workspace', 'main', 'active', @now, @now)`,
    )
    .run({ userId, now: NOW_ISO });
  return Number(result.lastInsertRowid);
}

function insertTask(
  sqlite: Database.Database,
  input: {
    userId: number;
    projectId: number;
    title: string;
    clientId: string;
    parentTaskId: number | null;
    path: string;
    position: string;
    systemType?: string | null;
    recurrenceSeriesId?: number | null;
    recurrenceRole?: string | null;
    recurrenceOccurrenceDate?: string | null;
    recurrenceTemplateTaskId?: number | null;
    recurrenceStatus?: string | null;
    recurrenceIsOverride?: number;
  },
) {
  const result = sqlite
    .prepare(
      `INSERT INTO pmwd_tasks (
        user_id, title, parent_task_id, project_id, path, due_date, is_completed, priority,
        estimated_time_minutes, completed_at, category_allocations, lifestyle_traits, system_type,
        recurrence_series_id, recurrence_role, recurrence_template_task_id, recurrence_occurrence_date,
        recurrence_status, recurrence_is_override, client_id, position, deleted, archived, draft,
        draft_chat_id, created_at, updated_at
      )
      VALUES (
        @userId, @title, @parentTaskId, @projectId, @path, NULL, 0, NULL,
        NULL, NULL, '[{"category":"job","weight":100}]', NULL, @systemType,
        @recurrenceSeriesId, @recurrenceRole, @recurrenceTemplateTaskId, @recurrenceOccurrenceDate,
        @recurrenceStatus, @recurrenceIsOverride, @clientId, @position, 0, 0, 0,
        NULL, @now, @now
      )`,
    )
    .run({
      userId: input.userId,
      title: input.title,
      parentTaskId: input.parentTaskId,
      projectId: input.projectId,
      path: input.path,
      systemType: input.systemType ?? null,
      recurrenceSeriesId: input.recurrenceSeriesId ?? null,
      recurrenceRole: input.recurrenceRole ?? null,
      recurrenceTemplateTaskId: input.recurrenceTemplateTaskId ?? null,
      recurrenceOccurrenceDate: input.recurrenceOccurrenceDate ?? null,
      recurrenceStatus: input.recurrenceStatus ?? null,
      recurrenceIsOverride: input.recurrenceIsOverride ?? 0,
      clientId: input.clientId,
      position: input.position,
      now: NOW_ISO,
    });
  return Number(result.lastInsertRowid);
}

function seedTemplateTree(sqlite: Database.Database) {
  const userId = insertUser(sqlite);
  const projectId = insertProject(sqlite, userId);
  const rootId = insertTask(sqlite, {
    userId,
    projectId,
    title: "Main Work",
    clientId: "root-job",
    parentTaskId: null,
    path: "/",
    position: "a0",
    systemType: "category_root",
  });
  const taskId = insertTask(sqlite, {
    userId,
    projectId,
    title: "Review pipeline",
    clientId: "task-review",
    parentTaskId: rootId,
    path: `/${rootId}/`,
    position: "a1",
  });
  const childId = insertTask(sqlite, {
    userId,
    projectId,
    title: "Check open PRs",
    clientId: "task-review-child",
    parentTaskId: taskId,
    path: `/${rootId}/${taskId}/`,
    position: "a2",
  });

  return { userId, projectId, rootId, taskId, childId };
}

function setDailyRecurrence(sqlite: Database.Database, userId: number, startDate = "2026-06-01") {
  return setTaskRecurrenceInDatabase({
    db: sqlite,
    userId,
    clientId: "task-review",
    recurrence: { mode: "daily", startDate },
    timestamp: NOW,
  });
}

function materialize(sqlite: Database.Database, userId: number, projectId: number, startDate: string, endDateExclusive: string) {
  materializeRecurringTasksForDateRangeInDatabase({
    db: sqlite,
    userId,
    projectId,
    startDate,
    endDateExclusive,
    now: NOW_ISO,
  });
}

function getOccurrence(sqlite: Database.Database, templateTaskId: number, occurrenceDate: string) {
  return sqlite
    .prepare(
      `SELECT *
       FROM pmwd_tasks
       WHERE recurrence_template_task_id = ?
         AND recurrence_occurrence_date = ?
       LIMIT 1`,
    )
    .get(templateTaskId, occurrenceDate) as any;
}

describe("task recurrence", () => {
  test("converts stored active series rules back into schedule inputs for the tree", () => {
    expect(recurrenceScheduleFromStoredSeries({
      rule: JSON.stringify({ frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] }),
      startDate: "2026-06-01",
      endDate: null,
    })).toEqual({
      mode: "weekdays",
      startDate: "2026-06-01",
      endDate: null,
    });

    expect(recurrenceScheduleFromStoredSeries({
      rule: JSON.stringify({ frequency: "weekly", interval: 2, weekdays: [5] }),
      startDate: "2026-06-05",
      endDate: "2026-08-01",
    })).toEqual({
      mode: "weekly",
      startDate: "2026-06-05",
      endDate: "2026-08-01",
      interval: 2,
      weekdays: [5],
    });

    expect(recurrenceScheduleFromStoredSeries({
      rule: JSON.stringify({ frequency: "weekly_quota", targetCount: 3, comparator: "at_least" }),
      startDate: "2026-06-03",
      endDate: null,
    })).toEqual({
      mode: "weekly_quota",
      startDate: "2026-06-03",
      endDate: null,
      targetCount: 3,
      comparator: "at_least",
    });

    expect(recurrenceScheduleFromStoredSeries({
      rule: JSON.stringify({ frequency: "daily_quota", targetCount: 8, comparator: "at_least" }),
      startDate: "2026-06-03",
      endDate: null,
    })).toEqual({
      mode: "daily_quota",
      startDate: "2026-06-03",
      endDate: null,
      targetCount: 8,
      comparator: "at_least",
    });
  });

  test("converts a task subtree into a template and materializes a dated occurrence subtree", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId, taskId, childId } = seedTemplateTree(sqlite);

    setDailyRecurrence(sqlite, userId);
    materialize(sqlite, userId, projectId, "2026-06-01", "2026-06-02");

    const template = sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(taskId) as any;
    const childTemplate = sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(childId) as any;
    const occurrence = getOccurrence(sqlite, taskId, "2026-06-01");
    const childOccurrence = getOccurrence(sqlite, childId, "2026-06-01");

    expect(template.recurrence_role).toBe("template");
    expect(template.due_date).toBeNull();
    expect(childTemplate.recurrence_role).toBe("template");
    expect(occurrence.recurrence_role).toBe("occurrence_root");
    expect(occurrence.due_date).toBe("2026-06-01T00:00:00.000Z");
    expect(childOccurrence.recurrence_role).toBe("occurrence_child");
    expect(childOccurrence.parent_task_id).toBe(occurrence.id);
    expect(childOccurrence.due_date).toBeNull();
  });

  test("materializes weekdays only once even when the same range is requested repeatedly", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId } = seedTemplateTree(sqlite);

    setTaskRecurrenceInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      recurrence: { mode: "weekdays", startDate: "2026-06-05" },
      timestamp: NOW,
    });
    materialize(sqlite, userId, projectId, "2026-06-05", "2026-06-09");
    materialize(sqlite, userId, projectId, "2026-06-05", "2026-06-09");

    const dates = sqlite
      .prepare(
        `SELECT recurrence_occurrence_date AS occurrenceDate, COUNT(*) AS count
         FROM pmwd_tasks
         WHERE recurrence_role = 'occurrence_root'
         GROUP BY recurrence_occurrence_date
         ORDER BY recurrence_occurrence_date`,
      )
      .all() as Array<{ occurrenceDate: string; count: number }>;

    expect(dates).toEqual([
      { occurrenceDate: "2026-06-05", count: 1 },
      { occurrenceDate: "2026-06-08", count: 1 },
    ]);
  });

  test("stores weekly quota recurrence without creating fake dated occurrences", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId, taskId } = seedTemplateTree(sqlite);

    setTaskRecurrenceInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      recurrence: {
        mode: "weekly_quota",
        startDate: "2026-06-03",
        targetCount: 3,
        comparator: "at_least",
      },
      timestamp: NOW,
    });
    materialize(sqlite, userId, projectId, "2026-06-03", "2026-06-10");

    const template = sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(taskId) as any;
    const series = sqlite.prepare("SELECT * FROM pmwd_task_recurrence_series WHERE template_task_id = ?").get(taskId) as any;
    const occurrences = sqlite
      .prepare("SELECT COUNT(*) AS count FROM pmwd_tasks WHERE recurrence_role = 'occurrence_root'")
      .get() as { count: number };

    expect(template.recurrence_role).toBe("template");
    expect(JSON.parse(series.rule)).toEqual({
      frequency: "weekly_quota",
      targetCount: 3,
      comparator: "at_least",
    });
    expect(occurrences.count).toBe(0);
  });

  test("removes outstanding generated occurrences when converting a dated repeat to a quota target", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId } = seedTemplateTree(sqlite);

    const daily = setDailyRecurrence(sqlite, userId, "2026-06-01");
    materialize(sqlite, userId, projectId, "2026-06-01", "2026-06-04");

    setTaskRecurrenceInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      recurrence: {
        mode: "weekly_quota",
        startDate: "2026-06-03",
        targetCount: 3,
        comparator: "at_least",
      },
      timestamp: NOW + 1000,
    });

    const remainingOldOccurrences = sqlite
      .prepare(
        `SELECT COUNT(*) AS count
         FROM pmwd_tasks
         WHERE recurrence_series_id = ?
           AND recurrence_role IN ('occurrence_root', 'occurrence_child')
           AND deleted = 0`,
      )
      .get(daily.seriesId) as { count: number };

    expect(remainingOldOccurrences.count).toBe(0);
  });

  test("records quota target completions idempotently for a local date window", () => {
    const sqlite = createTestDatabase();
    const { userId } = seedTemplateTree(sqlite);

    const { seriesId } = setTaskRecurrenceInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      recurrence: {
        mode: "weekly_quota",
        startDate: "2026-06-03",
        targetCount: 3,
        comparator: "at_least",
      },
      timestamp: NOW,
    });

    addRecurrenceTargetCompletionInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      localDate: "2026-06-03",
      clientEventId: "event-1",
      timestamp: NOW,
    });
    addRecurrenceTargetCompletionInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      localDate: "2026-06-03",
      clientEventId: "event-1",
      timestamp: NOW,
    });

    expect(getRecurrenceTargetCompletionCountInDatabase({
      db: sqlite,
      userId,
      recurrenceSeriesId: seriesId!,
      startDate: "2026-06-01",
      endDateExclusive: "2026-06-08",
    })).toBe(1);
  });

  test("rotates quota series so old completion events do not count after rule changes", () => {
    const sqlite = createTestDatabase();
    const { userId } = seedTemplateTree(sqlite);

    const first = setTaskRecurrenceInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      recurrence: {
        mode: "weekly_quota",
        startDate: "2026-06-03",
        targetCount: 3,
        comparator: "at_least",
      },
      timestamp: NOW,
    });
    addRecurrenceTargetCompletionInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      localDate: "2026-06-03",
      clientEventId: "event-before-change",
      timestamp: NOW,
    });

    const second = setTaskRecurrenceInDatabase({
      db: sqlite,
      userId,
      clientId: "task-review",
      recurrence: {
        mode: "weekly_quota",
        startDate: "2026-06-03",
        targetCount: 5,
        comparator: "at_least",
      },
      timestamp: NOW + 1000,
    });

    expect(second.seriesId).not.toBe(first.seriesId);
    expect(getRecurrenceTargetCompletionCountInDatabase({
      db: sqlite,
      userId,
      recurrenceSeriesId: second.seriesId!,
      startDate: "2026-06-01",
      endDateExclusive: "2026-06-08",
    })).toBe(0);
  });

  test("keeps a subtask added to one occurrence out of the next generated occurrence", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId, taskId } = seedTemplateTree(sqlite);

    const { seriesId } = setDailyRecurrence(sqlite, userId);
    materialize(sqlite, userId, projectId, "2026-06-01", "2026-06-02");
    const todayOccurrence = getOccurrence(sqlite, taskId, "2026-06-01");
    insertTask(sqlite, {
      userId,
      projectId,
      title: "One-off follow-up",
      clientId: "one-off-follow-up",
      parentTaskId: todayOccurrence.id,
      path: `${todayOccurrence.path}${todayOccurrence.id}/`,
      position: "a3",
      recurrenceSeriesId: seriesId,
      recurrenceRole: "occurrence_child",
      recurrenceOccurrenceDate: "2026-06-01",
      recurrenceStatus: "scheduled",
      recurrenceIsOverride: 1,
    });

    materialize(sqlite, userId, projectId, "2026-06-02", "2026-06-03");
    const tomorrowOccurrence = getOccurrence(sqlite, taskId, "2026-06-02");
    const leakedChildren = sqlite
      .prepare("SELECT COUNT(*) AS count FROM pmwd_tasks WHERE parent_task_id = ? AND title = 'One-off follow-up'")
      .get(tomorrowOccurrence.id) as { count: number };

    expect(leakedChildren.count).toBe(0);
  });

  test("adds a new template child to future generated occurrences", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId, taskId } = seedTemplateTree(sqlite);

    const { seriesId } = setDailyRecurrence(sqlite, userId);
    materialize(sqlite, userId, projectId, "2026-06-01", "2026-06-02");
    const template = sqlite.prepare("SELECT * FROM pmwd_tasks WHERE id = ?").get(taskId) as any;
    const newTemplateChildId = insertTask(sqlite, {
      userId,
      projectId,
      title: "New recurring checklist item",
      clientId: "new-template-child",
      parentTaskId: template.id,
      path: `${template.path}${template.id}/`,
      position: "a3",
      recurrenceSeriesId: seriesId,
      recurrenceRole: "template",
    });

    materialize(sqlite, userId, projectId, "2026-06-02", "2026-06-03");
    const generatedChild = getOccurrence(sqlite, newTemplateChildId, "2026-06-02");

    expect(generatedChild.title).toBe("New recurring checklist item");
    expect(generatedChild.recurrence_role).toBe("occurrence_child");
  });

  test("keeps completion scoped to one generated occurrence without completing the template or future work", () => {
    const sqlite = createTestDatabase();
    const { userId, projectId, taskId } = seedTemplateTree(sqlite);

    setDailyRecurrence(sqlite, userId);
    materialize(sqlite, userId, projectId, "2026-06-01", "2026-06-03");
    const todayOccurrence = getOccurrence(sqlite, taskId, "2026-06-01");
    sqlite
      .prepare("UPDATE pmwd_tasks SET is_completed = 1, completed_at = ? WHERE id = ?")
      .run("2026-06-01T12:00:00.000Z", todayOccurrence.id);

    const template = sqlite.prepare("SELECT is_completed AS isCompleted FROM pmwd_tasks WHERE id = ?").get(taskId) as any;
    const tomorrowOccurrence = getOccurrence(sqlite, taskId, "2026-06-02");

    expect(template.isCompleted).toBe(0);
    expect(tomorrowOccurrence.is_completed).toBe(0);
    expect((sqlite.prepare("SELECT is_completed AS isCompleted FROM pmwd_tasks WHERE id = ?").get(todayOccurrence.id) as any).isCompleted).toBe(1);
  });
});
