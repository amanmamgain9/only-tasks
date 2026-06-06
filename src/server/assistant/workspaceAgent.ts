import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ASSISTANT_CAPABILITIES, routeForDateRange, routeForDueDate, type WorkspaceUiAction } from "@/server/assistant/capabilities";
import {
  getCategoryRootTitle,
  isTaskCategoryId,
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  serializeTaskCategoryAllocations,
  type LifestyleTraitAllocation,
  type LifestyleTraitId,
  type TaskCategoryAllocation,
  type TaskCategoryId,
} from "@/features/categories/taskCategories";
import { addDaysToDateKey, formatLocalDateKey, getWeekStartDateKey, normalizeTimeZone } from "@/server/progress/timezone";
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

export type WorkspaceAgentAction =
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
};

type AgentCommand =
  | {
      kind: "create_tasks";
      tasks: Array<{
        title: string;
        category: TaskCategoryId;
        categoryAllocations: TaskCategoryAllocation[];
        lifestyleTraits: LifestyleTraitAllocation[];
      }>;
      dueDate: string | null;
    }
  | {
      kind: "query_tasks";
      category: TaskCategoryId | null;
      onlyOpen: boolean;
      onlyCompleted: boolean;
      dateRange: "today" | "tomorrow" | "this_week" | "last_7_days" | "this_month" | null;
      missed: boolean;
      rolledOver: boolean;
      postponed: boolean;
      searchText: string | null;
    }
  | { kind: "capabilities" }
  | { kind: "unsupported"; reason: string };

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

function normalizePromptLine(line: string) {
  return line
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/^\s*(todo|task)\s*:\s*/i, "")
    .trim();
}

