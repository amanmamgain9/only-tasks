import { sqlite } from "@/server/db/client";
import {
  TASK_CATEGORY_DEFINITIONS,
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  type TaskCategoryId,
  type ProjectCategorySeed,
} from "@/features/categories/taskCategories";
import {
  isDailyTargetScheduledForDate,
  listDailyTargetsForUser,
} from "@/server/dailyTargets/service";
import { addDaysToDateKey } from "@/server/progress/timezone";
import { materializeRecurringTasksForDateRangeInDatabase } from "@/server/tasks/recurrence";
import type {
  SaveTimeReviewInput,
  TimeReviewEntryInput,
  TimeReviewPlannedTask,
  TimeReviewSettings,
  TimeReviewSummary,
  TimeReviewTarget,
  TimeReviewTargetEntryInput,
  TimeReviewTask,
} from "@/features/timeReview/types";
import {
  getReviewPhase,
  getReviewWindow,
  getWorkdayWindow,
  normalizeTimeOfDay,
} from "./workday";
import { calculateReviewedMinutesForSummary } from "./reviewedMinutes";

type SettingsRow = {
  workdayRolloverTime: string;
  middayReviewEnabled: number;
  middayReviewTime: string | null;
};

type CompletedTaskRow = {
  taskId: number;
  title: string;
  projectId: number | null;
  projectTitle: string | null;
  projectType: string | null;
  completedAt: string;
  estimatedTimeMinutes: number | null;
  categoryAllocations: string | null;
  lifestyleTraits: string | null;
  durationMinutes: number | null;
  startMinute: number | null;
  endMinute: number | null;
  reviewStatus: "draft" | "confirmed" | null;
};

type PlannedTaskRow = {
  taskId: number;
  title: string;
  projectId: number | null;
  projectTitle: string | null;
  projectType: string | null;
  dueDate: string;
  originalDueDate: string | null;
  rolloverHistory: string | null;
  isCompleted: number;
  completedAt: string | null;
  estimatedTimeMinutes: number | null;
  categoryAllocations: string | null;
  lifestyleTraits: string | null;
};

type TargetReviewRow = {
  targetId: number | null;
  category: string;
  targetKind: "time" | "count";
  targetMinutes: number | null;
  targetCount: number | null;
  actualMinutes: number | null;
  actualCount: number | null;
  reviewStatus: "confirmed" | "draft";
};

const getSettingsQuery = sqlite.prepare(`
  SELECT
    workday_rollover_time AS workdayRolloverTime,
    midday_review_enabled AS middayReviewEnabled,
    midday_review_time AS middayReviewTime
  FROM pmwd_workday_settings
  WHERE user_id = ?
`);

const upsertSettingsQuery = sqlite.prepare(`
  INSERT INTO pmwd_workday_settings (
    user_id, workday_rollover_time, midday_review_enabled, midday_review_time, created_at, updated_at
  )
  VALUES (@userId, @workdayRolloverTime, @middayReviewEnabled, @middayReviewTime, @now, @now)
  ON CONFLICT(user_id) DO UPDATE SET
    workday_rollover_time = excluded.workday_rollover_time,
    midday_review_enabled = excluded.midday_review_enabled,
    midday_review_time = excluded.midday_review_time,
    updated_at = excluded.updated_at
`);

const completedTasksQuery = sqlite.prepare(`
  SELECT
    task.id AS taskId,
    task.title AS title,
    task.project_id AS projectId,
    project.title AS projectTitle,
    project.type AS projectType,
    COALESCE(task.completed_at, task.updated_at) AS completedAt,
    task.estimated_time_minutes AS estimatedTimeMinutes,
    task.category_allocations AS categoryAllocations,
    task.lifestyle_traits AS lifestyleTraits,
    review.duration_minutes AS durationMinutes,
    review.start_minute AS startMinute,
    review.end_minute AS endMinute,
    review.review_status AS reviewStatus
  FROM pmwd_tasks task
  LEFT JOIN pmwd_projects project ON project.id = task.project_id
  LEFT JOIN pmwd_task_time_reviews review
    ON review.user_id = task.user_id
    AND review.task_id = task.id
    AND review.workday_date = @workdayDate
  WHERE task.user_id = @userId
    AND task.is_completed = 1
    AND task.deleted = 0
    AND task.archived = 0
    AND task.draft = 0
    AND COALESCE(task.completed_at, task.updated_at) >= @startUtc
    AND COALESCE(task.completed_at, task.updated_at) < @endUtc
  ORDER BY COALESCE(task.completed_at, task.updated_at) ASC, task.position ASC
`);

