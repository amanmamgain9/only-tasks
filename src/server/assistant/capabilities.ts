import { z } from "zod";

export const workspaceRouteSchema = z.enum([
  "/workspace/all-tasks",
  "/workspace/today",
  "/workspace/tomorrow",
  "/workspace/this-week",
  "/workspace/day-review",
  "/workspace/progress",
]);

export const workspaceUiBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task_tree"),
    id: z.string().optional(),
    title: z.string().optional(),
    view: z.enum(["all", "today", "tomorrow", "this_week"]),
    focusTaskId: z.string().optional(),
  }),
  z.object({
    type: z.literal("timer"),
    id: z.string().optional(),
    title: z.string().optional(),
    mode: z.enum(["compact", "full"]).default("compact"),
    taskClientId: z.string().optional(),
  }),
  z.object({
    type: z.literal("day_review"),
    id: z.string().optional(),
    title: z.string().optional(),
    mode: z.enum(["compact", "full"]).default("full"),
  }),
  z.object({
    type: z.literal("progress"),
    id: z.string().optional(),
    title: z.string().optional(),
    range: z.enum(["daily", "weekly"]),
  }),
  z.object({
    type: z.literal("daily_targets"),
    id: z.string().optional(),
    title: z.string().optional(),
  }),
]);

export type WorkspaceUiBlock = z.infer<typeof workspaceUiBlockSchema>;

export const workspaceUiActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("navigate"),
    to: workspaceRouteSchema,
    reason: z.string().min(1).max(240),
  }),
  z.object({
    type: z.literal("focus_task"),
    clientId: z.string().min(1),
    reason: z.string().min(1).max(240),
  }),
  z.object({
    type: z.literal("show_block"),
    block: workspaceUiBlockSchema,
    reason: z.string().min(1).max(240),
  }),
]);

export type WorkspaceUiAction = z.infer<typeof workspaceUiActionSchema>;

export type AssistantCapability = {
  name: string;
  executor: "backend" | "frontend";
  confirmation: "never" | "single-safe-action" | "always";
  skillPath: string;
  description: string;
};

export const ASSISTANT_CAPABILITIES = [
  {
    name: "create_tasks",
    executor: "backend",
    confirmation: "single-safe-action",
    skillPath: "src/server/assistant/skills/create-tasks.SKILL.md",
    description: "Create one or more tasks in the workspace tree under category roots.",
  },
  {
    name: "query_tasks",
    executor: "backend",
    confirmation: "never",
    skillPath: "src/server/assistant/skills/query-tasks.SKILL.md",
    description: "Read tasks using structured filters and return a result card.",
  },
  {
    name: "navigate_workspace",
    executor: "frontend",
    confirmation: "never",
    skillPath: "src/server/assistant/skills/navigate-workspace.SKILL.md",
    description: "Move the visible workspace to the route where the user can inspect and edit the result.",
  },
  {
    name: "focus_task",
    executor: "frontend",
    confirmation: "never",
    skillPath: "src/server/assistant/skills/focus-task.SKILL.md",
    description: "Focus an existing editable task row in the main tree.",
  },
  {
    name: "show_timer",
    executor: "frontend",
    confirmation: "never",
    skillPath: "src/server/assistant/skills/show-timer.SKILL.md",
    description: "Render a live timer tool inside chat.",
  },
] as const satisfies AssistantCapability[];

export function blockForRoute(route: z.infer<typeof workspaceRouteSchema>): WorkspaceUiBlock {
  if (route === "/workspace/today") return { type: "task_tree", view: "today", title: "Today" };
  if (route === "/workspace/tomorrow") return { type: "task_tree", view: "tomorrow", title: "Tomorrow" };
  if (route === "/workspace/this-week") return { type: "task_tree", view: "this_week", title: "This Week" };
  if (route === "/workspace/day-review") return { type: "day_review", mode: "full", title: "Day Review" };
  if (route === "/workspace/progress") return { type: "progress", range: "daily", title: "Progress" };
  return { type: "task_tree", view: "all", title: "Workspace" };
}

export function blockForDateRange(dateRange: "today" | "tomorrow" | "this_week" | "last_7_days" | "this_month" | null): WorkspaceUiBlock {
  if (dateRange === "today") return { type: "task_tree", view: "today", title: "Today" };
  if (dateRange === "tomorrow") return { type: "task_tree", view: "tomorrow", title: "Tomorrow" };
  if (dateRange === "this_week") return { type: "task_tree", view: "this_week", title: "This Week" };
  return { type: "task_tree", view: "all", title: "Workspace" };
}

export function routeForDateRange(dateRange: "today" | "tomorrow" | "this_week" | "last_7_days" | "this_month" | null) {
  if (dateRange === "today") return "/workspace/today";
  if (dateRange === "tomorrow") return "/workspace/tomorrow";
  if (dateRange === "this_week") return "/workspace/this-week";
  return "/workspace/all-tasks";
}

export function routeForDueDate(input: {
  dueDate: string | null;
  todayDate: string;
  tomorrowDate: string;
}) {
  if (input.dueDate === input.todayDate) return "/workspace/today";
  if (input.dueDate === input.tomorrowDate) return "/workspace/tomorrow";
  return "/workspace/all-tasks";
}
