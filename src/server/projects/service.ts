import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { projects, type Project } from "../db/schema/projects";
import { users } from "../db/schema/users";
import * as projectRepo from "./repository";

export async function ensureDefaultWorkspace(userId: number): Promise<void> {
  const now = new Date().toISOString();
  const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (existingUser.length === 0) {
    throw new Error(`Cannot initialize workspace for missing user ${userId}`);
  }

  const existingProjects = await projectRepo.findProjectsByUserId(userId);
  if (existingProjects.length === 0) {
    await projectRepo.createProject({
      userId,
      title: "Inbox",
      type: "main",
      status: "active",
      targetDate: null,
      draft: 0,
      createdByChatId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function getProjectsForUser(userId: number): Promise<Project[]> {
  await ensureDefaultWorkspace(userId);
  return projectRepo.findProjectsByUserId(userId);
}
