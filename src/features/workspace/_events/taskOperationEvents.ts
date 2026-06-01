"use client";

export const TASK_OPERATIONS_SAVED_EVENT = "planmyworkday:task-operations-saved";

export type TaskOperationsSavedDetail = {
  projectId: number;
  chatId?: number;
  operationTypes: string[];
};

export function emitTaskOperationsSaved(detail: TaskOperationsSavedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TaskOperationsSavedDetail>(TASK_OPERATIONS_SAVED_EVENT, { detail }));
}