function stripCreatePrefix(value: string) {
  return value
    .replace(/^(please\s+)?(add|create|put|make)\s+(tasks?\s+)?/i, "")
    .replace(/^here(?:'s| is)\s+(a\s+)?(messy\s+)?list\s*:?\s*/i, "")
    .replace(/^turn\s+this\s+into\s+(my\s+)?(tree|tasks?)\s*:?\s*/i, "")
    .trim();
}

function splitTaskTitles(prompt: string) {
  const withoutIntro = stripCreatePrefix(prompt.replace(/\r/g, "\n"));
  const lineCandidates = withoutIntro
    .split("\n")
    .map(normalizePromptLine)
    .filter(Boolean)
    .filter((line) => !/^(today|tomorrow|side project|main work|chore|lifestyle)\s*:?\s*$/i.test(line));

  if (lineCandidates.length > 1) return lineCandidates.slice(0, 25);

  const singleLine = normalizePromptLine(lineCandidates[0] ?? withoutIntro);
  if (!singleLine) return [];

  const separator = singleLine.includes(";") ? /;/ : singleLine.includes(" • ") ? / • / : null;
  if (separator) {
    return singleLine
      .split(separator)
      .map(normalizePromptLine)
      .filter(Boolean)
      .slice(0, 25);
  }

  return [singleLine].slice(0, 25);
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function inferCategory(title: string, fullPrompt: string): TaskCategoryId {
  const text = title.toLowerCase();
  if (/\b(side project|sideproject|build|launch|demo|landing|github|deploy|ship|product|app|saas)\b/.test(text)) {
    return "side_project";
  }
  if (/\b(chore|gst|tax|bill|bank|passport|laundry|grocer|clean|rent|filing|errand|appointment)\b/.test(text)) {
    return "chore";
  }
  if (/\b(lifestyle|learn|study|course|read|gym|workout|run|walk|health|doctor|dance|padel|friend|family|call|hobby|music|art|game)\b/.test(text)) {
    return "lifestyle";
  }
  if (/\b(main work|job|client|manager|meeting|office|work)\b/.test(text)) return "job";
  return getPromptCategory(fullPrompt) ?? "job";
}

function inferLifestyleTraits(title: string): LifestyleTraitAllocation[] {
  const text = title.toLowerCase();
  const traits: LifestyleTraitId[] = [];
  if (includesAny(text, ["learn", "study", "course", "read", "practice", "research"])) traits.push("learning");
  if (includesAny(text, ["gym", "workout", "run", "walk", "health", "doctor", "therapy", "sleep", "padel", "dance"])) traits.push("health");
  if (includesAny(text, ["friend", "family", "call", "meet", "dinner", "social", "community"])) traits.push("social");
  if (includesAny(text, ["hobby", "music", "art", "game", "paint", "dance", "padel", "play"])) traits.push("hobby");
  if (traits.length === 0) return [];

  const baseWeight = Math.floor(100 / traits.length);
  let remainder = 100 - baseWeight * traits.length;
  return traits.map((trait) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { trait, weight: baseWeight + extra };
  });
}

function parseDueDate(prompt: string, fallback: "today" | "tomorrow" | "this-week" | undefined, todayDate: string) {
  const text = prompt.toLowerCase();
  if (/\b(no due date|no deadline|backlog|someday)\b/.test(text)) return null;
  if (/\btomorrow\b/.test(text)) return addDaysToDateKey(todayDate, 1);
  if (/\btoday\b/.test(text)) return todayDate;
  if (fallback === "tomorrow") return addDaysToDateKey(todayDate, 1);
  return todayDate;
}

function getPromptCategory(prompt: string): TaskCategoryId | null {
  const text = prompt.toLowerCase();
  if (/\b(main work|job|work)\b/.test(text)) return "job";
  if (/\b(side project|sideproject)\b/.test(text)) return "side_project";
  if (/\b(chore|chores|admin|errands)\b/.test(text)) return "chore";
  if (/\b(lifestyle|health|learning|social|hobby)\b/.test(text)) return "lifestyle";
  return null;
}

function isQueryPrompt(prompt: string) {
  return /^(show|list|find|what|which|where|search|give me)\b/i.test(prompt.trim()) ||
    /\b(what is left|what's left|missed|not done|unfinished|open tasks|completed but not reviewed|rolled over|postponed)\b/i.test(prompt);
}

function isCreatePrompt(prompt: string) {
  return /^(add|create|put|make|here(?:'s| is)|turn this)\b/i.test(prompt.trim()) ||
    prompt.split("\n").some((line) => /^\s*[-*•]|\s*\d+[.)]\s+/.test(line));
}

export function parseWorkspaceAgentPrompt(input: {
  prompt: string;
  todayDate: string;
  currentView?: "today" | "tomorrow" | "this-week";
}): AgentCommand {
  const prompt = promptSchema.parse(input.prompt);
  const lower = prompt.toLowerCase();

  if (/\b(what can you do|help|commands|capabilities)\b/.test(lower)) {
    return { kind: "capabilities" };
  }

  if (isQueryPrompt(prompt) && !isCreatePrompt(prompt)) {
    return {
      kind: "query_tasks",
      category: getPromptCategory(prompt),
      onlyOpen: !/\bcompleted|done|closed\b/.test(lower) || /\bnot done|unfinished|open|left|missed\b/.test(lower),
      onlyCompleted: /\bcompleted|done|closed\b/.test(lower) && !/\bnot done|unfinished|open|left|missed\b/.test(lower),
      dateRange: /\btomorrow\b/.test(lower)
        ? "tomorrow"
        : /\btoday\b/.test(lower)
          ? "today"
          : /\b(last 7 days|past week|in a week)\b/.test(lower)
              ? "last_7_days"
            : /\b(this week|week)\b/.test(lower)
              ? "this_week"
              : /\b(this month|month)\b/.test(lower)
                ? "this_month"
                : null,
      missed: /\bmissed|overdue\b/.test(lower),
      rolledOver: /\brolled over|rollover\b/.test(lower),
      postponed: /\bpostponed|kept moving|kept postponing\b/.test(lower),
      searchText: extractSearchText(prompt),
    };
  }

  if (isCreatePrompt(prompt)) {
    const tasks = splitTaskTitles(prompt).map((title) => {
      const category = inferCategory(title, prompt);
      const lifestyleTraits = category === "lifestyle" ? inferLifestyleTraits(title) : [];
      return {
        title,
        category,
        categoryAllocations: [{ category, weight: 100 }],
        lifestyleTraits,
      };
    });

    if (tasks.length > 0) {
      return {
        kind: "create_tasks",
        tasks,
        dueDate: parseDueDate(prompt, input.currentView, input.todayDate),
      };
    }
  }

  if (/\b(target|goal|rhythm|month|90 minutes|plan|review|recap)\b/.test(lower)) {
    return {
      kind: "unsupported",
      reason: "I can read and create tasks in this first agent pass. Planning, targets, review, and recap commands need confirmation cards before they should change your workspace.",
    };
  }

  return {
    kind: "create_tasks",
    tasks: [{
      title: stripCreatePrefix(prompt),
      category: inferCategory(prompt, prompt),
      categoryAllocations: [{ category: inferCategory(prompt, prompt), weight: 100 }],
      lifestyleTraits: inferCategory(prompt, prompt) === "lifestyle" ? inferLifestyleTraits(prompt) : [],
    }],
    dueDate: parseDueDate(prompt, input.currentView, input.todayDate),
  };
}

function extractSearchText(prompt: string) {
  const quoted = prompt.match(/"([^"]+)"/)?.[1] || prompt.match(/'([^']+)'/)?.[1];
  if (quoted?.trim()) return quoted.trim();
  const aboutMatch = prompt.match(/\b(?:about|containing|called|named)\s+(.+)$/i)?.[1];
  if (!aboutMatch) return null;
  return aboutMatch
    .replace(/\b(that|are|is|open|done|completed|unfinished|today|tomorrow|this week|this month)\b/gi, " ")
    .trim() || null;
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

function isTaskInDateRange(task: Task, command: Extract<AgentCommand, { kind: "query_tasks" }>, todayDate: string) {
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
  command: Extract<AgentCommand, { kind: "query_tasks" }>;
  todayDate: string;
}): Promise<WorkspaceAgentAction> {
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

  return {
    type: "task_query",
    resultCount: matched.length,
    shownCount: tasks.length,
    filters: filters.length > 0 ? filters : ["all workspace tasks"],
    uiActions: [{
      type: "navigate",
      to: routeForDateRange(input.command.dateRange),
      reason: input.command.dateRange
        ? "Show the matching date view in the editable task tree."
        : "Show the full editable task tree for these results.",
    }],
    tasks,
  };
}

async function executeCreateTasksCommand(input: {
  userId: number;
  project: Project;
  command: Extract<AgentCommand, { kind: "create_tasks" }>;
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

  return {
    type: "tasks_created",
    createdCount: input.command.tasks.length,
    dueDate: input.command.dueDate,
    uiActions: [{
      type: "navigate",
      to: routeForDueDate({
        dueDate: input.command.dueDate,
        todayDate: input.todayDate,
        tomorrowDate: addDaysToDateKey(input.todayDate, 1),
      }),
      reason: "Show the created tasks in the editable task tree.",
    }],
    groups: Array.from(grouped.entries()).map(([category, titles]) => ({
      category,
      label: getCategoryRootTitle(category),
      titles,
    })),
  } satisfies WorkspaceAgentAction;
}

function actionToMessage(action: WorkspaceAgentAction) {
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

function capabilitiesAction(): WorkspaceAgentAction {
  return {
    type: "capabilities",
    uiActions: [],
    commands: ASSISTANT_CAPABILITIES.map((capability) => capability.description),
  };
}

function unsupportedAction(reason: string): WorkspaceAgentAction {
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

async function executeCommand(input: {
  userId: number;
  project: Project;
  command: AgentCommand;
  todayDate: string;
}) {
  switch (input.command.kind) {
    case "create_tasks":
      return executeCreateTasksCommand(input as {
        userId: number;
        project: Project;
        command: Extract<AgentCommand, { kind: "create_tasks" }>;
        todayDate: string;
      });
    case "query_tasks":
      return executeQueryCommand(input as {
        userId: number;
        project: Project;
        command: Extract<AgentCommand, { kind: "query_tasks" }>;
        todayDate: string;
      });
    case "capabilities":
      return capabilitiesAction();
    case "unsupported":
      return unsupportedAction(input.command.reason);
  }
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
  const command = parseWorkspaceAgentPrompt({
    prompt,
    todayDate,
    currentView: input.currentView,
  });
  const action = await executeCommand({
    userId: input.userId,
    project,
    command,
    todayDate,
  });
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
        command,
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
  };
}
