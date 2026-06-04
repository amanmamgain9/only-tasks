import { afterEach, describe, expect, test, vi } from "vitest";
import { isRecurrenceLlmConfigured, resolveRecurrencePromptWithLlm } from "./llm";

const LLM_ENV_KEYS = [
  "PLANMYWORKDAY_LLM_API_KEY",
  "PLANMYWORKDAY_LLM_BASE_URL",
  "PLANMYWORKDAY_LLM_DISABLED",
  "PLANMYWORKDAY_LLM_ENABLED",
  "PLANMYWORKDAY_LLM_JSON_MODE",
  "PLANMYWORKDAY_LLM_MODEL",
  "PLANMYWORKDAY_LLM_PROVIDER",
  "PLANMYWORKDAY_LLM_TIMEOUT_MS",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "KIMI_API_KEY",
  "KIMI_MODEL",
  "MOONSHOT_API_KEY",
  "MOONSHOT_MODEL",
];

const originalFetch = globalThis.fetch;

function clearLlmEnv() {
  for (const key of LLM_ENV_KEYS) delete process.env[key];
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  clearLlmEnv();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("recurrence LLM client", () => {
  test("stays disabled when no provider key is configured", async () => {
    clearLlmEnv();

    expect(isRecurrenceLlmConfigured()).toBe(false);
    await expect(resolveRecurrencePromptWithLlm({
      prompt: "every weekday",
      todayDate: "2026-06-03",
    })).resolves.toBeNull();
  });

  test("turns OpenAI-compatible JSON into a validated recurrence result", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    process.env.PLANMYWORKDAY_LLM_MODEL = "test-model";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            schedule: {
              mode: "weekly_quota",
              startDate: "2026-06-03",
              endDate: null,
              targetCount: 3,
              comparator: "at_least",
            },
            message: "At least three times a week.",
            confidence: 0.95,
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveRecurrencePromptWithLlm({
      prompt: "at least 3 days a week",
      todayDate: "2026-06-03",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(init.body as string) as {
      model: string;
      response_format?: unknown;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("test-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content).toContain('"prompt": "at least 3 days a week"');
    expect(resolution?.metadata).toMatchObject({
      provider: "openai",
      model: "test-model",
      usedJsonMode: true,
    });
    expect(resolution?.result).toEqual({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekly_quota",
          startDate: "2026-06-03",
          endDate: null,
          targetCount: 3,
          comparator: "at_least",
        },
        summary: "At least 3 times per week starting Jun 3, 2026",
        previewDates: [],
      },
    });
  });

  test("can use Kimi through the Moonshot OpenAI-compatible endpoint", async () => {
    clearLlmEnv();
    process.env.KIMI_API_KEY = "kimi-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            schedule: {
              mode: "daily_quota",
              startDate: "2026-06-03",
              targetCount: 8,
              comparator: "at_least",
            },
            message: "Eight times a day.",
            confidence: 0.9,
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveRecurrencePromptWithLlm({
      prompt: "drink water eight times a day",
      todayDate: "2026-06-03",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { model: string };
    expect(url).toBe("https://api.moonshot.ai/v1/chat/completions");
    expect(body.model).toBe("moonshot-v1-8k");
    expect(resolution?.metadata.provider).toBe("kimi");
    expect(resolution?.result).toMatchObject({
      ok: true,
      draft: {
        recurrence: {
          mode: "daily_quota",
          targetCount: 8,
        },
      },
    });
  });

  test("retries without JSON mode for providers that reject response_format", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("response_format is not supported", { status: 400 }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              schedule: {
                mode: "weekdays",
                startDate: "2026-06-03",
              },
              message: "Every weekday.",
              confidence: 0.9,
            }),
          },
        }],
      }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveRecurrencePromptWithLlm({
      prompt: "every weekday",
      todayDate: "2026-06-03",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as { response_format?: unknown };
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string) as { response_format?: unknown };
    expect(firstBody.response_format).toEqual({ type: "json_object" });
    expect(secondBody.response_format).toBeUndefined();
    expect(resolution?.metadata.usedJsonMode).toBe(false);
    expect(resolution?.result).toMatchObject({
      ok: true,
      draft: {
        recurrence: {
          mode: "weekdays",
          startDate: "2026-06-03",
        },
      },
    });
  });
});
