import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { projects, type Project } from "../db/schema/projects";
import { users } from "../db/schema/users";
import * as projectRepo from "./repository";

export type GetProjectsForUserOptions = projectRepo.FindProjectsByUserIdOptions;

type ProjectType = Project["type"];
type ProjectStatus = Project["status"];

const projectTypes: ProjectType[] = ["main", "side_project", "chore"];
const projectStatuses: ProjectStatus[] = ["active", "completed", "on_hold", "cancelled", "archived"];

function normalizeProjectType(value: unknown): ProjectType {
  if (typeof value === "string" && projectTypes.includes(value as ProjectType)) {
    return value as ProjectType;
  }
  return "main";
}

function normalizeProjectTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Project title is required.");
  }

  const title = value.trim();
  if (!title) {
    throw new Error("Project title is required.");
  }

  return title;
}

function normalizeProjectStatus(value: unknown): ProjectStatus {
  if (typeof value === "string" && projectStatuses.includes(value as ProjectStatus)) {
    return value as ProjectStatus;
  }
  throw new Error("Invalid project status.");
}

function normalizeTargetDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Invalid target date.");
  }

  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(value)) {
    throw new Error("Target date must be YYYY-MM-DD, ISO date, or null.");
  }

  return value;
}

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
      title: "Workspace",
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

export async function getProjectsForUser(
  userId: number,
  options: GetProjectsForUserOptions = {},
): Promise<Project[]> {
  await ensureDefaultWorkspace(userId);
  return projectRepo.findProjectsByUserId(userId, options);
}

export async function createProjectForUser(
  userId: number,
  input: {
    title: unknown;
    type?: unknown;
  },
): Promise<Project> {
  const now = new Date().toISOString();

  return projectRepo.createProject({
    userId,
    title: normalizeProjectTitle(input.title),
    type: normalizeProjectType(input.type),
    status: "active",
    targetDate: null,
    draft: 0,
    createdByChatId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateProjectForUser(
  userId: number,
  projectId: number,
  input: {
    title?: unknown;
    type?: unknown;
    status?: unknown;
    targetDate?: unknown;
  },
): Promise<Project> {
  const updates: Parameters<typeof projectRepo.updateProjectForUser>[2] = {
    updatedAt: new Date().toISOString(),
  };

  if (input.title !== undefined) {
    updates.title = normalizeProjectTitle(input.title);
  }

  if (input.type !== undefined) {
    updates.type = normalizeProjectType(input.type);
  }

  if (input.status !== undefined) {
    updates.status = normalizeProjectStatus(input.status);
  }

  if (input.targetDate !== undefined) {
    updates.targetDate = normalizeTargetDate(input.targetDate);
  }

  const project = await projectRepo.updateProjectForUser(projectId, userId, updates);
  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

export async function softDeleteProjectForUser(userId: number, projectId: number): Promise<Project> {
  const project = await projectRepo.softDeleteProjectForUser(projectId, userId);
  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

export async function restoreProjectForUser(userId: number, projectId: number): Promise<Project> {
  const project = await projectRepo.restoreProjectForUser(projectId, userId);
  if (!project) {
    throw new Error("Project not found.");
  }

  return project;
}

export function archiveProjectForUser(userId: number, projectId: number): Promise<Project> {
  return updateProjectForUser(userId, projectId, { status: "archived" });
}

export function unarchiveProjectForUser(userId: number, projectId: number): Promise<Project> {
  return updateProjectForUser(userId, projectId, { status: "active" });
}
