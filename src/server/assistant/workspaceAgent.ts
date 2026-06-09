import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ASSISTANT_CAPABILITIES,
  blockForDateRange,
  blockForRoute,
  routeForDateRange,
  routeForDueDate,
  type WorkspaceUiAction,
} from "@/server/assistant/capabilities";
import {
  getCategoryRootTitle,
  normalizeTaskCategoryAllocations,
  serializeTaskCategoryAllocations,
  type TaskCategoryId,
} from "@/features/categories/taskCategories";
import { addDaysToDateKey, formatLocalDateKey, getWeekStartDateKey, normalizeTimeZone } from "@/server/progress/timezone";
import {
  isWorkspaceAgentLlmConfigured,
  resolveWorkspaceAgentPromptWithLlm,
  type WorkspaceAgentCommand,
  type WorkspaceLlmMetadata,
} from "@/server/assistant/workspaceLlm";
import { sqlite } from "@/server/db/client";
import type { Project } from "@/server/db/schema/projects";
import type { Task } from "@/server/db/schema/tasks";
import * as projectService from "@/server/projects/service";
import * as taskRepo from "@/server/tasks/repository";
import { applyOperationBatch } from "@/server/tasks/operations";
import { ensureCategoryRootTasks } from "@/server/tasks/service";
import type { OperationBatch, SubtreeNode } from "@/server/tasks/contracts";

const WORKSPACE_AGENT_SURFACE = "workspace_agent";
const CATEGORY_ROOT_SYSTEM_TYPE = "category_root";
const WORKSPACE_LLM_USER_WINDOW_MS = 15 * 60 * 1000;
const WORKSPACE_LLM_THREAD_WINDOW_MS = 5 * 60 * 1000;
const WORKSPACE_LLM_USER_WINDOW_LIMIT = 60;
const WORKSPACE_LLM_THREAD_WINDOW_LIMIT = 20;
const WORKSPACE_AGENT_MAX_STEPS = 5;

const promptSchema = z.string().trim().min(1).max(4000);

type AssistantThreadRow = {
  id: number;
  user_id: number;
  surface: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_client_id: string | null;
  status: "active" | "archived";
  title: string | null;
  created_at: string;
  updated_at: string;
};

type AssistantMessageRow = {
  id: number;
  thread_id: number;
  user_id: number;
  role: "assistant" | "user" | "system";
  content: string;
  structured_payload: string | null;
  created_at: string;
};

export type WorkspaceAgentTaskSummary = {
  clientId: string | null;
  title: string;
  category: TaskCategoryId | null;
  categoryLabel: string;
  parentTitles: string[];
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  rolloverCount: number;
};

export type WorkspaceAgentAtomicAction =
  | {
      type: "tasks_created";
      createdCount: number;
      dueDate: string | null;
      uiActions: WorkspaceUiAction[];
      groups: Array<{
        category: TaskCategoryId;
        label: string;
        titles: string[];
      }>;
    }
  | {
      type: "task_query";
      resultCount: number;
      shownCount: number;
      filters: string[];
      uiActions: WorkspaceUiAction[];
      tasks: WorkspaceAgentTaskSummary[];
    }
  | {
      type: "capabilities";
      commands: string[];
      uiActions: WorkspaceUiAction[];
    }
  | {
      type: "unsupported";
      reason: string;
      suggestions: string[];
      uiActions: WorkspaceUiAction[];
    }
  | {
      type: "agent_response";
      message: string;
      uiActions: WorkspaceUiAction[];
    };

export type WorkspaceAgentAction =
  | WorkspaceAgentAtomicAction
  | {
      type: "agent_workflow";
      summary: string;
      uiActions: WorkspaceUiAction[];
      steps: Array<{
        id: string;
        commandKind: WorkspaceAgentCommand["kind"];
        title: string;
        action: WorkspaceAgentAtomicAction;
      }>;
    };

export type WorkspaceAgentThreadDTO = {
  thread: {
    id: number;
    surface: string;
    entityType: string | null;
    entityId: number | null;
    entityClientId: string | null;
    title: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: number;
    threadId: number;
    role: "assistant" | "user" | "system";
    content: string;
    structuredPayload: unknown | null;
    createdAt: string;
  }>;
  latestAction: WorkspaceAgentAction | null;
  llmConfigured: boolean;
};

function serializePayload(payload: unknown) {
  return payload === undefined ? null : JSON.stringify(payload);
}

