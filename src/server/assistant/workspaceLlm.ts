import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ASSISTANT_CAPABILITIES, workspaceRouteSchema } from "@/server/assistant/capabilities";
import {
  isLifestyleTraitId,
  isTaskCategoryId,
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  type LifestyleTraitAllocation,
  type TaskCategoryAllocation,
  type TaskCategoryId,
} from "@/features/categories/taskCategories";

type LlmProvider = "openai" | "kimi" | "custom";

type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  jsonMode: boolean;
};

export type WorkspaceLlmMetadata = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  usedJsonMode: boolean;
  error?: string;
};

export type WorkspaceAgentCommand =
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
  | {
      kind: "navigate_workspace";
      route: z.infer<typeof workspaceRouteSchema>;
      reason: string;
    }
  | {
      kind: "show_timer";
      mode: "compact" | "full";
      reason: string;
    }
  | {
      kind: "focus_task";
      clientId: string;
      reason: string;
    }
  | { kind: "finish"; message: string }
  | { kind: "unsupported"; reason: string };

export type WorkspaceLlmResolution = {
  command: WorkspaceAgentCommand | null;
  metadata: WorkspaceLlmMetadata;
};

const taskCategorySchema = z.custom<TaskCategoryId>(isTaskCategoryId);
const lifestyleTraitSchema = z.custom<"learning" | "health" | "social" | "hobby">(isLifestyleTraitId);

const allocationSchema = z.object({
  category: taskCategorySchema,
  weight: z.number().int().positive().max(100),
});

const lifestyleTraitAllocationSchema = z.object({
  trait: lifestyleTraitSchema,
  weight: z.number().int().positive().max(100),
});

function isValidDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function addDaysToDateKey(dateKey: string, days: number) {
  if (!isValidDateKey(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

const dateKeySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDateKey, "Invalid calendar date");

const llmTaskDraftSchema = z.object({
  title: z.string().trim().min(1).max(240),
  category: taskCategorySchema,
  categoryAllocations: z.array(allocationSchema).min(1).max(3).optional(),
  lifestyleTraits: z.array(lifestyleTraitAllocationSchema).max(4).optional(),
});

const llmCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create_tasks"),
    tasks: z.array(llmTaskDraftSchema).min(1).max(25),
    dueDate: dateKeySchema.nullable(),
  }),
  z.object({
    kind: z.literal("query_tasks"),
    category: taskCategorySchema.nullable().default(null),
    onlyOpen: z.boolean().default(false),
    onlyCompleted: z.boolean().default(false),
    dateRange: z.enum(["today", "tomorrow", "this_week", "last_7_days", "this_month"]).nullable().default(null),
    missed: z.boolean().default(false),
    rolledOver: z.boolean().default(false),
    postponed: z.boolean().default(false),
    searchText: z.string().trim().min(1).max(160).nullable().default(null),
  }),
  z.object({
    kind: z.literal("capabilities"),
  }),
  z.object({
    kind: z.literal("navigate_workspace"),
    route: workspaceRouteSchema,
    reason: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("show_timer"),
    mode: z.enum(["compact", "full"]).default("compact"),
    reason: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("focus_task"),
    clientId: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(240),
  }),
  z.object({
    kind: z.literal("finish"),
    message: z.string().trim().min(1).max(500),
  }),
  z.object({
    kind: z.literal("unsupported"),
    reason: z.string().trim().min(1).max(500),
  }),
]).superRefine((command, context) => {
  if (command.kind === "query_tasks" && command.onlyOpen && command.onlyCompleted) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "onlyOpen and onlyCompleted cannot both be true.",
      path: ["onlyCompleted"],
    });
  }
});

function envFlagFalse(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "0" || normalized === "false";
}

function envFlagTrue(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function normalizeProvider(value: string | undefined): LlmProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "openai" || normalized === "kimi" || normalized === "custom") return normalized;
  return null;
}

function readEnv(name: string) {
  return process.env[name];
}

function inferProvider() {
  if (readEnv("PLANMYWORKDAY_LLM_BASE_URL")) return "custom";
  const configured = normalizeProvider(readEnv("PLANMYWORKDAY_LLM_PROVIDER"));
  if (configured) return configured;
  if (readEnv("KIMI_API_KEY") || readEnv("MOONSHOT_API_KEY")) return "kimi";
  return "openai";
}

function getApiKey(provider: LlmProvider) {
  if (readEnv("PLANMYWORKDAY_LLM_API_KEY")) return readEnv("PLANMYWORKDAY_LLM_API_KEY") ?? "";
  if (provider === "kimi") return readEnv("KIMI_API_KEY") ?? readEnv("MOONSHOT_API_KEY") ?? "";
  if (provider === "openai") return readEnv("OPENAI_API_KEY") ?? "";
  return "";
}

