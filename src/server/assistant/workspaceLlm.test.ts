import { afterEach, describe, expect, test, vi } from "vitest";
import { routeForDateRange } from "./capabilities";
import { isWorkspaceAgentLlmConfigured, resolveWorkspaceAgentPromptWithLlm } from "./workspaceLlm";

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

describe("workspace agent LLM command resolver", () => {
  test("stays disabled when no provider key is configured", async () => {
    clearLlmEnv();

    expect(isWorkspaceAgentLlmConfigured()).toBe(false);
    await expect(resolveWorkspaceAgentPromptWithLlm({
      prompt: "tasks today please",
      todayDate: "2026-06-06",
    })).resolves.toBeNull();
  });

  test("sends skill instructions and accepts a today task query", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    process.env.PLANMYWORKDAY_LLM_MODEL = "test-model";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "query_tasks",
            category: null,
            onlyOpen: true,
            onlyCompleted: false,
            dateRange: "today",
            missed: false,
            rolledOver: false,
            postponed: false,
            searchText: null,
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "tasks today p[lease",
      todayDate: "2026-06-06",
      currentView: "today",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(init.body as string) as {
      model: string;
      response_format?: unknown;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("test-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("# Query Tasks");
    expect(body.messages[0].content).toContain("never create tasks from vague or ambiguous text");
    expect(body.messages[1].content).toContain('"prompt": "tasks today p[lease"');
    expect(resolution?.command).toMatchObject({
      kind: "query_tasks",
      dateRange: "today",
      onlyOpen: true,
    });
    if (resolution?.command?.kind !== "query_tasks") throw new Error("Expected query command");
    expect(routeForDateRange(resolution.command.dateRange)).toBe("/workspace/today");
  });

  test("uses an absolute default due date for the tomorrow view", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "query_tasks",
            dateRange: "tomorrow",
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await resolveWorkspaceAgentPromptWithLlm({
      prompt: "add follow up",
      todayDate: "2026-06-06",
      currentView: "tomorrow",
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[1].content).toContain('"defaultDueDateForNewTasks": "2026-06-07"');
    expect(body.messages[1].content).not.toContain('"defaultDueDateForNewTasks": "tomorrow"');
  });

  test("normalizes create task allocations returned by the model", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "create_tasks",
            dueDate: "2026-06-06",
            tasks: [{
              title: "Padel with friends",
              category: "lifestyle",
              categoryAllocations: [{ category: "lifestyle", weight: 80 }],
              lifestyleTraits: [
                { trait: "health", weight: 60 },
                { trait: "social", weight: 40 },
              ],
            }],
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "add padel with friends today",
      todayDate: "2026-06-06",
    });

    expect(resolution?.command).toMatchObject({
      kind: "create_tasks",
      dueDate: "2026-06-06",
      tasks: [{
        title: "Padel with friends",
        category: "lifestyle",
        categoryAllocations: [{ category: "lifestyle", weight: 100 }],
        lifestyleTraits: [
          { trait: "health", weight: 60 },
          { trait: "social", weight: 40 },
        ],
      }],
    });
  });

  test("rejects impossible create task due dates from the model", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "create_tasks",
            dueDate: "2026-02-31",
            tasks: [{
              title: "Impossible date task",
              category: "chore",
              categoryAllocations: [{ category: "chore", weight: 100 }],
            }],
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "add impossible date task",
      todayDate: "2026-06-06",
    });

    expect(resolution?.command).toBeNull();
    expect(resolution?.metadata).toMatchObject({
      provider: "openai",
      usedJsonMode: true,
    });
  });

  test("rejects invalid model output instead of inventing a fallback command", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "create_task_guess",
            title: "tasks today please",
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "tasks today please",
      todayDate: "2026-06-06",
    });

    expect(resolution?.command).toBeNull();
    expect(resolution?.metadata).toMatchObject({
      provider: "openai",
      usedJsonMode: true,
    });
  });

  test("rejects contradictory open and completed task query filters", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "query_tasks",
            category: null,
            onlyOpen: true,
            onlyCompleted: true,
            dateRange: "today",
            missed: false,
            rolledOver: false,
            postponed: false,
            searchText: null,
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "show open completed tasks today",
      todayDate: "2026-06-06",
    });

    expect(resolution?.command).toBeNull();
  });

  test("accepts navigation commands for route-only requests", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "navigate_workspace",
            route: "/workspace/day-review",
            reason: "Open day review.",
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "open day review",
      todayDate: "2026-06-06",
    });

    expect(resolution?.command).toEqual({
      kind: "navigate_workspace",
      route: "/workspace/day-review",
      reason: "Open day review.",
    });
  });

  test("accepts timer commands as frontend-rendered tools", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "show_timer",
            mode: "compact",
            reason: "Show the live timer.",
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "show timer",
      todayDate: "2026-06-06",
    });

    expect(resolution?.command).toEqual({
      kind: "show_timer",
      mode: "compact",
      reason: "Show the live timer.",
    });
  });

  test("accepts focus task commands when the model has a client id", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "focus_task",
            clientId: "task-client-123",
            reason: "Focus the requested task.",
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "focus the first task",
      todayDate: "2026-06-06",
      observations: [{ task: { clientId: "task-client-123", title: "First task" } }],
    });

    expect(resolution?.command).toEqual({
      kind: "focus_task",
      clientId: "task-client-123",
      reason: "Focus the requested task.",
    });
  });

  test("passes observations so the model can finish an orchestrated workflow", async () => {
    clearLlmEnv();
    process.env.PLANMYWORKDAY_LLM_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => jsonResponse({
      choices: [{
        message: {
          content: JSON.stringify({
            kind: "finish",
            message: "Today's tasks are visible.",
          }),
        },
      }],
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const resolution = await resolveWorkspaceAgentPromptWithLlm({
      prompt: "tasks today please",
      todayDate: "2026-06-06",
      observations: [{
        step: 1,
        command: { kind: "query_tasks", dateRange: "today" },
        result: { type: "task_query", resultCount: 3 },
      }],
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.messages[1].content).toContain('"observations"');
    expect(body.messages[1].content).toContain('"resultCount": 3');
    expect(resolution?.command).toEqual({
      kind: "finish",
      message: "Today's tasks are visible.",
    });
  });
});
