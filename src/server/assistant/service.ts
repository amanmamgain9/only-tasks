import { z } from "zod";
import {
  parseRecurrencePrompt,
  summarizeRecurrenceSchedule,
  type RecurrenceAssistantResult,
  type RecurrenceAssistantSchedule,
} from "@/features/recurrence/recurrenceAssistant";
import { isRecurrenceLlmConfigured, resolveRecurrencePromptWithLlm, type RecurrenceLlmMetadata } from "@/server/assistant/llm";
import { sqlite } from "@/server/db/client";
import * as taskRepo from "@/server/tasks/repository";
import { recurrenceScheduleFromStoredSeries } from "@/server/tasks/recurrence";
import { getLatestDraftSchedule, selectRecurrenceAssistantResult } from "./resultSelection";

const TASK_RECURRENCE_SURFACE = "task_recurrence";
const LLM_USER_WINDOW_MS = 15 * 60 * 1000;
const LLM_THREAD_WINDOW_MS = 5 * 60 * 1000;
const LLM_USER_WINDOW_LIMIT = 30;
const LLM_THREAD_WINDOW_LIMIT = 10;

const assistantRoleSchema = z.enum(["assistant", "user", "system"]);

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

export type AssistantThreadDTO = {
  id: number;
  surface: string;
  entityType: string | null;
  entityId: number | null;
  entityClientId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssistantMessageDTO = {
  id: number;
  threadId: number;
  role: "assistant" | "user" | "system";
  content: string;
  structuredPayload: unknown | null;
  createdAt: string;
};

export type RecurrenceAssistantThreadDTO = {
  thread: AssistantThreadDTO;
  messages: AssistantMessageDTO[];
  latestResult: RecurrenceAssistantResult | null;
  currentRecurrence: RecurrenceAssistantSchedule | null;
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

function toThreadDTO(row: AssistantThreadRow): AssistantThreadDTO {
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

function sanitizeLlmMetadataForClient(metadata: RecurrenceLlmMetadata | null | undefined) {
  if (!metadata) return null;

  return {
    provider: metadata.provider,
    model: metadata.model,
    usedJsonMode: metadata.usedJsonMode,
    status: metadata.error ? "error" : "ok",
  };
}

function sanitizeStructuredPayloadForClient(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const candidate = payload as { type?: unknown; llm?: RecurrenceLlmMetadata | null };
  if (candidate.type !== "recurrence_assistant_result") return payload;

  return {
    ...candidate,
    llm: sanitizeLlmMetadataForClient(candidate.llm),
  };
}

function toMessageDTO(row: AssistantMessageRow): AssistantMessageDTO {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: assistantRoleSchema.parse(row.role),
    content: row.content,
    structuredPayload: sanitizeStructuredPayloadForClient(parsePayload(row.structured_payload)),
    createdAt: row.created_at,
  };
}

function findActiveThread(input: {
  userId: number;
  surface: string;
  entityType: string;
  entityClientId: string;
}) {
  return sqlite
    .prepare(
      `SELECT *
       FROM pmwd_assistant_threads
       WHERE user_id = @userId
         AND surface = @surface
         AND entity_type = @entityType
         AND entity_client_id = @entityClientId
         AND status = 'active'
       LIMIT 1`,
    )
    .get(input) as AssistantThreadRow | undefined;
}

function isSqliteUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

function createThread(input: {
  userId: number;
  surface: string;
  entityType: string;
  entityId: number | null;
  entityClientId: string;
  title: string;
  now: string;
}) {
  let result: { lastInsertRowid: number | bigint };
  try {
    result = sqlite
      .prepare(
        `INSERT INTO pmwd_assistant_threads
         (user_id, surface, entity_type, entity_id, entity_client_id, status, title, created_at, updated_at)
         VALUES (@userId, @surface, @entityType, @entityId, @entityClientId, 'active', @title, @now, @now)`,
      )
      .run(input);
  } catch (error) {
    if (!isSqliteUniqueConstraintError(error)) throw error;

    const existing = findActiveThread(input);
    if (existing) return existing;
    throw error;
  }

  return sqlite
    .prepare("SELECT * FROM pmwd_assistant_threads WHERE id = ? LIMIT 1")
    .get(Number(result.lastInsertRowid)) as AssistantThreadRow;
}

function updateThreadTimestamp(threadId: number, now: string) {
  sqlite
    .prepare("UPDATE pmwd_assistant_threads SET updated_at = ? WHERE id = ?")
    .run(now, threadId);
}

function getOrCreateThread(input: {
  userId: number;
  surface: string;
  entityType: string;
  entityId: number | null;
  entityClientId: string;
  title: string;
}) {
  const existing = findActiveThread(input);
  if (existing) return existing;

  return createThread({
    ...input,
    now: new Date().toISOString(),
  });
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

function updateMessageContent(input: {
  messageId: number;
  threadId: number;
  userId: number;
  content: string;
  structuredPayload?: unknown;
}) {
  sqlite
    .prepare(
      `UPDATE pmwd_assistant_messages
       SET content = @content,
           structured_payload = @structuredPayload
       WHERE id = @messageId
         AND thread_id = @threadId
         AND user_id = @userId`,
    )
    .run({
      ...input,
      structuredPayload: serializePayload(input.structuredPayload),
    });
}

function findLatestRecurrenceResult(messages: AssistantMessageDTO[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const payload = messages[index]?.structuredPayload;
    if (!payload || typeof payload !== "object") continue;
    const candidate = payload as { type?: unknown; result?: unknown };
    if (candidate.type !== "recurrence_assistant_result") continue;
    const result = candidate.result as RecurrenceAssistantResult;
    if (result && typeof result === "object" && "ok" in result) return result;
  }
  return null;
}

function resultToAssistantContent(result: RecurrenceAssistantResult) {
  if (!result.ok) return result.message;
  return result.draft.summary;
}

async function getTaskForAssistant(userId: number, taskClientId: string) {
  const task = await taskRepo.getTaskByClientId(taskClientId);
  if (!task || task.userId !== userId) {
    throw new Error("Task not found.");
  }
  return task;
}

async function getCurrentTaskRecurrence(userId: number, taskClientId: string) {
  const task = await getTaskForAssistant(userId, taskClientId);
  if (task.recurrenceRole === "occurrence_root" || task.recurrenceRole === "occurrence_child") {
    throw new Error("Edit the recurring template, not a generated occurrence.");
  }
  if (task.recurrenceRole !== "template") {
    return { task, currentRecurrence: null as RecurrenceAssistantSchedule | null };
  }

  const [series] = await taskRepo.findActiveRecurrenceSeriesByTemplateIds(userId, [task.id]);
  if (!series) return { task, currentRecurrence: null as RecurrenceAssistantSchedule | null };

  return {
    task,
    currentRecurrence: recurrenceScheduleFromStoredSeries({
      rule: series.rule,
      startDate: series.startDate,
      endDate: series.endDate,
    }) as RecurrenceAssistantSchedule,
  };
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

function reserveRecurrenceLlmUsage(input: {
  userId: number;
  threadId: number;
  prompt: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const userSince = new Date(nowMs - LLM_USER_WINDOW_MS).toISOString();
  const threadSince = new Date(nowMs - LLM_THREAD_WINDOW_MS).toISOString();

  return sqlite.transaction(() => {
    const userCount = countRecentLlmUsage({
      userId: input.userId,
      surface: TASK_RECURRENCE_SURFACE,
      since: userSince,
    });
    if (userCount >= LLM_USER_WINDOW_LIMIT) return false;

    const threadCount = countRecentLlmUsage({
      threadId: input.threadId,
      since: threadSince,
    });
    if (threadCount >= LLM_THREAD_WINDOW_LIMIT) return false;

    sqlite
      .prepare(
        `INSERT INTO pmwd_assistant_llm_usage
         (user_id, thread_id, surface, prompt_chars, created_at)
         VALUES (@userId, @threadId, @surface, @promptChars, @createdAt)`,
      )
      .run({
        userId: input.userId,
        threadId: input.threadId,
        surface: TASK_RECURRENCE_SURFACE,
        promptChars: input.prompt.length,
        createdAt: nowIso,
      });
    return true;
  })();
}

function isUntouchedRecurrenceStarter(messages: AssistantMessageDTO[]) {
  if (messages.length !== 1) return false;
  const [message] = messages;
  if (message.role !== "assistant") return false;
  const payload = message.structuredPayload;
  if (!payload || typeof payload !== "object") return false;
  return (payload as { type?: unknown }).type === "recurrence_assistant_context";
}

function initialRecurrenceAssistantContent(currentRecurrence: RecurrenceAssistantSchedule | null) {
  if (currentRecurrence && currentRecurrence.mode !== "none") {
    return `This task already repeats: ${summarizeRecurrenceSchedule(currentRecurrence)}. Tell me what should change. For example: "move it to Mondays", "make it weekdays only", or "stop repeating".`;
  }

  return 'Tell me how this should repeat. Write it naturally, like "every weekday", "every Monday morning", "every other Friday", or "keep repeating until the end of June".';
}

export async function getRecurrenceAssistantThread(input: {
  userId: number;
  taskClientId: string;
}): Promise<RecurrenceAssistantThreadDTO> {
  const { task, currentRecurrence } = await getCurrentTaskRecurrence(input.userId, input.taskClientId);
  const thread = getOrCreateThread({
    userId: input.userId,
    surface: TASK_RECURRENCE_SURFACE,
    entityType: "task",
    entityId: task.id,
    entityClientId: input.taskClientId,
    title: `Repeat: ${task.title || "Task"}`,
  });
  let messages = listMessages(thread.id);

  if (messages.length === 0) {
    const now = new Date().toISOString();
    insertMessage({
      threadId: thread.id,
      userId: input.userId,
      role: "assistant",
      content: initialRecurrenceAssistantContent(currentRecurrence),
      structuredPayload: {
        type: "recurrence_assistant_context",
        currentRecurrence,
      },
      now,
    });
    updateThreadTimestamp(thread.id, now);
    messages = listMessages(thread.id);
  } else if (isUntouchedRecurrenceStarter(messages)) {
    const now = new Date().toISOString();
    updateMessageContent({
      messageId: messages[0].id,
      threadId: thread.id,
      userId: input.userId,
      content: initialRecurrenceAssistantContent(currentRecurrence),
      structuredPayload: {
        type: "recurrence_assistant_context",
        currentRecurrence,
      },
    });
    updateThreadTimestamp(thread.id, now);
    messages = listMessages(thread.id);
  }

  return {
    thread: toThreadDTO(thread),
    messages,
    latestResult: findLatestRecurrenceResult(messages),
    currentRecurrence,
  };
}

export async function submitRecurrenceAssistantMessage(input: {
  userId: number;
  taskClientId: string;
  prompt: string;
  todayDate?: string;
  initialStartDate?: string | null;
}): Promise<RecurrenceAssistantThreadDTO> {
  const parsedPrompt = z.string().trim().min(1).max(1000).parse(input.prompt);
  const existingThread = await getRecurrenceAssistantThread({
    userId: input.userId,
    taskClientId: input.taskClientId,
  });
  const latestDraftSchedule = getLatestDraftSchedule(existingThread.messages);
  const recurrenceContext = latestDraftSchedule ?? existingThread.currentRecurrence;
  const llmResolution = isRecurrenceLlmConfigured() && reserveRecurrenceLlmUsage({
    userId: input.userId,
    threadId: existingThread.thread.id,
    prompt: parsedPrompt,
  })
    ? await resolveRecurrencePromptWithLlm({
      prompt: parsedPrompt,
      todayDate: input.todayDate,
      initialStartDate: input.initialStartDate,
      existingSchedule: recurrenceContext,
    })
    : null;
  const deterministicResult = parseRecurrencePrompt(parsedPrompt, {
    todayDate: input.todayDate,
    initialStartDate: input.initialStartDate,
    existingSchedule: recurrenceContext,
  });
  const result = selectRecurrenceAssistantResult({
    deterministicResult,
    llmResult: llmResolution?.result,
  });
  const resultSource = llmResolution?.result?.ok
    ? "llm"
    : llmResolution
      ? "deterministic_fallback_after_llm"
      : "deterministic";
  const now = new Date().toISOString();

  sqlite.transaction(() => {
    insertMessage({
      threadId: existingThread.thread.id,
      userId: input.userId,
      role: "user",
      content: parsedPrompt,
      structuredPayload: {
        type: "recurrence_user_prompt",
        prompt: parsedPrompt,
      },
      now,
    });
    insertMessage({
      threadId: existingThread.thread.id,
      userId: input.userId,
      role: "assistant",
      content: resultToAssistantContent(result),
      structuredPayload: {
        type: "recurrence_assistant_result",
        result,
        source: resultSource,
        llm: sanitizeLlmMetadataForClient(llmResolution?.metadata),
      },
      now,
    });
    updateThreadTimestamp(existingThread.thread.id, now);
  })();

  const messages = listMessages(existingThread.thread.id);
  return {
    thread: existingThread.thread,
    messages,
    latestResult: result,
    currentRecurrence: existingThread.currentRecurrence,
  };
}