function getBaseUrl(provider: LlmProvider) {
  if (readEnv("PLANMYWORKDAY_LLM_BASE_URL")) return readEnv("PLANMYWORKDAY_LLM_BASE_URL") ?? "";
  if (provider === "kimi") return "https://api.moonshot.ai/v1";
  if (provider === "custom") return "";
  return "https://api.openai.com/v1";
}

function getModel(provider: LlmProvider) {
  if (readEnv("PLANMYWORKDAY_LLM_MODEL")) return readEnv("PLANMYWORKDAY_LLM_MODEL") ?? "";
  if (provider === "kimi") return readEnv("KIMI_MODEL") ?? readEnv("MOONSHOT_MODEL") ?? "moonshot-v1-8k";
  return readEnv("OPENAI_MODEL") ?? "gpt-4o-mini";
}

function getTimeoutMs() {
  const configured = Number.parseInt(readEnv("PLANMYWORKDAY_LLM_TIMEOUT_MS") ?? "", 10);
  if (!Number.isFinite(configured)) return 12_000;
  return Math.min(Math.max(configured, 1_000), 60_000);
}

function getLlmConfig(): LlmConfig | null {
  if (envFlagFalse(readEnv("PLANMYWORKDAY_LLM_ENABLED"))) return null;
  if (envFlagTrue(readEnv("PLANMYWORKDAY_LLM_DISABLED"))) return null;

  const provider = inferProvider();
  const apiKey = getApiKey(provider).trim();
  if (!apiKey) return null;
  const baseUrl = getBaseUrl(provider).replace(/\/+$/, "");
  if (!baseUrl) return null;

  return {
    provider,
    apiKey,
    baseUrl,
    model: getModel(provider),
    timeoutMs: getTimeoutMs(),
    jsonMode: !envFlagFalse(readEnv("PLANMYWORKDAY_LLM_JSON_MODE")),
  };
}

export function isWorkspaceAgentLlmConfigured() {
  return getLlmConfig() !== null;
}

function metadataForConfig(config: LlmConfig, usedJsonMode: boolean): WorkspaceLlmMetadata {
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    usedJsonMode,
  };
}

function readSkill(skillPath: string) {
  const absolutePath = path.join(process.cwd(), skillPath);
  return fs.readFileSync(absolutePath, "utf8").trim();
}

function buildSkillPrompt() {
  return ASSISTANT_CAPABILITIES
    .map((capability) => [
      `## ${capability.name}`,
      `Executor: ${capability.executor}`,
      `Confirmation: ${capability.confirmation}`,
      `Description: ${capability.description}`,
      readSkill(capability.skillPath),
    ].join("\n"))
    .join("\n\n");
}

function buildSystemPrompt() {
  return [
    "You are the Plan My Workday workspace agent.",
    "Your job is to choose one app capability from the skills below and return exactly one strict JSON command.",
    "Return only JSON. Do not include markdown, prose, comments, or code fences.",
    "",
    "Product rule: the editable workspace tree is the source of truth. Prefer navigating/querying the real workspace over merely answering.",
    "Safety rule: never create tasks from vague or ambiguous text. If the user might be asking to view tasks, query tasks. If intent is unclear, return unsupported with a short clarification reason.",
    "Creation rule: create_tasks only when the user clearly asks to add/create/import/turn a list into tasks, or provides an explicit task list.",
    "Date rule: dueDate must be a real YYYY-MM-DD calendar date or null. Use defaultDueDateForNewTasks exactly when the route context should supply the date.",
    "Query rule: phrases like 'tasks today', 'today tasks', 'show my tasks', 'what is left', typoed please variants, or filtering requests must be query_tasks, not create_tasks.",
    "Loop rule: if observations show the user's request has been satisfied, return finish with a concise human message.",
    "Navigation rule: if the user only asks to open a workspace surface, use navigate_workspace.",
    "Timer rule: if the user asks to see or use a timer, use show_timer. Do not claim support for multiple independent timers or custom duration persistence yet.",
    "Focus rule: use focus_task only when observations or conversation context contain the exact clientId of the task to focus.",
    "",
    "Allowed categories:",
    "- job: Main Work/current job/client delivery",
    "- side_project: side projects, products, apps, income assets outside main job",
    "- chore: errands, tax, bills, filing, logistics, household/admin",
    "- lifestyle: learning, health, social, hobby overlap",
    "",
    "Allowed output shapes:",
    JSON.stringify({
      kind: "create_tasks",
      dueDate: "YYYY-MM-DD or null",
      tasks: [{
        title: "task title",
        category: "job | side_project | chore | lifestyle",
        categoryAllocations: [{ category: "side_project", weight: 100 }],
        lifestyleTraits: [{ trait: "learning | health | social | hobby", weight: 100 }],
      }],
    }),
    JSON.stringify({
      kind: "query_tasks",
      category: "job | side_project | chore | lifestyle | null",
      onlyOpen: true,
      onlyCompleted: false,
      dateRange: "today | tomorrow | this_week | last_7_days | this_month | null",
      missed: false,
      rolledOver: false,
      postponed: false,
      searchText: null,
    }),
    JSON.stringify({ kind: "capabilities" }),
    JSON.stringify({ kind: "navigate_workspace", route: "/workspace/today", reason: "Open today's editable task surface." }),
    JSON.stringify({ kind: "show_timer", mode: "compact", reason: "Show the live timer." }),
    JSON.stringify({ kind: "focus_task", clientId: "task-client-id-from-observations", reason: "Focus the matching editable task row." }),
    JSON.stringify({ kind: "finish", message: "Done." }),
    JSON.stringify({ kind: "unsupported", reason: "short reason or clarification" }),
    "",
    "Skills:",
    buildSkillPrompt(),
  ].join("\n");
}

