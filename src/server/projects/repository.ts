import { and, eq, gte, inArray, isNull, lte, not, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { type InsertProject, type Project, projects } from "../db/schema/projects";

export interface FindProjectsByUserIdOptions {
  includeCompleted?: boolean;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  includeDrafts?: boolean;
  status?: Project["status"];
  type?: Project["type"];
  targetDateStart?: string;
  targetDateEnd?: string;
  chatId?: number;
}

export async function findProjectsByUserId(
  userId: number,
  options: FindProjectsByUserIdOptions = {},
): Promise<Project[]> {
  const conditions: SQL[] = [eq(projects.userId, userId)];

  if (options.includeDeleted !== true) {
    conditions.push(isNull(projects.deletedAt));
  }

  const shouldIncludeDrafts = options.chatId !== undefined ? true : options.includeDrafts === true;
  if (!shouldIncludeDrafts) {
    conditions.push(eq(projects.draft, 0));
  }

  if (options.includeCompleted === false) {
    const statusesToExclude: Project["status"][] = ["completed"];

    if (options.includeArchived !== true) {
      statusesToExclude.push("archived");
    }

    conditions.push(not(inArray(projects.status, statusesToExclude)));
  } else if (options.includeArchived === false || options.includeArchived === undefined) {
    conditions.push(not(eq(projects.status, "archived")));
  }

  if (options.status !== undefined) {
    conditions.push(eq(projects.status, options.status));
  }

  if (options.type !== undefined) {
    conditions.push(eq(projects.type, options.type));
  }

  if (options.targetDateStart) {
    conditions.push(gte(projects.targetDate, options.targetDateStart));
  }

  if (options.targetDateEnd) {
    conditions.push(lte(projects.targetDate, options.targetDateEnd));
  }

  if (options.chatId !== undefined) {
    conditions.push(eq(projects.createdByChatId, options.chatId));
  }

  return db
    .select()
    .from(projects)
    .where(and(...conditions));
}

export async function findProjectById(projectId: number): Promise<Project | null> {
  const results = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);

  return results[0] || null;
}

export async function createProject(input: InsertProject): Promise<Project> {
  const [result] = await db.insert(projects).values(input).returning();
  return result;
}
