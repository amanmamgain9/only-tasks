import * as taskRepo from "./repository";
import { buildTaskForest, type RecurrenceTargetProgress, type TaskTreeNode } from "./tree";
import { randomUUID } from "node:crypto";
import { generateKeyBetween } from "fractional-indexing";
import {
  CATEGORY_ROOT_DEFINITIONS,
  isTaskCategoryId,
  serializeTaskCategoryAllocations,
  type TaskCategoryId,
} from "@/features/categories/taskCategories";
import {
  getRecurrenceTargetCompletionCountInDatabase,
  materializeRecurringTasksForDateRange,
  recurrenceScheduleFromStoredSeries,
  type RecurrenceScheduleInput,
} from "./recurrence";
import { addDaysToDateKey, formatLocalDateKey, getWeekStartDateKey, normalizeTimeZone } from "../progress/timezone";
import { getScheduledDateRange, type ScheduledDateRange } from "./scheduledDateRange";
import { appendRolloverHistory, dateKeyToDueDate, dueDateToDateKey } from "./rolloverMetadata";
import { sqlite } from "../db/client";

const CATEGORY_ROOT_SYSTEM_TYPE = "category_root";

function convertLocalDateToUTC(localDateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  return new Date(`${localDateStr}T00:00:00.000Z`).toISOString();
}

function getCurrentLocalDateKey(input: { now?: Date; timeZone?: string | null }) {
  return formatLocalDateKey(input.now ?? new Date(), normalizeTimeZone(input.timeZone));
}

function shouldRolloverTask(task: Awaited<ReturnType<typeof taskRepo.findTasksByUserId>>[number]) {
  if (task.isCompleted === 1) return false;
  if (task.deleted === 1 || task.archived === 1 || task.draft === 1) return false;
  if (task.systemType === CATEGORY_ROOT_SYSTEM_TYPE) return false;
  if (task.recurrenceRole) return false;
  return Boolean(task.dueDate);
}

function isQuotaRecurrence(schedule: RecurrenceScheduleInput | null | undefined) {
  return schedule?.mode === "daily_quota" || schedule?.mode === "weekly_quota";
}

function isScheduleActiveOnDate(schedule: RecurrenceScheduleInput, dateKey: string) {
  if (schedule.mode === "none") return false;
  if (dateKey < schedule.startDate) return false;
  if (schedule.endDate && dateKey > schedule.endDate) return false;
  return true;
}

export function getQuotaProgressWindow(input: {
  schedule: Extract<RecurrenceScheduleInput, { mode: "daily_quota" | "weekly_quota" }>;
  todayDate: string;
}) {
  const isDaily = input.schedule.mode === "daily_quota";
  const naturalPeriodStartDate = isDaily ? input.todayDate : getWeekStartDateKey(input.todayDate, 1);
  return {
    period: isDaily ? "day" as const : "week" as const,
    periodStartDate: naturalPeriodStartDate < input.schedule.startDate
      ? input.schedule.startDate
      : naturalPeriodStartDate,
    periodEndDateExclusive: addDaysToDateKey(naturalPeriodStartDate, isDaily ? 1 : 7),
  };
}

function getQuotaTargetProgress(input: {
  userId: number;
  seriesId: number;
  schedule: Extract<RecurrenceScheduleInput, { mode: "daily_quota" | "weekly_quota" }>;
  todayDate: string;
}): RecurrenceTargetProgress {
  const { period, periodStartDate, periodEndDateExclusive } = getQuotaProgressWindow({
    schedule: input.schedule,
    todayDate: input.todayDate,
  });
  const completedCount = getRecurrenceTargetCompletionCountInDatabase({
    db: sqlite,
    userId: input.userId,
    recurrenceSeriesId: input.seriesId,
    startDate: periodStartDate,
    endDateExclusive: periodEndDateExclusive,
  });

  return {
    period,
    targetCount: input.schedule.targetCount,
    completedCount,
    localDate: input.todayDate,
    periodStartDate,
    periodEndDateExclusive,
  };
}