function buildUserPrompt(input: {
  prompt: string;
  todayDate: string;
  currentView?: "today" | "tomorrow" | "this-week";
  observations?: unknown[];
}) {
  const defaultDueDate = input.currentView === "tomorrow"
    ? addDaysToDateKey(input.todayDate, 1)
    : input.todayDate;

  return JSON.stringify({
    prompt: input.prompt,
    todayDate: input.todayDate,
    currentView: input.currentView ?? null,
    observations: input.observations ?? [],
    defaultDueDateForNewTasks: defaultDueDate,
    routeHints: {
      today: "/workspace/today",
      tomorrow: "/workspace/tomorrow",
      this_week: "/workspace/this-week",
      broad_filters: "/workspace/all-tasks",
    },
  }, null, 2);
}

function extractJsonObject(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const startIndex = content.indexOf("{");
    const endIndex = content.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      throw new Error("The model response was not JSON.");
    }
    return JSON.parse(content.slice(startIndex, endIndex + 1)) as unknown;
  }
}

function getCompletionContent(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("The model response was empty.");
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("The model response did not include choices.");
  const [choice] = choices;
  const content = (choice as { message?: { content?: unknown } }).message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The model response did not include text content.");
  return content;
}

async function postChatCompletion(config: LlmConfig, userPrompt: string, useJsonMode: boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const body: Record<string, unknown> = {
    model: config.model,
    temperature: 0,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userPrompt },
    ],
  };

  if (useJsonMode) body.response_format = { type: "json_object" };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${errorText.slice(0, 500)}`);
    }

    return getCompletionContent(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetryWithoutJsonMode(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("response_format") || message.includes("json_object");
}

function normalizeCreateCommand(command: z.infer<typeof llmCommandSchema>): WorkspaceAgentCommand {
  if (command.kind !== "create_tasks") return command;

  return {
    kind: "create_tasks",
    dueDate: command.dueDate,
    tasks: command.tasks.map((task) => {
      const categoryAllocations = normalizeTaskCategoryAllocations(
        task.categoryAllocations ?? [{ category: task.category, weight: 100 }],
      );
      const primaryCategory = categoryAllocations[0]?.category ?? task.category;
      return {
        title: task.title,
        category: primaryCategory,
        categoryAllocations,
        lifestyleTraits: normalizeLifestyleTraitAllocations(task.lifestyleTraits ?? []),
      };
    }),
  };
}

function commandFromLlmContent(content: string): WorkspaceAgentCommand | null {
  const parsed = llmCommandSchema.safeParse(extractJsonObject(content));
  if (!parsed.success) return null;
  return normalizeCreateCommand(parsed.data);
}

export async function resolveWorkspaceAgentPromptWithLlm(input: {
  prompt: string;
  todayDate: string;
  currentView?: "today" | "tomorrow" | "this-week";
  observations?: unknown[];
}): Promise<WorkspaceLlmResolution | null> {
  const config = getLlmConfig();
  if (!config) return null;

  const userPrompt = buildUserPrompt(input);
  let usedJsonMode = config.jsonMode;

  try {
    let rawContent: string;
    try {
      rawContent = await postChatCompletion(config, userPrompt, config.jsonMode);
    } catch (error) {
      if (!config.jsonMode || !shouldRetryWithoutJsonMode(error)) throw error;
      usedJsonMode = false;
      rawContent = await postChatCompletion(config, userPrompt, false);
    }

    return {
      command: commandFromLlmContent(rawContent),
      metadata: metadataForConfig(config, usedJsonMode),
    };
  } catch (error) {
    return {
      command: null,
      metadata: {
        ...metadataForConfig(config, usedJsonMode),
        error: error instanceof Error ? error.message : "Unknown LLM error",
      },
    };
  }
}
