import type { Task } from "../db/schema/tasks";
import type { RecurrenceScheduleInput } from "./recurrence";

export type RecurrenceTargetProgress = {
  period: "day" | "week";
  targetCount: number;
  completedCount: number;
  localDate: string;
  periodStartDate: string;
  periodEndDateExclusive: string;
};

export interface TaskTreeNode extends Omit<Task, "isCompleted" | "deleted" | "archived"> {
  subtasks?: TaskTreeNode[];
  isCompleted: boolean;
  deleted: boolean;
  archived: boolean;
  recurrenceSchedule?: RecurrenceScheduleInput | null;
  recurrenceTargetProgress?: RecurrenceTargetProgress | null;
}

export function buildTaskForest(existingTasks: Task[]): TaskTreeNode[] {
  const taskMap = new Map<number, TaskTreeNode>();
  const activeTasks = existingTasks.filter((task) => !task.deleted);

  activeTasks.forEach((task) => {
    taskMap.set(task.id, {
      ...task,
      isCompleted: Boolean(task.isCompleted),
      deleted: Boolean(task.deleted),
      archived: Boolean(task.archived),
      subtasks: [],
    });
  });

  const roots: TaskTreeNode[] = [];

  taskMap.forEach((node) => {
    if (node.parentTaskId) {
      const parent = taskMap.get(node.parentTaskId);
      parent?.subtasks?.push(node);
    } else {
      roots.push(node);
    }

    node.subtasks?.sort((a, b) => (a.position || "").localeCompare(b.position || ""));
  });

  roots.sort((a, b) => (a.position || "").localeCompare(b.position || ""));
  return roots;
}