async function getScheduledQuotaTargetTasks(input: {
  userId: number;
  projectId?: number;
  referenceDate: string;
}) {
  const tasks = await taskRepo.findTasksByUserId(input.userId, {
    projectId: input.projectId,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
    excludeRecurrenceOccurrences: true,
  });
  const templates = tasks.filter((task) => task.recurrenceRole === "template");
  const activeSeries = await taskRepo.findActiveRecurrenceSeriesByTemplateIds(
    input.userId,
    templates.map((task) => task.id),
  );
  const seriesByTemplateId = new Map(activeSeries.map((series) => [series.templateTaskId, series]));

  return templates.flatMap((task) => {
    const series = seriesByTemplateId.get(task.id);
    if (!series) return [];
    const recurrenceSchedule = recurrenceScheduleFromStoredSeries({
      rule: series.rule,
      startDate: series.startDate,
      endDate: series.endDate,
    });
    if (!isQuotaRecurrence(recurrenceSchedule) || !isScheduleActiveOnDate(recurrenceSchedule, input.referenceDate)) {
      return [];
    }

    const recurrenceTargetProgress = getQuotaTargetProgress({
      userId: input.userId,
      seriesId: series.id,
      schedule: recurrenceSchedule,
      todayDate: input.referenceDate,
    });

    return [{
      ...task,
      isCompleted: recurrenceTargetProgress.completedCount >= recurrenceTargetProgress.targetCount ? 1 : 0,
      recurrenceSchedule,
      recurrenceTargetProgress,
    }];
  });
}

async function rolloverPastOpenScheduledTasks(input: {
  userId: number;
  projectId?: number;
  todayDate: string;
}) {
  const todayDueDate = dateKeyToDueDate(input.todayDate);
  const now = new Date().toISOString();
  const staleTasks = await taskRepo.findTasksByUserId(input.userId, {
    projectId: input.projectId,
    dueDateEnd: todayDueDate,
    includeCompleted: false,
    includeDeleted: false,
    includeArchived: false,
    draft: 0,
  });

  await Promise.all(
    staleTasks
      .filter(shouldRolloverTask)
      .map((task) => {
        const fromDate = dueDateToDateKey(task.dueDate);
        return taskRepo.updateTask(task.id, {
          dueDate: todayDueDate,
          originalDueDate: task.originalDueDate ?? task.dueDate,
          rolloverHistory: appendRolloverHistory({
            existingHistory: task.rolloverHistory,
            fromDate,
            toDate: input.todayDate,
            at: now,
          }),
          updatedAt: now,
        });
      }),
  );
}

export async function getUserTasks(
  userId: number,
  options: Parameters<typeof taskRepo.findTasksByUserId>[1] = {},
): Promise<TaskTreeNode[]> {
  const existingTasks = await taskRepo.findTasksByUserId(userId, options);
  const templateTaskIds = existingTasks
    .filter((task) => task.recurrenceRole === "template")
    .map((task) => task.id);
  const activeSeries = await taskRepo.findActiveRecurrenceSeriesByTemplateIds(userId, templateTaskIds);
  const seriesByTemplateId = new Map(activeSeries.map((series) => [series.templateTaskId, series]));
  const tasksWithRecurrenceSchedules = existingTasks.map((task) => {
    if (task.recurrenceRole !== "template") return task;
    const series = seriesByTemplateId.get(task.id);
    if (!series) return { ...task, recurrenceSchedule: null };
    return {
      ...task,
      recurrenceSchedule: recurrenceScheduleFromStoredSeries({
        rule: series.rule,
        startDate: series.startDate,
        endDate: series.endDate,
      }),
    };
  });
  return buildTaskForest(tasksWithRecurrenceSchedules);
}

function getRootCategory(task: { categoryAllocations: string | null }): TaskCategoryId | null {
  if (!task.categoryAllocations) return null;
  try {
    const parsed = JSON.parse(task.categoryAllocations) as unknown;
    if (!Array.isArray(parsed)) return null;
    const category = (parsed[0] as { category?: unknown } | undefined)?.category;
    return isTaskCategoryId(category) ? category : null;
  } catch {
    return null;
  }
}

