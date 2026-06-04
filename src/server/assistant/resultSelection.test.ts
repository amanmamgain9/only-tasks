import { describe, expect, test } from "vitest";
import type { RecurrenceAssistantResult } from "@/features/recurrence/recurrenceAssistant";
import {
  getLatestDraftSchedule,
  selectRecurrenceAssistantResult,
  shouldAttemptRecurrenceLlm,
  type AssistantMessageWithPayload,
} from "./resultSelection";

describe("recurrence assistant result selection", () => {
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

  test("does not let an LLM draft override a deterministic draft", () => {
    const deterministicResult: RecurrenceAssistantResult = {
      ok: true,
      draft: {
        recurrence: { mode: "weekdays", startDate: "2026-06-03" },
        summary: "Every weekday starting Jun 3, 2026",
        previewDates: [],
      },
    };
    const llmResult: RecurrenceAssistantResult = {
      ok: true,
      draft: {
        recurrence: { mode: "weekly", startDate: "2026-06-03", weekdays: [1] },
        summary: "Every Monday starting Jun 3, 2026",
        previewDates: [],
      },
    };

    expect(selectRecurrenceAssistantResult({
      deterministicResult,
      llmResult,
    })).toBe(deterministicResult);
  });

  test("does not let the LLM override deterministic hard quota rejections", () => {
    const deterministicResult: RecurrenceAssistantResult = {
      ok: false,
      message: "Exact repeat targets are not supported yet. Use an at-least target instead.",
      suggestions: [],
    };
    const llmResult: RecurrenceAssistantResult = {
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly_quota",
          startDate: "2026-06-03",
          targetCount: 3,
          comparator: "at_least",
        },
        summary: "At least 3 times per week starting Jun 3, 2026",
        previewDates: [],
      },
    };

    expect(selectRecurrenceAssistantResult({
      deterministicResult,
      llmResult,
    })).toBe(deterministicResult);
  });

  test("only lets the LLM rescue generic parser misses", () => {
    const genericMiss: RecurrenceAssistantResult = {
      ok: false,
      message: "I could not find a daily, weekday, or weekly repeat pattern.",
      suggestions: [],
    };
    const monthlyRejection: RecurrenceAssistantResult = {
      ok: false,
      message: "Monthly and yearly repeats are not supported by the current recurrence engine yet.",
      suggestions: [],
    };
    const llmResult: RecurrenceAssistantResult = {
      ok: true,
      draft: {
        recurrence: { mode: "daily", startDate: "2026-06-03", interval: 1 },
        summary: "Every day starting Jun 3, 2026",
        previewDates: [],
      },
    };

    expect(selectRecurrenceAssistantResult({
      deterministicResult: genericMiss,
      llmResult,
    })).toBe(llmResult);
    expect(selectRecurrenceAssistantResult({
      deterministicResult: monthlyRejection,
      llmResult,
    })).toBe(monthlyRejection);
  });

  test("only attempts the LLM for generic parser misses", () => {
    expect(shouldAttemptRecurrenceLlm({
      ok: true,
      draft: {
        recurrence: { mode: "weekdays", startDate: "2026-06-03" },
        summary: "Every weekday starting Jun 3, 2026",
        previewDates: [],
      },
    })).toBe(false);

    expect(shouldAttemptRecurrenceLlm({
      ok: false,
      message: "Exact repeat targets are not supported yet. Use an at-least target instead.",
      suggestions: [],
    })).toBe(false);

    expect(shouldAttemptRecurrenceLlm({
      ok: false,
      message: "I could not find a daily, weekday, or weekly repeat pattern.",
      suggestions: [],
    })).toBe(true);
  });

  test("keeps the latest valid recurrence draft after a failed assistant turn", () => {
    const messages: AssistantMessageWithPayload[] = [
      {
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
      },
      {
        structuredPayload: {
          type: "recurrence_assistant_result",
          result: {
            ok: false,
            message: "I could not find a daily, weekday, or weekly repeat pattern.",
            suggestions: [],
          },
        },
      },
    ];

    expect(getLatestDraftSchedule(messages)).toEqual({
      mode: "weekdays",
      startDate: "2026-06-03",
      endDate: null,
    });
  });
});
