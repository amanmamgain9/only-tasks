import { z } from "zod";

export const workspaceRouteSchema = z.enum([
  "/workspace/all-tasks",
  "/workspace/today",
  "/workspace/tomorrow",
  "/workspace/this-week",
  "/workspace/day-review",
  "/workspace/progress",
]);

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
] as const satisfies AssistantCapability[];

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
