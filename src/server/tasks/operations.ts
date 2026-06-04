import * as taskRepo from "./repository";
import * as taskService from "./service";
import * as positioning from "./positioning";
import * as projectRepo from "../projects/repository";
import type { Operation, OperationBatch, SubtreeNode } from "./contracts";
import {
  addRecurrenceTargetCompletion,
  getRecurrenceMetadataForNewChild,
  isOccurrenceRole,
  setTaskRecurrence,
} from "./recurrence";
import {
  getDefaultTaskCategoryAllocations,
  serializeLifestyleTraitAllocations,
  serializeTaskCategoryAllocations,
  type ProjectCategorySeed,
} from "../../features/categories/taskCategories";

function convertLocalDateToUTC(localDateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  return new Date(`${localDateStr}T00:00:00.000Z`).toISOString();
}

async function getProjectType(projectId: number, userId: number): Promise<ProjectCategorySeed> {
  const project = await projectRepo.findProjectById(projectId);
  if (!project || project.userId !== userId) {
    throw new Error(`Project not found: ${projectId}`);
  }
  return project.type;
}

function serializeCategoryAllocationsForWrite(value: unknown, projectType: ProjectCategorySeed) {
  return serializeTaskCategoryAllocations(value ?? getDefaultTaskCategoryAllocations(projectType));
}

function serializeLifestyleTraitsForWrite(value: unknown) {
  if (Array.isArray(value) && value.length === 0) return null;
  if (value === undefined || value === null) return null;
  return serializeLifestyleTraitAllocations(value);
}

function assertUserEditableTask(task: Awaited<ReturnType<typeof taskRepo.getTaskByClientId>>) {
  if (task?.systemType === "category_root") {
    throw new Error("Category roots are system managed.");
  }
}

function assertTaskCanBeCompleted(task: Awaited<ReturnType<typeof taskRepo.getTaskByClientId>>) {
  assertUserEditableTask(task);
  if (task?.recurrenceRole === "template") {
    throw new Error("Complete the generated occurrence, not the recurring template.");
  }
}

function getOccurrenceOverrideUpdate(task: Awaited<ReturnType<typeof taskRepo.getTaskByClientId>>) {
  return isOccurrenceRole(task?.recurrenceRole) ? { recurrenceIsOverride: 1 } : {};
}

async function handleUpdateTitle(operation: Extract<Operation, { type: "UPDATE_TITLE" }>, userId: number) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task || task.userId !== userId) throw new Error(`Task not found for clientId: ${operation.clientId}`);
  assertUserEditableTask(task);

  await taskRepo.updateTask(task.id, {
    title: operation.title,
    ...getOccurrenceOverrideUpdate(task),
    updatedAt: new Date(operation.timestamp).toISOString(),
  });
}

async function handleToggleComplete(
  operation: Extract<Operation, { type: "TOGGLE_COMPLETE" }>,
  userId: number,
) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task || task.userId !== userId) throw new Error(`Task not found for clientId: ${operation.clientId}`);
  assertTaskCanBeCompleted(task);

  const timestampISO = new Date(operation.timestamp).toISOString();
  await taskRepo.updateTask(task.id, {
    isCompleted: operation.isCompleted ? 1 : 0,
    completedAt: operation.isCompleted ? timestampISO : null,
    ...getOccurrenceOverrideUpdate(task),
    updatedAt: timestampISO,
  });
}

async function handleAddRecurrenceTargetCompletion(
  operation: Extract<Operation, { type: "ADD_RECURRENCE_TARGET_COMPLETION" }>,
  userId: number,
) {
  await addRecurrenceTargetCompletion({
    userId,
    clientId: operation.clientId,
    localDate: operation.localDate,
    quantity: operation.quantity,
    clientEventId: operation.clientEventId,
    timestamp: operation.timestamp,
  });
}

async function handleUpdateMetadata(
  operation: Extract<Operation, { type: "UPDATE_METADATA" }>,
  userId: number,
) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task || task.userId !== userId) throw new Error(`Task not found for clientId: ${operation.clientId}`);
  assertUserEditableTask(task);

  const updates: any = {
    ...getOccurrenceOverrideUpdate(task),
    updatedAt: new Date(operation.timestamp).toISOString(),
  };

  if (operation.estimatedTimeMinutes !== undefined) updates.estimatedTimeMinutes = operation.estimatedTimeMinutes;
  if (operation.priority !== undefined) updates.priority = operation.priority;
  if (operation.description !== undefined) updates.description = operation.description;
  if (operation.categoryAllocations !== undefined) {
    const projectType = task.projectId ? await getProjectType(task.projectId, userId) : "main";
    updates.categoryAllocations = serializeCategoryAllocationsForWrite(operation.categoryAllocations, projectType);
  }
  if (operation.lifestyleTraits !== undefined) {
    updates.lifestyleTraits = serializeLifestyleTraitsForWrite(operation.lifestyleTraits);
  }
  if (operation.dueDate !== undefined) {
    const nextDueDate = task.recurrenceRole === "template"
      ? null
      : operation.dueDate === null ? null : convertLocalDateToUTC(operation.dueDate);
    updates.dueDate = nextDueDate;
    updates.originalDueDate = nextDueDate;
    updates.rolloverHistory = null;
  }

  await taskRepo.updateTask(task.id, updates);
}

