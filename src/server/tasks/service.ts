import * as taskRepo from "./repository";
import { buildTaskForest, type TaskTreeNode } from "./tree";
import { randomUUID } from "node:crypto";
import { generateKeyBetween } from "fractional-indexing";
import {
  CATEGORY_ROOT_DEFINITIONS,
  isTaskCategoryId,
  serializeTaskCategoryAllocations,
  type TaskCategoryId,
} from "@/features/categories/taskCategories";
import { materializeRecurringTasksForDateRange } from "./recurrence";

const CATEGORY_ROOT_SYSTEM_TYPE = "category_root";

function convertLocalDateToUTC(localDateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
  return new Date(`${localDateStr}T00:00:00.000Z`).toISOString();
}

function calculateUTCDateRange(dateRange: "today" | "tomorrow" | "this-week") {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  switch (dateRange) {
    case "today": {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      return {
        dueDateStart: start.toISOString(),
        dueDateEnd: end.toISOString(),
        startDate: start.toISOString().slice(0, 10),
        endDateExclusive: end.toISOString().slice(0, 10),
      };
    }
    case "tomorrow": {
      const tomorrow = new Date(start);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const end = new Date(tomorrow);
      end.setUTCDate(end.getUTCDate() + 1);
      return {
        dueDateStart: tomorrow.toISOString(),
        dueDateEnd: end.toISOString(),
        startDate: tomorrow.toISOString().slice(0, 10),
        endDateExclusive: end.toISOString().slice(0, 10),
      };
    }
    case "this-week": {
      const dayOfWeek = start.getUTCDay();
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + (7 - dayOfWeek));
      return {
        dueDateStart: start.toISOString(),
        dueDateEnd: end.toISOString(),
        startDate: start.toISOString().slice(0, 10),
        endDateExclusive: end.toISOString().slice(0, 10),
      };
    }
  }
}

export async function getUserTasks(
  userId: number,
  options: Parameters<typeof taskRepo.findTasksByUserId>[1] = {},
): Promise<TaskTreeNode[]> {
  const existingTasks = await taskRepo.findTasksByUserId(userId, options);
  return buildTaskForest(existingTasks);
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
    dateRange: "today" | "tomorrow" | "this-week";
    projectId?: number;
  },
): Promise<TaskTreeNode[]> {
  const categoryRoots = options.projectId
    ? await ensureCategoryRootTasks(userId, options.projectId)
    : [];
  const { dueDateStart, dueDateEnd, startDate, endDateExclusive } = calculateUTCDateRange(options.dateRange);
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

  const ancestorIds = new Set<number>();
  for (const task of scheduledTasks) {
    const pathIds = task.path
      .split("/")
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    pathIds.forEach((id) => ancestorIds.add(id));
  }

  const descendantPaths = scheduledTasks.map((task) => `${task.path}${task.id}/`);
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
  ancestors.forEach((task) => taskMap.set(task.id, task));
  descendants.flat().forEach((task) => taskMap.set(task.id, task));

  return buildTaskForest(Array.from(taskMap.values()));
}

export { convertLocalDateToUTC };
