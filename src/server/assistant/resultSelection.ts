import { z } from "zod";
import type {
  RecurrenceAssistantResult,
  RecurrenceAssistantSchedule,
} from "@/features/recurrence/recurrenceAssistant";

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

export type AssistantMessageWithPayload = {
  structuredPayload: unknown | null;
};

function isHardDeterministicRejection(result: RecurrenceAssistantResult) {
  return !result.ok && result.message !== "I could not find a daily, weekday, or weekly repeat pattern.";
}

export function selectRecurrenceAssistantResult(input: {
  deterministicResult: RecurrenceAssistantResult;
  llmResult: RecurrenceAssistantResult | null | undefined;
}) {
  if (isHardDeterministicRejection(input.deterministicResult)) return input.deterministicResult;
  if (input.llmResult?.ok) return input.llmResult;
  return input.deterministicResult;
}

export function getLatestDraftSchedule(messages: AssistantMessageWithPayload[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const payload = messages[index]?.structuredPayload;
    if (!payload || typeof payload !== "object") continue;
    const candidate = payload as { type?: unknown; result?: unknown };
    if (candidate.type !== "recurrence_assistant_result") continue;
    const result = candidate.result as RecurrenceAssistantResult;
    if (result?.ok) {
      return recurrenceScheduleSchema.parse(result.draft.recurrence) as RecurrenceAssistantSchedule;
    }
  }
  return null;
}
