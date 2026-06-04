import { z } from "zod";
import {
  createRecurrenceAssistantResultFromSchedule,
  summarizeRecurrenceSchedule,
  type RecurrenceAssistantResult,
  type RecurrenceAssistantSchedule,
} from "@/features/recurrence/recurrenceAssistant";

type LlmProvider = "openai" | "kimi" | "custom";

type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  jsonMode: boolean;
};

export type RecurrenceLlmMetadata = {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  usedJsonMode: boolean;
  rawContent?: string;
  error?: string;
};

export type RecurrenceLlmResolution = {
  result: RecurrenceAssistantResult | null;
  metadata: RecurrenceLlmMetadata;
};

const recurrenceScheduleSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }),
  z.object({
    mode: z.literal("daily"),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
    interval: z.number().int().positive().optional(),
  }),
  z.object({
    mode: z.literal("daily_quota"),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
    targetCount: z.number().int().positive(),
    comparator: z.literal("at_least").optional(),
  }),
  z.object({
    mode: z.literal("weekdays"),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
  }),
  z.object({
    mode: z.literal("weekly"),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
    interval: z.number().int().positive().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  }),
  z.object({
    mode: z.literal("weekly_quota"),
    startDate: z.string(),
    endDate: z.string().nullable().optional(),
    targetCount: z.number().int().positive(),
    comparator: z.literal("at_least").optional(),
  }),
]);

const llmResponseSchema = z.object({
  schedule: recurrenceScheduleSchema.nullable(),
  message: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const FALLBACK_SUGGESTIONS = [
  "Every weekday",
  "Every Monday",
  "Every other Friday",
  "At least 3 days a week",
  "8 times a day",
  "Until the end of June",
];

const RECURRENCE_SYSTEM_PROMPT = [
  "You convert natural-language task recurrence requests into strict JSON for Plan My Workday.",
  "Return only one JSON object. Do not include markdown, prose, comments, or code fences.",
  "Supported schedule modes only:",
  "- none",
  "- daily: { mode, startDate, endDate?, interval? }",
  "- weekdays: { mode, startDate, endDate? }",
  "- weekly: { mode, startDate, endDate?, interval?, weekdays? } where weekdays use Sunday=0 through Saturday=6",
  "- daily_quota: { mode, startDate, endDate?, targetCount, comparator: \"at_least\" }",
  "- weekly_quota: { mode, startDate, endDate?, targetCount, comparator: \"at_least\" }",
  "If the request asks for monthly, yearly, calendar-specific exceptions, or anything unsupported, return schedule:null with a short message.",
  "Use YYYY-MM-DD dates. Use the supplied todayDate and existingSchedule context for relative or follow-up requests.",
  "For phrases like 'at least 3 days a week', use weekly_quota. For phrases like '8 times a day', use daily_quota.",
  "If the user gives a loose target count with no period, such as 'do it like 3 times at least', prefer weekly_quota unless the wording strongly implies daily.",
  "Output shape: { \"schedule\": <schedule-or-null>, \"message\": \"short human message\", \"confidence\": 0.0-1.0 }",
].join("\n");

function envFlagDisabled(value: string | undefined) {
  return value === "0" || value?.toLowerCase() === "false";
}

function normalizeProvider(value: string | undefined): LlmProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "openai" || normalized === "kimi" || normalized === "custom") return normalized;
  return null;
}

function inferProvider() {
  const configured = normalizeProvider(process.env.PLANMYWORKDAY_LLM_PROVIDER);
  if (configured) return configured;
  if (process.env.PLANMYWORKDAY_LLM_BASE_URL) return "custom";
  if (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) return "kimi";
  return "openai";
}

function getApiKey(provider: LlmProvider) {
  if (process.env.PLANMYWORKDAY_LLM_API_KEY) return process.env.PLANMYWORKDAY_LLM_API_KEY;
  if (provider === "kimi") return process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY ?? "";
  return process.env.OPENAI_API_KEY ?? process.env.KIMI_API_KEY ?? process.env.MOONSHOT_API_KEY ?? "";
}