const plannedTasksQuery = sqlite.prepare(`
  SELECT
    task.id AS taskId,
    task.title AS title,
    task.project_id AS projectId,
    project.title AS projectTitle,
    project.type AS projectType,
    task.due_date AS dueDate,
    task.original_due_date AS originalDueDate,
    task.rollover_history AS rolloverHistory,
    task.is_completed AS isCompleted,
    task.completed_at AS completedAt,
    task.estimated_time_minutes AS estimatedTimeMinutes,
    task.category_allocations AS categoryAllocations,
    task.lifestyle_traits AS lifestyleTraits
  FROM pmwd_tasks task
  LEFT JOIN pmwd_projects project ON project.id = task.project_id
  WHERE task.user_id = @userId
    AND task.due_date IS NOT NULL
    AND task.deleted = 0
    AND task.archived = 0
    AND task.draft = 0
    AND (
      substr(task.due_date, 1, 10) = @workdayDate
      OR substr(COALESCE(task.original_due_date, task.due_date), 1, 10) = @workdayDate
      OR task.rollover_history LIKE '%"from":"' || @workdayDate || '"%'
      OR task.rollover_history LIKE '%"to":"' || @workdayDate || '"%'
    )
  ORDER BY task.is_completed ASC, task.priority ASC, task.position ASC
`);

const getTaskForUserQuery = sqlite.prepare(`
  SELECT id, project_id AS projectId
  FROM pmwd_tasks
  WHERE id = @taskId
    AND user_id = @userId
    AND deleted = 0
    AND archived = 0
    AND draft = 0
  LIMIT 1
`);

const upsertReviewQuery = sqlite.prepare(`
  INSERT INTO pmwd_task_time_reviews (
    user_id, task_id, project_id, workday_date, duration_minutes, start_minute, end_minute,
    source, review_status, review_window, notes, created_at, updated_at
  )
  VALUES (
    @userId, @taskId, @projectId, @workdayDate, @durationMinutes, @startMinute, @endMinute,
    'manual_review', 'confirmed', @reviewWindow, NULL, @now, @now
  )
  ON CONFLICT(user_id, task_id, workday_date) DO UPDATE SET
    project_id = excluded.project_id,
    duration_minutes = excluded.duration_minutes,
    start_minute = excluded.start_minute,
    end_minute = excluded.end_minute,
    review_status = excluded.review_status,
    review_window = excluded.review_window,
    updated_at = excluded.updated_at
`);

const deleteReviewQuery = sqlite.prepare(`
  DELETE FROM pmwd_task_time_reviews
  WHERE user_id = @userId
    AND task_id = @taskId
    AND workday_date = @workdayDate
`);

const targetReviewsQuery = sqlite.prepare(`
  SELECT
    target_id AS targetId,
    category,
    target_kind AS targetKind,
    target_minutes AS targetMinutes,
    target_count AS targetCount,
    actual_minutes AS actualMinutes,
    actual_count AS actualCount,
    review_status AS reviewStatus
  FROM pmwd_daily_target_reviews
  WHERE user_id = @userId
    AND workday_date = @workdayDate
`);

