import { and, eq, isNull, not } from "drizzle-orm";
import { db } from "../db/client";
import { type InsertProject, type Project, projects } from "../db/schema/projects";

export async function findProjectsByUserId(userId: number): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.deletedAt), not(eq(projects.status, "archived"))));
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