function parsePayload(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function toThreadDTO(row: AssistantThreadRow): WorkspaceAgentThreadDTO["thread"] {
  return {
    id: row.id,
    surface: row.surface,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityClientId: row.entity_client_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMessageDTO(row: AssistantMessageRow): WorkspaceAgentThreadDTO["messages"][number] {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    content: row.content,
    structuredPayload: parsePayload(row.structured_payload),
    createdAt: row.created_at,
  };
}

function findActiveThread(input: { userId: number; projectId: number }) {
  return sqlite
    .prepare(
      `SELECT *
       FROM pmwd_assistant_threads
       WHERE user_id = @userId
         AND surface = @surface
         AND entity_type = 'project'
         AND entity_client_id = @entityClientId
         AND status = 'active'
       LIMIT 1`,
    )
    .get({
      userId: input.userId,
      surface: WORKSPACE_AGENT_SURFACE,
      entityClientId: `project:${input.projectId}`,
    }) as AssistantThreadRow | undefined;
}

function getOrCreateWorkspaceThread(input: { userId: number; project: Project }) {
  const existing = findActiveThread({ userId: input.userId, projectId: input.project.id });
  if (existing) return existing;

  const now = new Date().toISOString();
  const result = sqlite
    .prepare(
      `INSERT INTO pmwd_assistant_threads
       (user_id, surface, entity_type, entity_id, entity_client_id, status, title, created_at, updated_at)
       VALUES (@userId, @surface, 'project', @projectId, @entityClientId, 'active', @title, @now, @now)`,
    )
    .run({
      userId: input.userId,
      surface: WORKSPACE_AGENT_SURFACE,
      projectId: input.project.id,
      entityClientId: `project:${input.project.id}`,
      title: "Workspace agent",
      now,
    });

  return sqlite
    .prepare("SELECT * FROM pmwd_assistant_threads WHERE id = ? LIMIT 1")
    .get(Number(result.lastInsertRowid)) as AssistantThreadRow;
}

function insertMessage(input: {
  threadId: number;
  userId: number;
  role: "assistant" | "user" | "system";
  content: string;
  structuredPayload?: unknown;
  now: string;
}) {
  sqlite
    .prepare(
      `INSERT INTO pmwd_assistant_messages
       (thread_id, user_id, role, content, structured_payload, created_at)
       VALUES (@threadId, @userId, @role, @content, @structuredPayload, @now)`,
    )
    .run({
      ...input,
      structuredPayload: serializePayload(input.structuredPayload),
    });
}

function updateThreadTimestamp(threadId: number, now: string) {
  sqlite.prepare("UPDATE pmwd_assistant_threads SET updated_at = ? WHERE id = ?").run(now, threadId);
}

function listMessages(threadId: number) {
  return (sqlite
    .prepare(
      `SELECT *
       FROM pmwd_assistant_messages
       WHERE thread_id = ?
       ORDER BY id ASC`,
    )
    .all(threadId) as AssistantMessageRow[]).map(toMessageDTO);
}

function sanitizeLlmMetadataForClient(metadata: WorkspaceLlmMetadata | null | undefined) {
  if (!metadata) return null;

  return {
    provider: metadata.provider,
    model: metadata.model,
    usedJsonMode: metadata.usedJsonMode,
    status: metadata.error ? "error" : "ok",
  };
}

function findLatestAction(messages: WorkspaceAgentThreadDTO["messages"]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const payload = messages[index]?.structuredPayload;
    if (!payload || typeof payload !== "object") continue;
    const candidate = payload as { type?: unknown; action?: unknown };
    if (candidate.type !== "workspace_agent_action") continue;
    return candidate.action as WorkspaceAgentAction;
  }
  return null;
}

function countRecentLlmUsage(input: {
  userId?: number;
  threadId?: number;
  surface?: string;
  since: string;
}) {
  const clauses = ["created_at >= @since"];
  if (input.userId !== undefined) clauses.push("user_id = @userId");
  if (input.threadId !== undefined) clauses.push("thread_id = @threadId");
  if (input.surface !== undefined) clauses.push("surface = @surface");

  const row = sqlite
    .prepare(`SELECT COUNT(*) AS count FROM pmwd_assistant_llm_usage WHERE ${clauses.join(" AND ")}`)
    .get(input) as { count: number };
  return row.count;
}

function reserveWorkspaceLlmUsage(input: {
  userId: number;
  threadId: number;
  prompt: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const userSince = new Date(nowMs - WORKSPACE_LLM_USER_WINDOW_MS).toISOString();
  const threadSince = new Date(nowMs - WORKSPACE_LLM_THREAD_WINDOW_MS).toISOString();

  return sqlite.transaction(() => {
    const userCount = countRecentLlmUsage({
      userId: input.userId,
      surface: WORKSPACE_AGENT_SURFACE,
      since: userSince,
    });
    if (userCount >= WORKSPACE_LLM_USER_WINDOW_LIMIT) return false;

    const threadCount = countRecentLlmUsage({
      threadId: input.threadId,
      since: threadSince,
    });
    if (threadCount >= WORKSPACE_LLM_THREAD_WINDOW_LIMIT) return false;

    sqlite
      .prepare(
        `INSERT INTO pmwd_assistant_llm_usage
         (user_id, thread_id, surface, prompt_chars, created_at)
         VALUES (@userId, @threadId, @surface, @promptChars, @createdAt)`,
      )
      .run({
        userId: input.userId,
        threadId: input.threadId,
        surface: WORKSPACE_AGENT_SURFACE,
        promptChars: input.prompt.length,
        createdAt: nowIso,
      });
    return true;
  })();
}

async function resolveWorkspaceProject(userId: number, projectId?: number | null) {
  const projects = await projectService.getProjectsForUser(userId, {
    status: "active",
    includeArchived: false,
  });

  if (projectId) {
    const project = projects.find((item) => item.id === projectId);
    if (project) return project;
    throw new Error("Workspace project not found.");
  }

  return projects.find((project) => project.title.trim().toLowerCase() === "workspace") ?? projects[0];
}

function parseFirstCategory(value: string | null): TaskCategoryId | null {
  if (!value) return null;
  const allocations = normalizeTaskCategoryAllocations(value);
  return allocations[0]?.category ?? null;
}

function getTaskCategoryFromTree(task: Task, rootsById: Map<number, TaskCategoryId>) {
  const pathIds = task.path
    .split("/")
    .filter(Boolean)
    .map((value) => Number(value))
    .filter(Number.isFinite);

  for (const id of pathIds) {
    const category = rootsById.get(id);
    if (category) return category;
  }

  return parseFirstCategory(task.categoryAllocations);
}

function getRolloverCount(task: Pick<Task, "rolloverHistory">) {
  if (!task.rolloverHistory) return 0;
  try {
    const parsed = JSON.parse(task.rolloverHistory) as unknown;
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return 1;
  }
}

function getDueDateKey(task: Pick<Task, "dueDate">) {
  return task.dueDate?.slice(0, 10) ?? null;
}

function isTaskInDateRange(task: Task, command: Extract<WorkspaceAgentCommand, { kind: "query_tasks" }>, todayDate: string) {
  if (!command.dateRange) return true;
  const dueDate = getDueDateKey(task);
  const completedDate = task.completedAt?.slice(0, 10) ?? null;
  const candidateDate = dueDate ?? completedDate;
  if (!candidateDate) return false;

  if (command.dateRange === "today") return candidateDate === todayDate;
  if (command.dateRange === "tomorrow") return candidateDate === addDaysToDateKey(todayDate, 1);
  if (command.dateRange === "this_week") {
    const start = getWeekStartDateKey(todayDate, 1);
    const end = addDaysToDateKey(start, 7);
    return candidateDate >= start && candidateDate < end;
  }
  if (command.dateRange === "last_7_days") {
    const start = addDaysToDateKey(todayDate, -6);
    const end = addDaysToDateKey(todayDate, 1);
    return candidateDate >= start && candidateDate < end;
  }
  if (command.dateRange === "this_month") {
    return candidateDate.slice(0, 7) === todayDate.slice(0, 7);
  }
  return true;
}

function getParentTitles(task: Task, tasksById: Map<number, Task>) {
  return task.path
    .split("/")
    .filter(Boolean)
    .map((value) => Number(value))
    .filter(Number.isFinite)
    .map((id) => tasksById.get(id))
    .filter((parent): parent is Task => parent !== undefined && parent.systemType !== CATEGORY_ROOT_SYSTEM_TYPE)
    .map((parent) => parent.title)
    .filter(Boolean)
    .slice(-3);
}

function taskToSummary(task: Task, category: TaskCategoryId | null, tasksById: Map<number, Task>): WorkspaceAgentTaskSummary {
  return {
    clientId: task.clientId,
    title: task.title,
    category,
    categoryLabel: category ? getCategoryRootTitle(category) : "Uncategorized",
    parentTitles: getParentTitles(task, tasksById),
    dueDate: getDueDateKey(task),
    isCompleted: task.isCompleted === 1,
    completedAt: task.completedAt,
    rolloverCount: getRolloverCount(task),
  };
}

async function executeQueryCommand(input: {
  userId: number;
  project: Project;
  command: Extract<WorkspaceAgentCommand, { kind: "query_tasks" }>;
  todayDate: string;
}): Promise<WorkspaceAgentAtomicAction> {
  const roots = await ensureCategoryRootTasks(input.userId, input.project.id);
  const rootsById = new Map<number, TaskCategoryId>();
  for (const root of roots) {
    const category = parseFirstCategory(root.categoryAllocations);
    if (category) rootsById.set(root.id, category);
  }

  const allTasks = await taskRepo.findTasksByUserId(input.userId, {
    projectId: input.project.id,
    includeCompleted: true,
    includeDeleted: false,
    includeArchived: false,
  });
  const tasksById = new Map(allTasks.map((task) => [task.id, task]));

  const filters: string[] = [];
  if (input.command.category) filters.push(getCategoryRootTitle(input.command.category));
  if (input.command.onlyOpen) filters.push("open");
  if (input.command.onlyCompleted) filters.push("completed");
  if (input.command.dateRange) filters.push(input.command.dateRange.replaceAll("_", " "));
  if (input.command.missed) filters.push("missed");
  if (input.command.rolledOver) filters.push("rolled over");
  if (input.command.postponed) filters.push("postponed");
  if (input.command.searchText) filters.push(`title contains "${input.command.searchText}"`);

  const searchText = input.command.searchText?.toLowerCase() ?? null;
  const matched = allTasks
    .filter((task) => task.systemType !== CATEGORY_ROOT_SYSTEM_TYPE)
    .map((task) => ({ task, category: getTaskCategoryFromTree(task, rootsById) }))
    .filter(({ task, category }) => !input.command.category || category === input.command.category)
    .filter(({ task }) => !input.command.onlyOpen || task.isCompleted === 0)
    .filter(({ task }) => !input.command.onlyCompleted || task.isCompleted === 1)
    .filter(({ task }) => isTaskInDateRange(task, input.command, input.todayDate))
    .filter(({ task }) => !input.command.missed || (task.isCompleted === 0 && Boolean(task.dueDate) && getDueDateKey(task)! < input.todayDate))
    .filter(({ task }) => !input.command.rolledOver || getRolloverCount(task) > 0)
    .filter(({ task }) => !input.command.postponed || getRolloverCount(task) > 1)
    .filter(({ task }) => !searchText || task.title.toLowerCase().includes(searchText))
    .sort((a, b) => {
      const dueCompare = (a.task.dueDate ?? "9999").localeCompare(b.task.dueDate ?? "9999");
      if (dueCompare !== 0) return dueCompare;
      return (a.task.position || "").localeCompare(b.task.position || "");
    });

  const tasks = matched.slice(0, 12).map(({ task, category }) => taskToSummary(task, category, tasksById));

  const route = routeForDateRange(input.command.dateRange);

  return {
    type: "task_query",
    resultCount: matched.length,
    shownCount: tasks.length,
    filters: filters.length > 0 ? filters : ["all workspace tasks"],
    uiActions: [
      {
        type: "navigate",
        to: route,
        reason: "Keep the route context aligned with the visible task tree.",
      },
      {
        type: "show_block",
        block: blockForDateRange(input.command.dateRange),
        reason: input.command.dateRange
          ? "Render the matching editable task tree inside chat."
          : "Render the full editable workspace tree inside chat.",
      },
    ],
    tasks,
  };
}

async function executeCreateTasksCommand(input: {
  userId: number;
  project: Project;
  command: Extract<WorkspaceAgentCommand, { kind: "create_tasks" }>;
  todayDate: string;
}) {
  const roots = await ensureCategoryRootTasks(input.userId, input.project.id);
  const rootByCategory = new Map<TaskCategoryId, (typeof roots)[number]>();
  for (const root of roots) {
    const category = parseFirstCategory(root.categoryAllocations);
    if (category && root.clientId) rootByCategory.set(category, root);
  }

  const timestamp = Date.now();
  const operations: OperationBatch["operations"] = input.command.tasks.map((task) => {
    const parent = rootByCategory.get(task.category);
    if (!parent?.clientId) throw new Error(`Missing ${getCategoryRootTitle(task.category)} root.`);
    const subtree: SubtreeNode = {
      clientId: randomUUID(),
      title: task.title,
      position: "",
      isCompleted: false,
      dueDate: input.command.dueDate,
      categoryAllocations: task.categoryAllocations,
      lifestyleTraits: task.lifestyleTraits.length > 0 ? task.lifestyleTraits : undefined,
      subtasks: [],
    };
    return {
      type: "IMPORT_TASKS",
      rootClientId: randomUUID(),
      parentClientId: parent.clientId,
      subtree,
      timestamp,
    };
  });

  await applyOperationBatch({
    batchId: randomUUID(),
    projectId: input.project.id,
    timestamp,
    operations,
  }, input.userId);

  const grouped = new Map<TaskCategoryId, string[]>();
  for (const task of input.command.tasks) {
    const titles = grouped.get(task.category) ?? [];
    titles.push(task.title);
    grouped.set(task.category, titles);
  }

  const route = routeForDueDate({
    dueDate: input.command.dueDate,
    todayDate: input.todayDate,
    tomorrowDate: addDaysToDateKey(input.todayDate, 1),
  });

  return {
    type: "tasks_created",
    createdCount: input.command.tasks.length,
    dueDate: input.command.dueDate,
    uiActions: [
      {
        type: "navigate",
        to: route,
        reason: "Keep the route context aligned with the created tasks.",
      },
      {
        type: "show_block",
        block: blockForRoute(route),
        reason: "Render the created tasks in the editable tree inside chat.",
      },
    ],
    groups: Array.from(grouped.entries()).map(([category, titles]) => ({
      category,
      label: getCategoryRootTitle(category),
      titles,
    })),
  } satisfies WorkspaceAgentAtomicAction;
}

function actionToMessage(action: WorkspaceAgentAction) {
  if (action.type === "agent_workflow") {
    return action.summary;
  }
  if (action.type === "agent_response") {
    return action.message;
  }
  if (action.type === "tasks_created") {
    const dueDateText = action.dueDate ? ` for ${action.dueDate}` : "";
    return `Added ${action.createdCount} ${action.createdCount === 1 ? "task" : "tasks"}${dueDateText}.`;
  }
  if (action.type === "task_query") {
    if (action.resultCount === 0) return `I found no tasks matching ${action.filters.join(", ")}.`;
    return `I found ${action.resultCount} ${action.resultCount === 1 ? "task" : "tasks"} matching ${action.filters.join(", ")}.`;
  }
  if (action.type === "capabilities") {
    return "I can add tasks, turn messy lists into your tree, and query tasks by category, date, completion, rollover, or missed status.";
  }
  return action.reason;
}

function capabilitiesAction(): WorkspaceAgentAtomicAction {
  return {
    type: "capabilities",
    uiActions: [],
    commands: ASSISTANT_CAPABILITIES.map((capability) => capability.description),
  };
}

function unsupportedAction(reason: string): WorkspaceAgentAtomicAction {
  return {
    type: "unsupported",
    reason,
    uiActions: [],
    suggestions: [
      "Add launch checklist to side project today",
      "List open chores this week",
      "Show tasks I missed",
    ],
  };
}

function agentResponseAction(input: {
  message: string;
  uiActions?: WorkspaceUiAction[];
}): WorkspaceAgentAtomicAction {
  return {
    type: "agent_response",
    message: input.message,
    uiActions: input.uiActions ?? [],
  };
}

function normalizePromptText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDeterministicWorkspaceAgentPrompt(input: {
  prompt: string;
  todayDate?: string;
}): WorkspaceAgentCommand | null {
  const normalized = normalizePromptText(input.prompt);
  if (!normalized) return null;

  const hasMutationIntent = /\b(add|create|import|turn|make|new|delete|remove|complete|mark|move|edit|rename|schedule)\b/.test(normalized);
  const hasTimerIntent = /\b(timer|pomodoro)\b/.test(normalized)
    || /\bfocus (session|timer|block)\b/.test(normalized);
  const hasTimerVerb = /\b(show|open|start|use|launch|begin|timer|pomodoro|focus)\b/.test(normalized);

  if (hasTimerIntent && hasTimerVerb) {
    return {
      kind: "show_timer",
      mode: "compact",
      reason: "Show the live timer.",
    };
  }

  const asksForOtherSurface = /\b(tomorrow|week|weekly|month|review|stats|progress|target|targets|recap)\b/.test(normalized)
    || /\ball tasks\b/.test(normalized);
  const hasTaskSurfaceIntent = /\b(task|tasks|todo|todos|list)\b/.test(normalized)
    || /\bwhat is left\b/.test(normalized)
    || /\bwhats left\b/.test(normalized)
    || normalized === "today"
    || normalized === "show today"
    || normalized === "open today";
  const hasTodayIntent = /\b(today|todays)\b/.test(normalized)
    || ["show tasks", "open tasks", "list tasks", "show my tasks", "what is left", "whats left"].includes(normalized);
  const hasOpenIntent = /\b(show|open|list|view|see|display|give|get|what|whats)\b/.test(normalized);

  if (!hasMutationIntent && !asksForOtherSurface && hasTaskSurfaceIntent && hasTodayIntent && hasOpenIntent) {
    return {
      kind: "navigate_workspace",
      route: "/workspace/today",
      reason: "Open today's editable task surface.",
    };
  }

  if (/\b(add|create|make|new)\b/.test(normalized)
    && /\blaunch checklist\b/.test(normalized)
    && /\bside project\b/.test(normalized)
    && /\btoday\b/.test(normalized)
    && input.todayDate) {
    return {
      kind: "create_tasks",
      dueDate: input.todayDate,
      tasks: [{
        title: "Launch checklist",
        category: "side_project",
        categoryAllocations: [{ category: "side_project", weight: 100 }],
        lifestyleTraits: [],
      }],
    };
  }

  if (hasOpenIntent
    && /\b(open|list|show|view|see|display|get|give)\b/.test(normalized)
    && /\bchores?\b/.test(normalized)
    && /\bthis week\b/.test(normalized)) {
    return {
      kind: "query_tasks",
      category: "chore",
      onlyOpen: true,
      onlyCompleted: false,
      dateRange: "this_week",
      missed: false,
      rolledOver: false,
      postponed: false,
      searchText: null,
    };
  }

  if (hasOpenIntent
    && /\b(tasks?|todos?|list)\b/.test(normalized)
    && /\b(missed|overdue|late)\b/.test(normalized)) {
    return {
      kind: "query_tasks",
      category: null,
      onlyOpen: true,
      onlyCompleted: false,
      dateRange: null,
      missed: true,
      rolledOver: false,
      postponed: false,
      searchText: null,
    };
  }

  return null;
}

async function executeCommand(input: {
  userId: number;
  project: Project;
  command: WorkspaceAgentCommand;
  todayDate: string;
}): Promise<WorkspaceAgentAtomicAction> {
  switch (input.command.kind) {
    case "create_tasks":
      return executeCreateTasksCommand(input as {
        userId: number;
        project: Project;
        command: Extract<WorkspaceAgentCommand, { kind: "create_tasks" }>;
        todayDate: string;
      });
    case "query_tasks":
      return executeQueryCommand(input as {
        userId: number;
        project: Project;
        command: Extract<WorkspaceAgentCommand, { kind: "query_tasks" }>;
        todayDate: string;
      });
    case "capabilities":
      return capabilitiesAction();
    case "navigate_workspace":
      return agentResponseAction({
        message: input.command.reason,
        uiActions: [
          {
            type: "navigate",
            to: input.command.route,
            reason: input.command.reason,
          },
          {
            type: "show_block",
            block: blockForRoute(input.command.route),
            reason: input.command.reason,
          },
        ],
      });
    case "show_timer":
      return agentResponseAction({
        message: input.command.reason,
        uiActions: [{
          type: "show_block",
          block: {
            type: "timer",
            mode: input.command.mode,
            title: "Timer",
          },
          reason: input.command.reason,
        }],
      });
    case "focus_task":
      return agentResponseAction({
        message: input.command.reason,
        uiActions: [{
          type: "focus_task",
          clientId: input.command.clientId,
          reason: input.command.reason,
        }],
      });
    case "finish":
      return agentResponseAction({
        message: input.command.message,
      });
    case "unsupported":
      return unsupportedAction(input.command.reason);
  }
}

function getAtomicActionTitle(action: WorkspaceAgentAtomicAction) {
  if (action.type === "tasks_created") {
    return `${action.createdCount} ${action.createdCount === 1 ? "task" : "tasks"} created`;
  }
  if (action.type === "task_query") {
    return `${action.resultCount} ${action.resultCount === 1 ? "task" : "tasks"} found`;
  }
  if (action.type === "capabilities") return "Capabilities listed";
  if (action.type === "agent_response") return action.message;
  return action.reason;
}

function summarizeAtomicActionForModel(action: WorkspaceAgentAtomicAction) {
  if (action.type === "tasks_created") {
    return {
      type: action.type,
      createdCount: action.createdCount,
      dueDate: action.dueDate,
      groups: action.groups,
    };
  }
  if (action.type === "task_query") {
    const categoryCounts = action.tasks.reduce<Record<string, number>>((counts, task) => {
      const key = task.categoryLabel || "Uncategorized";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});

    return {
      type: action.type,
      resultCount: action.resultCount,
      shownCount: action.shownCount,
      filters: action.filters,
      categoryCounts,
    };
  }
  if (action.type === "capabilities") {
    return {
      type: action.type,
      commands: action.commands,
    };
  }
  if (action.type === "agent_response") {
    return {
      type: action.type,
      message: action.message,
      uiActions: action.uiActions,
    };
  }
  return {
    type: action.type,
    reason: action.reason,
    suggestions: action.suggestions,
  };
}

function terminalMessageForAction(action: WorkspaceAgentAtomicAction) {
  if (action.type === "tasks_created") {
    return `${action.createdCount} ${action.createdCount === 1 ? "task" : "tasks"} added.`;
  }
  if (action.type === "task_query") {
    return `${action.resultCount} matching ${action.resultCount === 1 ? "task" : "tasks"} shown.`;
  }
  if (action.type === "capabilities") return "Here are the workspace commands I can run.";
  if (action.type === "agent_response") return action.message;
  return action.reason;
}

function shouldStopAfterExecutedCommand(command: WorkspaceAgentCommand) {
  return command.kind === "create_tasks"
    || command.kind === "capabilities"
    || command.kind === "navigate_workspace"
    || command.kind === "show_timer"
    || command.kind === "focus_task";
}

function collectWorkflowUiActions(
  steps: Array<{ action: WorkspaceAgentAtomicAction }>,
  finalAction?: WorkspaceAgentAtomicAction,
) {
  return [
    ...steps.flatMap((step) => step.action.uiActions),
    ...(finalAction?.uiActions ?? []),
  ];
}

async function runWorkspaceAgentWorkflow(input: {
  userId: number;
  threadId: number;
  project: Project;
  prompt: string;
  todayDate: string;
  currentView?: "today" | "tomorrow" | "this-week";
}) {
  const deterministicCommand = parseDeterministicWorkspaceAgentPrompt({
    prompt: input.prompt,
    todayDate: input.todayDate,
  });
  if (deterministicCommand) {
    return {
      action: await executeCommand({
        userId: input.userId,
        project: input.project,
        command: deterministicCommand,
        todayDate: input.todayDate,
      }),
      llmMetadata: [] as Array<ReturnType<typeof sanitizeLlmMetadataForClient>>,
    };
  }

  const llmConfigured = isWorkspaceAgentLlmConfigured();
  if (!llmConfigured) {
    return {
      action: unsupportedAction("The workspace agent needs the LLM configured before it can safely change tasks."),
      llmMetadata: [] as Array<ReturnType<typeof sanitizeLlmMetadataForClient>>,
    };
  }

  const observations: unknown[] = [];
  const llmMetadata: Array<ReturnType<typeof sanitizeLlmMetadataForClient>> = [];
  const steps: Array<{
    id: string;
    commandKind: WorkspaceAgentCommand["kind"];
    title: string;
    action: WorkspaceAgentAtomicAction;
  }> = [];
  let finalAction: WorkspaceAgentAtomicAction | null = null;

  for (let stepIndex = 0; stepIndex < WORKSPACE_AGENT_MAX_STEPS; stepIndex += 1) {
    const llmUsageReserved = reserveWorkspaceLlmUsage({
      userId: input.userId,
      threadId: input.threadId,
      prompt: input.prompt,
    });
    if (!llmUsageReserved) {
      finalAction = unsupportedAction("The workspace agent is rate limited for a moment. Please try again shortly.");
      break;
    }

    const llmResolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: input.prompt,
      todayDate: input.todayDate,
      currentView: input.currentView,
      observations,
    });
    llmMetadata.push(sanitizeLlmMetadataForClient(llmResolution?.metadata));

    const command = llmResolution?.command;
    if (!command) {
      finalAction = unsupportedAction(
        llmResolution?.metadata.error
          ? "I could not run the workspace agent model. Please try again."
          : "The workspace agent could not produce a valid command.",
      );
      break;
    }

    const action = await executeCommand({
      userId: input.userId,
      project: input.project,
      command,
      todayDate: input.todayDate,
    });

    if (command.kind === "finish") {
      finalAction = action;
      break;
    }

    const step = {
      id: randomUUID(),
      commandKind: command.kind,
      title: getAtomicActionTitle(action),
      action,
    };
    steps.push(step);

    if (shouldStopAfterExecutedCommand(command)) {
      finalAction = agentResponseAction({
        message: terminalMessageForAction(action),
      });
      break;
    }

    observations.push({
      step: stepIndex + 1,
      command,
      result: summarizeAtomicActionForModel(action),
    });

    if (command.kind === "unsupported") {
      finalAction = action;
      break;
    }
  }

  if (steps.length === 0) {
    return {
      action: finalAction ?? unsupportedAction("The workspace agent stopped before it could use a workspace capability."),
      llmMetadata,
    };
  }

  return {
    action: {
      type: "agent_workflow",
      summary: finalAction?.type === "agent_response"
        ? finalAction.message
        : finalAction?.type === "unsupported"
          ? finalAction.reason
          : "Done.",
      uiActions: collectWorkflowUiActions(steps, finalAction ?? undefined),
      steps,
    } satisfies WorkspaceAgentAction,
    llmMetadata,
  };
}