function getBaseUrl(provider: LlmProvider) {
  if (process.env.PLANMYWORKDAY_LLM_BASE_URL) return process.env.PLANMYWORKDAY_LLM_BASE_URL;
  if (provider === "kimi") return "https://api.moonshot.ai/v1";
  return "https://api.openai.com/v1";
}

function getModel(provider: LlmProvider) {
  if (process.env.PLANMYWORKDAY_LLM_MODEL) return process.env.PLANMYWORKDAY_LLM_MODEL;
  if (provider === "kimi") return process.env.KIMI_MODEL ?? process.env.MOONSHOT_MODEL ?? "moonshot-v1-8k";
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

function getTimeoutMs() {
  const configured = Number.parseInt(process.env.PLANMYWORKDAY_LLM_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured)) return 12_000;
  return Math.min(Math.max(configured, 1_000), 60_000);
}

function getLlmConfig(): LlmConfig | null {
  if (envFlagDisabled(process.env.PLANMYWORKDAY_LLM_ENABLED)) return null;
  if (envFlagDisabled(process.env.PLANMYWORKDAY_LLM_DISABLED)) return null;

  const provider = inferProvider();
  const apiKey = getApiKey(provider).trim();
  if (!apiKey) return null;

  return {
    provider,
    apiKey,
    baseUrl: getBaseUrl(provider).replace(/\/+$/, ""),
    model: getModel(provider),
    timeoutMs: getTimeoutMs(),
    jsonMode: !envFlagDisabled(process.env.PLANMYWORKDAY_LLM_JSON_MODE),
  };
}

export function isRecurrenceLlmConfigured() {
  return getLlmConfig() !== null;
}

function metadataForConfig(config: LlmConfig, usedJsonMode: boolean): RecurrenceLlmMetadata {
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    usedJsonMode,
  };
}

function buildUserPrompt(input: {
  prompt: string;
  todayDate?: string;
  initialStartDate?: string | null;
  existingSchedule?: RecurrenceAssistantSchedule | null;
}) {
  return JSON.stringify({
    prompt: input.prompt,
    todayDate: input.todayDate,
    initialStartDate: input.initialStartDate ?? null,
    existingSchedule: input.existingSchedule ?? null,
    existingSummary: input.existingSchedule ? summarizeRecurrenceSchedule(input.existingSchedule) : "No repeat",
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
      { role: "system", content: RECURRENCE_SYSTEM_PROMPT },
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

function resultFromLlmContent(content: string): RecurrenceAssistantResult | null {
  const parsed = llmResponseSchema.safeParse(extractJsonObject(content));
  if (!parsed.success) return null;

  if (!parsed.data.schedule) {
    return {
      ok: false,
      message: parsed.data.message?.trim() || "That repeat pattern is not supported yet.",
      suggestions: FALLBACK_SUGGESTIONS,
    };
  }

  return createRecurrenceAssistantResultFromSchedule(parsed.data.schedule);
}

export async function resolveRecurrencePromptWithLlm(input: {
  prompt: string;
  todayDate?: string;
  initialStartDate?: string | null;
  existingSchedule?: RecurrenceAssistantSchedule | null;
}): Promise<RecurrenceLlmResolution | null> {
  const config = getLlmConfig();
  if (!config) return null;

  const userPrompt = buildUserPrompt(input);
  let usedJsonMode = config.jsonMode;
  let rawContent: string | undefined;

  try {
    try {
      rawContent = await postChatCompletion(config, userPrompt, config.jsonMode);
    } catch (error) {
      if (!config.jsonMode || !shouldRetryWithoutJsonMode(error)) throw error;
      usedJsonMode = false;
      rawContent = await postChatCompletion(config, userPrompt, false);
    }

    return {
      result: resultFromLlmContent(rawContent),
      metadata: {
        ...metadataForConfig(config, usedJsonMode),
        rawContent: rawContent.slice(0, 4000),
      },
    };
  } catch (error) {
    return {
      result: null,
      metadata: {
        ...metadataForConfig(config, usedJsonMode),
        rawContent,
        error: error instanceof Error ? error.message : "Unknown LLM error",
      },
    };
  }
}
