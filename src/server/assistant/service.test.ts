import { describe, expect, test } from "vitest";
import type { RecurrenceAssistantResult } from "@/features/recurrence/recurrenceAssistant";
import { getLatestDraftSchedule, selectRecurrenceAssistantResult, type AssistantMessageDTO } from "./service";

describe("assistant service", () => {
  test("does not let an LLM rejection override a deterministic draft", () => {
    const deterministicResult: RecurrenceAssistantResult = {
      ok: true,
      draft: {
        recurrence: { mode: "weekdays", startDate: "2026-06-03" },
        summary: "Every weekday starting Jun 3, 2026",
        previewDates: [],
      },
    };

    expect(selectRecurrenceAssistantResult({
      deterministicResult,
      llmResult: {
        ok: false,
        message: "That repeat pattern is not supported yet.",
        suggestions: [],
      },
    })).toBe(deterministicResult);
  });

  test("keeps the latest valid recurrence draft after a failed assistant turn", () => {
    const messages: AssistantMessageDTO[] = [
      {
        id: 1,
        threadId: 1,
        role: "assistant",
        content: "Every weekday starting Jun 3, 2026",
        structuredPayload: {
          type: "recurrence_assistant_result",
          result: {
            ok: true,
            draft: {
              recurrence: { mode: "weekdays", startDate: "2026-06-03", endDate: null },
              summary: "Every weekday starting Jun 3, 2026",
              previewDates: [],
            },
          },
        },
        createdAt: "2026-06-03T10:00:00.000Z",
      },
      {
        id: 2,
        threadId: 1,
        role: "assistant",
        content: "I could not find a repeat pattern.",
        structuredPayload: {
          type: "recurrence_assistant_result",
          result: {
            ok: false,
            message: "I could not find a daily, weekday, or weekly repeat pattern.",
            suggestions: [],
          },
        },
        createdAt: "2026-06-03T10:01:00.000Z",
      },
    ];

    expect(getLatestDraftSchedule(messages)).toEqual({
      mode: "weekdays",
      startDate: "2026-06-03",
      endDate: null,
    });
  });
});