export async function getWorkspaceAgentThread(input: {
  userId: number;
  projectId?: number | null;
}): Promise<WorkspaceAgentThreadDTO> {
  const project = await resolveWorkspaceProject(input.userId, input.projectId);
  if (!project) throw new Error("Workspace project not found.");

  const thread = getOrCreateWorkspaceThread({ userId: input.userId, project });
  const messages = listMessages(thread.id);
  return {
    thread: toThreadDTO(thread),
    messages,
    latestAction: findLatestAction(messages),
    llmConfigured: isWorkspaceAgentLlmConfigured(),
  };
}

export async function submitWorkspaceAgentMessage(input: {
  userId: number;
  projectId?: number | null;
  prompt: string;
  timeZone?: string | null;
  currentView?: "today" | "tomorrow" | "this-week";
}): Promise<WorkspaceAgentThreadDTO> {
  const project = await resolveWorkspaceProject(input.userId, input.projectId);
  if (!project) throw new Error("Workspace project not found.");

  const thread = getOrCreateWorkspaceThread({ userId: input.userId, project });
  const timeZone = normalizeTimeZone(input.timeZone);
  const todayDate = formatLocalDateKey(new Date(), timeZone);
  const prompt = promptSchema.parse(input.prompt);
  const workflow = await runWorkspaceAgentWorkflow({
    userId: input.userId,
    threadId: thread.id,
    project,
    prompt,
    todayDate,
    currentView: input.currentView,
  });
  const action = workflow.action;
  const now = new Date().toISOString();

  sqlite.transaction(() => {
    insertMessage({
      threadId: thread.id,
      userId: input.userId,
      role: "user",
      content: prompt,
      structuredPayload: {
        type: "workspace_agent_prompt",
        prompt,
        source: "orchestrator",
        llm: workflow.llmMetadata,
      },
      now,
    });
    insertMessage({
      threadId: thread.id,
      userId: input.userId,
      role: "assistant",
      content: actionToMessage(action),
      structuredPayload: {
        type: "workspace_agent_action",
        action,
        source: "orchestrator",
        llm: workflow.llmMetadata,
      },
      now,
    });
    updateThreadTimestamp(thread.id, now);
  })();

  const messages = listMessages(thread.id);
  return {
    thread: toThreadDTO(thread),
    messages,
    latestAction: action,
    llmConfigured: isWorkspaceAgentLlmConfigured(),
  };
}