const upsertTargetReviewQuery = sqlite.prepare(`
  INSERT INTO pmwd_daily_target_reviews (
    user_id, target_id, category, workday_date, target_kind, target_minutes, target_count,
    actual_minutes, actual_count, review_status, review_window, created_at, updated_at
  )
  VALUES (
    @userId, @targetId, @category, @workdayDate, @targetKind, @targetMinutes, @targetCount,
    @actualMinutes, @actualCount, 'confirmed', @reviewWindow, @now, @now
  )
  ON CONFLICT(user_id, category, workday_date) DO UPDATE SET
    target_id = excluded.target_id,
    target_kind = excluded.target_kind,
    target_minutes = excluded.target_minutes,
    target_count = excluded.target_count,
    actual_minutes = excluded.actual_minutes,
    actual_count = excluded.actual_count,
    review_status = excluded.review_status,
    review_window = excluded.review_window,
    updated_at = excluded.updated_at
`);

function toSettings(row: SettingsRow | undefined): TimeReviewSettings {
  return {
    workdayRolloverTime: normalizeTimeOfDay(row?.workdayRolloverTime, "00:00"),
    middayReviewEnabled: row ? row.middayReviewEnabled === 1 : true,
    middayReviewTime: row?.middayReviewTime ? normalizeTimeOfDay(row.middayReviewTime, "12:00") : "12:00",
  };
}

function normalizeEntry(entry: TimeReviewEntryInput) {
  const durationMinutes = Math.max(0, Math.min(24 * 60, Math.round(Number(entry.durationMinutes) || 0)));
  const startMinute = entry.startMinute === null || entry.startMinute === undefined
    ? null
    : Math.max(0, Math.min(24 * 60, Math.round(Number(entry.startMinute) || 0)));
  const endMinute = entry.endMinute === null || entry.endMinute === undefined
    ? null
    : Math.max(0, Math.min(24 * 60, Math.round(Number(entry.endMinute) || 0)));

  if (durationMinutes === 0) {
    return { ...entry, durationMinutes, startMinute: null, endMinute: null };
  }

  if (startMinute !== null && endMinute !== null && endMinute > startMinute) {
    return {
      ...entry,
      durationMinutes: Math.max(1, endMinute - startMinute),
      startMinute,
      endMinute,
    };
  }

  return {
    ...entry,
    durationMinutes,
    startMinute,
    endMinute: startMinute === null ? null : Math.min(24 * 60, startMinute + durationMinutes),
  };
}

function getProjectType(value: string | null): ProjectCategorySeed | null {
  if (value === "main" || value === "side_project" || value === "chore") return value;
  return null;
}

function percent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(999, Math.round((done / total) * 100));
}

function taskHasCategory(
  task: Pick<TimeReviewTask | TimeReviewPlannedTask, "categoryAllocations">,
  category: TaskCategoryId,
) {
  return task.categoryAllocations.some((allocation) => allocation.category === category);
}

function buildCategoryTaskCounts(tasks: TimeReviewTask[], plannedTasks: TimeReviewPlannedTask[]) {
  const completed = new Map<TaskCategoryId, number>();
  const planned = new Map<TaskCategoryId, number>();
  const completedPlanned = new Map<TaskCategoryId, number>();

  for (const definition of TASK_CATEGORY_DEFINITIONS) {
    completed.set(definition.id, 0);
    planned.set(definition.id, 0);
    completedPlanned.set(definition.id, 0);
  }

  for (const task of tasks) {
    for (const definition of TASK_CATEGORY_DEFINITIONS) {
      if (taskHasCategory(task, definition.id)) {
        completed.set(definition.id, (completed.get(definition.id) ?? 0) + 1);
      }
    }
  }

  for (const task of plannedTasks) {
    for (const definition of TASK_CATEGORY_DEFINITIONS) {
      if (!taskHasCategory(task, definition.id)) continue;
      planned.set(definition.id, (planned.get(definition.id) ?? 0) + 1);
      if (task.isCompleted) {
        completedPlanned.set(definition.id, (completedPlanned.get(definition.id) ?? 0) + 1);
      }
    }
  }

  return { completed, planned, completedPlanned };
}

