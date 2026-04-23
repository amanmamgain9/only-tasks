import * as taskRepo from "./repository";
import * as taskService from "./service";
import * as positioning from "./positioning";
import type { Operation, OperationBatch, SubtreeNode } from "./contracts";

function convertLocalDateToUTC(localDateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  return new Date(`${localDateStr}T00:00:00.000Z`).toISOString();
}

async function handleUpdateTitle(operation: Extract<Operation, { type: "UPDATE_TITLE" }>, userId: number) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task || task.userId !== userId) throw new Error(`Task not found for clientId: ${operation.clientId}`);

  await taskRepo.updateTask(task.id, {
    title: operation.title,
    updatedAt: new Date(operation.timestamp).toISOString(),
  });
}

async function handleToggleComplete(
  operation: Extract<Operation, { type: "TOGGLE_COMPLETE" }>,
  userId: number,
) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task || task.userId !== userId) throw new Error(`Task not found for clientId: ${operation.clientId}`);

  await taskRepo.updateTask(task.id, {
    isCompleted: operation.isCompleted ? 1 : 0,
    updatedAt: new Date(operation.timestamp).toISOString(),
  });
}

async function handleUpdateMetadata(
  operation: Extract<Operation, { type: "UPDATE_METADATA" }>,
  userId: number,
) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task || task.userId !== userId) throw new Error(`Task not found for clientId: ${operation.clientId}`);

  const updates: any = {
    updatedAt: new Date(operation.timestamp).toISOString(),
  };

  if (operation.estimatedTimeMinutes !== undefined) updates.estimatedTimeMinutes = operation.estimatedTimeMinutes;
  if (operation.priority !== undefined) updates.priority = operation.priority;
  if (operation.description !== undefined) updates.description = operation.description;
  if (operation.dueDate !== undefined) {
    updates.dueDate = operation.dueDate === null ? null : convertLocalDateToUTC(operation.dueDate);
  }

  await taskRepo.updateTask(task.id, updates);
}

async function handleDeleteTask(operation: Extract<Operation, { type: "DELETE_TASK" }>, userId: number) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task) return;
  if (task.userId !== userId) throw new Error(`Access denied for task: ${operation.clientId}`);
  await taskRepo.softDeleteTask(task.id);
}

async function handleCreateTask(
  operation: Extract<Operation, { type: "CREATE_TASK" }>,
  userId: number,
  projectId: number,
) {
  let parentTaskId: number | null = null;
  if (operation.parentClientId) {
    const parentTask = await taskRepo.getTaskByClientId(operation.parentClientId);
    if (!parentTask || parentTask.userId !== userId) {
      throw new Error(`Parent task not found for clientId: ${operation.parentClientId}`);
    }
    parentTaskId = parentTask.id;
  }

  const parentTask = parentTaskId ? await taskRepo.findTaskById(parentTaskId) : null;
  const path = parentTask ? `${parentTask.path}${parentTask.id}/` : "/";
  const timestampISO = new Date(operation.timestamp).toISOString();

  await taskRepo.createTask({
    userId,
    parentTaskId,
    projectId,
    path,
    clientId: operation.clientId,
    title: "",
    position: operation.position,
    isCompleted: 0,
    dueDate: operation.metadata?.dueDate ? convertLocalDateToUTC(operation.metadata.dueDate) : null,
    estimatedTimeMinutes: operation.metadata?.estimatedTimeMinutes ?? null,
    priority: operation.metadata?.priority ?? null,
    deleted: 0,
    archived: 0,
    draft: 0,
    chatId: null,
    createdAt: timestampISO,
    updatedAt: timestampISO,
  });
}

async function createSubtree(
  node: SubtreeNode,
  userId: number,
  projectId: number,
  parentTaskId: number | null,
  timestamp: number,
): Promise<number> {
  const parentTask = parentTaskId ? await taskRepo.findTaskById(parentTaskId) : null;
  const path = parentTask ? `${parentTask.path}${parentTask.id}/` : "/";
  const timestampISO = new Date(timestamp).toISOString();

  let position = node.position;
  if (!position) {
    const siblings = await taskRepo.findSiblingTasks(userId, parentTaskId);
    position = positioning.calculateNewTaskPosition(siblings);
  }

  const createdTask = await taskRepo.createTask({
    userId,
    parentTaskId,
    projectId,
    path,
    clientId: node.clientId,
    title: node.title,
    description: node.description ?? null,
    isCompleted: node.isCompleted ? 1 : 0,
    estimatedTimeMinutes: node.estimatedTimeMinutes ?? null,
    dueDate: node.dueDate ? convertLocalDateToUTC(node.dueDate) : null,
    position,
    deleted: 0,
    archived: 0,
    draft: 0,
    chatId: null,
    createdAt: timestampISO,
    updatedAt: timestampISO,
  });

  if (node.subtasks?.length) {
    for (const subtask of node.subtasks) {
      await createSubtree(subtask, userId, projectId, createdTask.id, timestamp);
    }
  }

  return createdTask.id;
}

async function handleImportTasks(
  operation: Extract<Operation, { type: "IMPORT_TASKS" }>,
  userId: number,
  projectId: number,
) {
  let parentTaskId: number | null = null;
  if (operation.parentClientId) {
    const parentTask = await taskRepo.getTaskByClientId(operation.parentClientId);
    if (!parentTask || parentTask.userId !== userId) {
      throw new Error(`Parent task not found for clientId: ${operation.parentClientId}`);
    }
    parentTaskId = parentTask.id;
  }

  await createSubtree(operation.subtree, userId, projectId, parentTaskId, operation.timestamp);
}

export async function applyOperationBatch(batch: OperationBatch, userId: number) {
  for (const operation of batch.operations) {
    switch (operation.type) {
      case "UPDATE_TITLE":
        await handleUpdateTitle(operation, userId);
        break;
      case "TOGGLE_COMPLETE":
        await handleToggleComplete(operation, userId);
        break;
      case "UPDATE_METADATA":
        await handleUpdateMetadata(operation, userId);
        break;
      case "DELETE_TASK":
        await handleDeleteTask(operation, userId);
        break;
      case "CREATE_TASK":
        await handleCreateTask(operation, userId, batch.projectId);
        break;
      case "IMPORT_TASKS":
        await handleImportTasks(operation, userId, batch.projectId);
        break;
      default:
        break;
    }
  }

  return taskService.getUserTasks(userId, {
    projectId: batch.projectId,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  });
}