async function handleDeleteTask(operation: Extract<Operation, { type: "DELETE_TASK" }>, userId: number) {
  const task = await taskRepo.getTaskByClientId(operation.clientId);
  if (!task) return;
  if (task.userId !== userId) throw new Error(`Access denied for task: ${operation.clientId}`);
  assertUserEditableTask(task);

  if (task.recurrenceRole === "template") {
    await setTaskRecurrence({
      userId,
      clientId: operation.clientId,
      recurrence: { mode: "none" },
      timestamp: operation.timestamp,
    });
  }

  if (isOccurrenceRole(task.recurrenceRole)) {
    await taskRepo.updateTask(task.id, {
      deleted: 1,
      recurrenceStatus: task.recurrenceRole === "occurrence_root" ? "skipped" : "scheduled",
      recurrenceIsOverride: 1,
      updatedAt: new Date(operation.timestamp).toISOString(),
    });
    return;
  }

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
  const projectType = await getProjectType(projectId, userId);
  const recurrenceMetadata = getRecurrenceMetadataForNewChild(parentTask);
  const dueDate = operation.metadata?.dueDate ? convertLocalDateToUTC(operation.metadata.dueDate) : null;

  await taskRepo.createTask({
    userId,
    parentTaskId,
    projectId,
    path,
    clientId: operation.clientId,
    title: "",
    position: operation.position,
    isCompleted: 0,
    completedAt: null,
    dueDate,
    originalDueDate: dueDate,
    rolloverHistory: null,
    estimatedTimeMinutes: operation.metadata?.estimatedTimeMinutes ?? null,
    priority: operation.metadata?.priority ?? null,
    categoryAllocations: serializeCategoryAllocationsForWrite(operation.metadata?.categoryAllocations, projectType),
    lifestyleTraits: serializeLifestyleTraitsForWrite(operation.metadata?.lifestyleTraits),
    systemType: operation.metadata?.systemType ?? null,
    ...recurrenceMetadata,
    deleted: 0,
    archived: 0,
    draft: 0,
    chatId: null,
    createdAt: timestampISO,
    updatedAt: timestampISO,
  });
}

async function handleSetRecurrence(operation: Extract<Operation, { type: "SET_RECURRENCE" }>, userId: number) {
  await setTaskRecurrence({
    userId,
    clientId: operation.clientId,
    recurrence: operation.recurrence,
    timestamp: operation.timestamp,
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
  const projectType = await getProjectType(projectId, userId);
  const dueDate = node.dueDate ? convertLocalDateToUTC(node.dueDate) : null;

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
    completedAt: node.isCompleted ? timestampISO : null,
    estimatedTimeMinutes: node.estimatedTimeMinutes ?? null,
    dueDate,
    originalDueDate: dueDate,
    rolloverHistory: null,
    priority: node.priority ?? null,
    categoryAllocations: serializeCategoryAllocationsForWrite(node.categoryAllocations, projectType),
    lifestyleTraits: serializeLifestyleTraitsForWrite(node.lifestyleTraits),
    systemType: node.systemType ?? null,
    position,
    deleted: 0,
    archived: 0,
    draft: 0,
    chatId: null,
    createdAt: timestampISO,
    updatedAt: timestampISO,
  });

  if (node.subtasks?.length) {
    await Promise.all(
      node.subtasks.map((subtask) => createSubtree(subtask, userId, projectId, createdTask.id, timestamp)),
    );
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
  const applyOperation = async (operation: Operation) => {
    switch (operation.type) {
      case "UPDATE_TITLE":
        await handleUpdateTitle(operation, userId);
        return;
      case "TOGGLE_COMPLETE":
        await handleToggleComplete(operation, userId);
        return;
      case "ADD_RECURRENCE_TARGET_COMPLETION":
        await handleAddRecurrenceTargetCompletion(operation, userId);
        return;
      case "UPDATE_METADATA":
        await handleUpdateMetadata(operation, userId);
        return;
      case "SET_RECURRENCE":
        await handleSetRecurrence(operation, userId);
        return;
      case "DELETE_TASK":
        await handleDeleteTask(operation, userId);
        return;
      case "CREATE_TASK":
        await handleCreateTask(operation, userId, batch.projectId);
        return;
      case "IMPORT_TASKS":
        await handleImportTasks(operation, userId, batch.projectId);
        return;
      default:
        return;
    }
  };

  const applyOperationsSequentially = async (index: number): Promise<void> => {
    const operation = batch.operations[index];
    if (!operation) return;

    await applyOperation(operation);
    await applyOperationsSequentially(index + 1);
  };

  await applyOperationsSequentially(0);

  return taskService.getProjectTree(userId, batch.projectId);
}