function buildCategoryTimeRollup(tasks: TimeReviewTask[]) {
  const minutes = new Map<TaskCategoryId, number>();
  for (const definition of TASK_CATEGORY_DEFINITIONS) {
    minutes.set(definition.id, 0);
  }

  for (const task of tasks) {
    if (task.durationMinutes <= 0) continue;
    for (const allocation of task.categoryAllocations) {
      minutes.set(
        allocation.category,
        (minutes.get(allocation.category) ?? 0) + task.durationMinutes * (allocation.weight / 100),
      );
    }
  }

  return minutes;
}

function normalizeTargetEntry(entry: TimeReviewTargetEntryInput) {
  return {
    category: entry.category,
    actualMinutes: entry.actualMinutes === null || entry.actualMinutes === undefined
      ? null
      : Math.max(0, Math.min(24 * 60, Math.round(Number(entry.actualMinutes) || 0))),
    actualCount: entry.actualCount === null || entry.actualCount === undefined
      ? null
      : Math.max(0, Math.min(99, Math.round(Number(entry.actualCount) || 0))),
  };
}

function isKnownCategory(value: string): value is TaskCategoryId {
  return TASK_CATEGORY_DEFINITIONS.some((definition) => definition.id === value);
}

function buildTargets(input: {
  userId: number;
  workdayDate: string;
  tasks: TimeReviewTask[];
  plannedTasks: TimeReviewPlannedTask[];
}): TimeReviewTarget[] {
  const definitions = listDailyTargetsForUser(input.userId);
  const reviewRows = targetReviewsQuery.all({
    userId: input.userId,
    workdayDate: input.workdayDate,
  }) as TargetReviewRow[];
  const reviewByCategory = new Map(
    reviewRows
      .filter((row): row is TargetReviewRow & { category: TaskCategoryId } => isKnownCategory(row.category))
      .map((row) => [row.category, row]),
  );
  const counts = buildCategoryTaskCounts(input.tasks, input.plannedTasks);
  const taskTimeRollup = buildCategoryTimeRollup(input.tasks);

  return definitions.map((definition) => {
    const review = reviewByCategory.get(definition.category);
    const kind = review?.targetKind ?? definition.kind;
    const targetMinutes = kind === "time"
      ? review?.targetMinutes ?? definition.targetMinutes
      : null;
    const targetCount = kind === "count"
      ? review?.targetCount ?? definition.targetCount
      : null;
    const appliesToday = review
      ? true
      : definition.enabled && isDailyTargetScheduledForDate(definition.schedule, input.workdayDate);
    const completedTasks = counts.completed.get(definition.category) ?? 0;
    const plannedTasks = counts.planned.get(definition.category) ?? 0;
    const completedPlannedTasks = counts.completedPlanned.get(definition.category) ?? 0;
    const rolledUpMinutes = Math.round(taskTimeRollup.get(definition.category) ?? 0);
    const reviewedMinutes = review?.actualMinutes ?? rolledUpMinutes;
    const reviewedCount = review?.actualCount ?? completedTasks;
    const reviewSource = review
      ? "target_review"
      : kind === "time" && rolledUpMinutes > 0
        ? "task_time_rollup"
        : kind === "count" && completedTasks > 0
          ? "completed_tasks"
          : "none";
    const progressValue = kind === "time"
      ? percent(reviewedMinutes, targetMinutes ?? 0)
      : percent(reviewedCount, targetCount ?? 0);

    return {
      ...definition,
      kind,
      targetMinutes,
      targetCount,
      appliesToday,
      completedTasks,
      plannedTasks,
      completedPlannedTasks,
      reviewedMinutes,
      reviewedCount,
      reviewStatus: review ? "confirmed" : "draft",
      reviewSource,
      progressPercent: progressValue,
      met: appliesToday && progressValue >= 100,
    };
  });
}

