import { and, desc, eq, gte, inArray, isNull, like, lt, SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import {
  createTaskSchema,
  findTasksByUserIdOptionsSchema,
  type CreateTaskInput,
  type FindTasksByUserIdOptions,
  type InsertTask,
  type Task,
  tasks,
  type UpdateTaskInput,
  updateTaskSchema,
} from "../db/schema/tasks";

export interface CreateTaskDbInput extends CreateTaskInput {
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTaskDbInput extends UpdateTaskInput {
  updatedAt: string;
}

export async function findTasksByUserId(
  userId: number,
  options: FindTasksByUserIdOptions = {},
): Promise<Task[]> {
  try {
    const validatedOptions = findTasksByUserIdOptionsSchema.parse(options);
    const conditions: SQL[] = [eq(tasks.userId, userId)];

    if (!validatedOptions.includeDeleted) conditions.push(eq(tasks.deleted, 0));
    if (!validatedOptions.includeArchived) conditions.push(eq(tasks.archived, 0));
    if (validatedOptions.includeCompleted === false) conditions.push(eq(tasks.isCompleted, 0));
    if (validatedOptions.projectId !== undefined) conditions.push(eq(tasks.projectId, validatedOptions.projectId));
    if (validatedOptions.chatId !== undefined) conditions.push(eq(tasks.chatId, validatedOptions.chatId));
    if (validatedOptions.draft !== undefined) conditions.push(eq(tasks.draft, validatedOptions.draft));

    if (validatedOptions.parentTaskId !== undefined) {
      if (validatedOptions.parentTaskId === null) {
        conditions.push(isNull(tasks.parentTaskId));
      } else {
        conditions.push(eq(tasks.parentTaskId, validatedOptions.parentTaskId));
      }
    }

    if (validatedOptions.pathStartsWith) {
      conditions.push(like(tasks.path, `${validatedOptions.pathStartsWith}%`));
    }

    if (validatedOptions.dueDateStart && validatedOptions.dueDateEnd) {
      conditions.push(gte(tasks.dueDate, validatedOptions.dueDateStart));
      conditions.push(lt(tasks.dueDate, validatedOptions.dueDateEnd));
    } else if (validatedOptions.dueDateStart) {
      conditions.push(gte(tasks.dueDate, validatedOptions.dueDateStart));
    } else if (validatedOptions.dueDateEnd) {
      conditions.push(lt(tasks.dueDate, validatedOptions.dueDateEnd));
    }

    if (validatedOptions.priority !== undefined) conditions.push(eq(tasks.priority, validatedOptions.priority));
    if (validatedOptions.isBacklog === true) conditions.push(isNull(tasks.dueDate));

    return db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(tasks.position, desc(tasks.createdAt));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid filter options: ${error.errors[0].message}`);
    }
    throw error;
  }
}

export async function findTaskById(taskId: number): Promise<Task | null> {
  const results = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.deleted, 0)))
    .limit(1);
  return results[0] || null;
}

export async function findSiblingTasks(userId: number, parentTaskId: number | null): Promise<Task[]> {
  const conditions = [eq(tasks.userId, userId), eq(tasks.deleted, 0)];
  if (parentTaskId === null) {
    conditions.push(isNull(tasks.parentTaskId));
  } else {
    conditions.push(eq(tasks.parentTaskId, parentTaskId));
  }

  return db.select().from(tasks).where(and(...conditions)).orderBy(tasks.position);
}

export async function getTaskByClientId(clientId: string): Promise<Task | null> {
  const result = await db.select().from(tasks).where(eq(tasks.clientId, clientId)).limit(1);
  return result[0] || null;
}

export async function findTasksByIds(userId: number, taskIds: number[]): Promise<Task[]> {
  if (taskIds.length === 0) return [];

  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, taskIds), eq(tasks.deleted, 0), eq(tasks.archived, 0)))
    .orderBy(tasks.position, desc(tasks.createdAt));
}

export async function createTask(input: CreateTaskDbInput): Promise<Task> {
  const validatedInput = createTaskSchema.parse(input);
  const [result] = await db
    .insert(tasks)
    .values({
      ...validatedInput,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    } as InsertTask)
    .returning();
  return result;
}

export async function updateTask(taskId: number, input: UpdateTaskDbInput): Promise<Task> {
  const validatedInput = updateTaskSchema.parse(input);
  const [result] = await db
    .update(tasks)
    .set({
      ...validatedInput,
      updatedAt: input.updatedAt,
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return result;
}

export async function softDeleteTask(taskId: number): Promise<Task> {
  const [result] = await db
    .update(tasks)
    .set({
      deleted: 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tasks.id, taskId))
    .returning();
  return result;
}