export async function ensureCategoryRootTasks(userId: number, projectId: number) {
  const now = new Date().toISOString();
  const topLevelTasks = await taskRepo.findTasksByUserId(userId, {
    projectId,
    parentTaskId: null,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  });
  const rootsByCategory = new Map<TaskCategoryId, (typeof topLevelTasks)[number]>();

  for (const task of topLevelTasks) {
    if (task.systemType !== CATEGORY_ROOT_SYSTEM_TYPE) continue;
    const category = getRootCategory(task);
    if (category && !rootsByCategory.has(category)) {
      rootsByCategory.set(category, task);
    }
  }

  let lastPosition = topLevelTasks
    .slice()
    .sort((a, b) => (a.position || "").localeCompare(b.position || ""))
    .at(-1)?.position ?? null;

  for (const definition of CATEGORY_ROOT_DEFINITIONS) {
    const existingRoot = rootsByCategory.get(definition.category);
    if (existingRoot) {
      if (existingRoot.title !== definition.title || existingRoot.isCompleted !== 0) {
        await taskRepo.updateTask(existingRoot.id, {
          title: definition.title,
          isCompleted: 0,
          completedAt: null,
          dueDate: null,
          originalDueDate: null,
          rolloverHistory: null,
          systemType: CATEGORY_ROOT_SYSTEM_TYPE,
          categoryAllocations: serializeTaskCategoryAllocations([{ category: definition.category, weight: 100 }]),
          lifestyleTraits: null,
          updatedAt: now,
        });
      }
      continue;
    }

    lastPosition = generateKeyBetween(lastPosition, null);
    await taskRepo.createTask({
      userId,
      title: definition.title,
      description: definition.hint,
      parentTaskId: null,
      projectId,
      path: "/",
      dueDate: null,
      originalDueDate: null,
      rolloverHistory: null,
      isCompleted: 0,
      priority: null,
      estimatedTimeMinutes: null,
      completedAt: null,
      categoryAllocations: serializeTaskCategoryAllocations([{ category: definition.category, weight: 100 }]),
      lifestyleTraits: null,
      systemType: CATEGORY_ROOT_SYSTEM_TYPE,
      clientId: randomUUID(),
      position: lastPosition,
      deleted: 0,
      archived: 0,
      draft: 0,
      chatId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return taskRepo.findTasksByUserId(userId, {
    projectId,
    parentTaskId: null,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  });
}

export async function getProjectTree(userId: number, projectId: number): Promise<TaskTreeNode[]> {
  await ensureCategoryRootTasks(userId, projectId);
  return getUserTasks(userId, {
    projectId,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
    excludeRecurrenceOccurrences: true,
  });
}

export async function getScheduledTasks(
  userId: number,
  options: {
    dateRange: ScheduledDateRange;
    projectId?: number;
    timeZone?: string | null;
    now?: Date;
  },
): Promise<TaskTreeNode[]> {
  const categoryRoots = options.projectId
    ? await ensureCategoryRootTasks(userId, options.projectId)
    : [];
  const todayDate = getCurrentLocalDateKey({
    now: options.now,
    timeZone: options.timeZone,
  });
  await rolloverPastOpenScheduledTasks({
    userId,
    projectId: options.projectId,
    todayDate,
  });

  const { dueDateStart, dueDateEnd, startDate, endDateExclusive } = getScheduledDateRange(
    options.dateRange,
    todayDate,
  );
  await materializeRecurringTasksForDateRange({
    userId,
    projectId: options.projectId,
    startDate,
    endDateExclusive,
  });
  const scheduledTasks = (await taskRepo.findTasksByUserId(userId, {
    dueDateStart,
    dueDateEnd,
    projectId: options.projectId,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  })).filter((task) => task.recurrenceRole !== "template");
  const quotaTargetTasks = await getScheduledQuotaTargetTasks({
    userId,
    projectId: options.projectId,
    referenceDate: options.dateRange === "tomorrow" ? startDate : todayDate,
  });

  const ancestorIds = new Set<number>();
  for (const task of [...scheduledTasks, ...quotaTargetTasks]) {
    const pathIds = task.path
      .split("/")
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    pathIds.forEach((id) => ancestorIds.add(id));
  }

  const descendantPaths = [...scheduledTasks, ...quotaTargetTasks].map((task) => `${task.path}${task.id}/`);
  const [descendants, ancestors] = await Promise.all([
    Promise.all(
      descendantPaths.map((pathPrefix) =>
        taskRepo.findTasksByUserId(userId, {
          projectId: options.projectId,
          includeCompleted: true,
          includeDeleted: false,
          includeArchived: false,
          pathStartsWith: pathPrefix,
        }),
      ),
    ),
    taskRepo.findTasksByIds(userId, Array.from(ancestorIds)),
  ]);

  const taskMap = new Map<number, (typeof scheduledTasks)[number]>();
  categoryRoots.forEach((task) => taskMap.set(task.id, task));
  scheduledTasks.forEach((task) => taskMap.set(task.id, task));
  quotaTargetTasks.forEach((task) => taskMap.set(task.id, task));
  ancestors.forEach((task) => taskMap.set(task.id, task));
  descendants.flat().forEach((task) => taskMap.set(task.id, task));

  return buildTaskForest(Array.from(taskMap.values()));
}

export { convertLocalDateToUTC };