function buildSummary(input: {
  userId: number;
  settings: TimeReviewSettings;
  timeZone?: string | null;
  now?: Date;
}): TimeReviewSummary {
  const window = getWorkdayWindow({
    now: input.now,
    timeZone: input.timeZone,
    rolloverTime: input.settings.workdayRolloverTime,
  });

  materializeRecurringTasksForDateRangeInDatabase({
    db: sqlite,
    userId: input.userId,
    startDate: window.workdayDate,
    endDateExclusive: addDaysToDateKey(window.workdayDate, 1),
  });

  const rows = completedTasksQuery.all({
    userId: input.userId,
    workdayDate: window.workdayDate,
    startUtc: window.startUtc,
    endUtc: window.endUtc,
  }) as CompletedTaskRow[];

  const plannedRows = plannedTasksQuery.all({
    userId: input.userId,
    workdayDate: window.workdayDate,
  }) as PlannedTaskRow[];

  const tasks: TimeReviewTask[] = rows.map((row) => ({
    taskId: row.taskId,
    title: row.title,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    completedAt: row.completedAt,
    estimatedTimeMinutes: row.estimatedTimeMinutes,
    categoryAllocations: normalizeTaskCategoryAllocations(row.categoryAllocations, {
      projectType: getProjectType(row.projectType),
    }),
    lifestyleTraits: normalizeLifestyleTraitAllocations(row.lifestyleTraits),
    durationMinutes: row.durationMinutes ?? 0,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    reviewStatus: row.reviewStatus ?? "draft",
  }));

  const plannedTasks: TimeReviewPlannedTask[] = plannedRows.map((row) => ({
    taskId: row.taskId,
    title: row.title,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    dueDate: row.dueDate,
    originalDueDate: row.originalDueDate,
    rolloverHistory: row.rolloverHistory,
    isCompleted: row.isCompleted === 1,
    completedAt: row.completedAt,
    estimatedTimeMinutes: row.estimatedTimeMinutes,
    categoryAllocations: normalizeTaskCategoryAllocations(row.categoryAllocations, {
      projectType: getProjectType(row.projectType),
    }),
    lifestyleTraits: normalizeLifestyleTraitAllocations(row.lifestyleTraits),
  }));

  const reviewedTasks = tasks.filter((task) => task.durationMinutes > 0).length;
  const taskReviewedMinutes = tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const reviewWindow = getReviewWindow(window.minutesUntilRollover);
  const targets = buildTargets({
    userId: input.userId,
    workdayDate: window.workdayDate,
    tasks,
    plannedTasks,
  });
  const confirmedTargetReviews = targets.filter((target) => target.reviewStatus === "confirmed");
  const { reviewedMinutes, targetReviewedMinutes } = calculateReviewedMinutesForSummary({ tasks, targets });
  const activeReviewTargets = targets.filter((target) => target.enabled && target.appliesToday);
  const targetReviewComplete = activeReviewTargets.length > 0
    && activeReviewTargets.every((target) => target.reviewStatus === "confirmed");
  const taskReviewComplete = activeReviewTargets.length === 0 && tasks.length > 0 && reviewedTasks >= tasks.length;
  const phaseCompletedUnits = activeReviewTargets.length > 0 ? activeReviewTargets.length : tasks.length;
  const phaseReviewedUnits = targetReviewComplete || taskReviewComplete
    ? phaseCompletedUnits
    : activeReviewTargets.length > 0
      ? activeReviewTargets.filter((target) => target.reviewStatus === "confirmed").length
      : reviewedTasks;

  return {
    workdayDate: window.workdayDate,
    timeZone: window.timeZone,
    generatedAt: (input.now ?? new Date()).toISOString(),
    localNowMinutes: window.localNowMinutes,
    minutesUntilRollover: window.minutesUntilRollover,
    reviewWindow,
    phase: getReviewPhase({
      completedTasks: phaseCompletedUnits,
      reviewedTasks: phaseReviewedUnits,
      localNowMinutes: window.localNowMinutes,
      minutesUntilRollover: window.minutesUntilRollover,
      middayReviewEnabled: input.settings.middayReviewEnabled,
      middayReviewTime: input.settings.middayReviewTime,
    }),
    settings: input.settings,
    targets,
    plannedTasks,
    tasks,
    totals: {
      completedTasks: tasks.length,
      reviewedTasks,
      reviewedMinutes,
      reviewedTargets: confirmedTargetReviews.length,
      targetReviewedMinutes,
    },
  };
}

