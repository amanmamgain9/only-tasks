import * as taskRepo from "./repository";
import { buildTaskForest, type TaskTreeNode } from "./tree";

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
      return { dueDateStart: start.toISOString(), dueDateEnd: end.toISOString() };
    }
    case "tomorrow": {
      const tomorrow = new Date(start);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const end = new Date(tomorrow);
      end.setUTCDate(end.getUTCDate() + 1);
      return { dueDateStart: tomorrow.toISOString(), dueDateEnd: end.toISOString() };
    }
    case "this-week": {
      const dayOfWeek = start.getUTCDay();
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + (7 - dayOfWeek));
      return { dueDateStart: start.toISOString(), dueDateEnd: end.toISOString() };
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

export async function getProjectTree(userId: number, projectId: number): Promise<TaskTreeNode[]> {
  return getUserTasks(userId, {
    projectId,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  });
}

export async function getScheduledTasks(
  userId: number,
  options: {
    dateRange: "today" | "tomorrow" | "this-week";
    projectId?: number;
  },
): Promise<TaskTreeNode[]> {
  const { dueDateStart, dueDateEnd } = calculateUTCDateRange(options.dateRange);
  const scheduledTasks = await taskRepo.findTasksByUserId(userId, {
    dueDateStart,
    dueDateEnd,
    projectId: options.projectId,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  });

  if (scheduledTasks.length === 0) return [];

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
  const descendants = await Promise.all(
    descendantPaths.map((pathPrefix) =>
      taskRepo.findTasksByUserId(userId, {
        projectId: options.projectId,
        includeCompleted: true,
        includeDeleted: false,
        includeArchived: false,
        pathStartsWith: pathPrefix,
      }),
    ),
  );

  const ancestors = await taskRepo.findTasksByIds(userId, Array.from(ancestorIds));

  const taskMap = new Map<number, (typeof scheduledTasks)[number]>();
  scheduledTasks.forEach((task) => taskMap.set(task.id, task));
  ancestors.forEach((task) => taskMap.set(task.id, task));
  descendants.flat().forEach((task) => taskMap.set(task.id, task));

  return buildTaskForest(Array.from(taskMap.values()));
}

export { convertLocalDateToUTC };