export function getTimeReviewSettings(userId: number): TimeReviewSettings {
  return toSettings(getSettingsQuery.get(userId) as SettingsRow | undefined);
}

export function getTodayTimeReviewForUser(
  userId: number,
  input: { timeZone?: string | null; now?: Date } = {},
) {
  return buildSummary({
    userId,
    settings: getTimeReviewSettings(userId),
    timeZone: input.timeZone,
    now: input.now,
  });
}

export function saveTodayTimeReviewForUser(
  userId: number,
  input: SaveTimeReviewInput & { now?: Date },
) {
  const existingSettings = getTimeReviewSettings(userId);
  const nextSettings: TimeReviewSettings = {
    workdayRolloverTime: normalizeTimeOfDay(input.settings?.workdayRolloverTime, existingSettings.workdayRolloverTime),
    middayReviewEnabled: input.settings?.middayReviewEnabled ?? existingSettings.middayReviewEnabled,
    middayReviewTime: input.settings?.middayReviewTime === null
      ? null
      : normalizeTimeOfDay(input.settings?.middayReviewTime, existingSettings.middayReviewTime ?? "12:00"),
  };

  const window = getWorkdayWindow({
    now: input.now,
    timeZone: input.timeZone,
    rolloverTime: nextSettings.workdayRolloverTime,
  });
  const now = (input.now ?? new Date()).toISOString();
  const reviewWindow = getReviewWindow(window.minutesUntilRollover);

  const save = sqlite.transaction(() => {
    upsertSettingsQuery.run({
      userId,
      workdayRolloverTime: nextSettings.workdayRolloverTime,
      middayReviewEnabled: nextSettings.middayReviewEnabled ? 1 : 0,
      middayReviewTime: nextSettings.middayReviewTime,
      now,
    });

    for (const rawEntry of input.entries) {
      const entry = normalizeEntry(rawEntry);
      const task = getTaskForUserQuery.get({ userId, taskId: entry.taskId }) as { id: number; projectId: number | null } | undefined;
      if (!task) continue;

      if (entry.durationMinutes <= 0) {
        deleteReviewQuery.run({ userId, taskId: entry.taskId, workdayDate: window.workdayDate });
        continue;
      }

      upsertReviewQuery.run({
        userId,
        taskId: entry.taskId,
        projectId: task.projectId,
        workdayDate: window.workdayDate,
        durationMinutes: entry.durationMinutes,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
        reviewWindow,
        now,
      });
    }

    const targetsByCategory = new Map(
      listDailyTargetsForUser(userId)
        .filter((target) => target.enabled)
        .map((target) => [target.category, target]),
    );

    for (const rawEntry of input.targetEntries ?? []) {
      const entry = normalizeTargetEntry(rawEntry);
      const target = targetsByCategory.get(entry.category);
      if (!target || !isDailyTargetScheduledForDate(target.schedule, window.workdayDate)) continue;

      upsertTargetReviewQuery.run({
        userId,
        targetId: target.id,
        category: target.category,
        workdayDate: window.workdayDate,
        targetKind: target.kind,
        targetMinutes: target.kind === "time" ? target.targetMinutes : null,
        targetCount: target.kind === "count" ? target.targetCount : null,
        actualMinutes: target.kind === "time" ? entry.actualMinutes ?? 0 : null,
        actualCount: target.kind === "count" ? entry.actualCount ?? 0 : null,
        reviewWindow,
        now,
      });
    }
  });

  save();

  return buildSummary({
    userId,
    settings: nextSettings,
    timeZone: input.timeZone,
    now: input.now,
  });
}
