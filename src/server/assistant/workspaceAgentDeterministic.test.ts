import { describe, expect, test } from "vitest";
import { parseDeterministicWorkspaceAgentPrompt } from "./workspaceAgent";

describe("workspace agent deterministic command parser", () => {
  test("opens the live timer without requiring LLM routing", () => {
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "start a 25 minute focus session",
    })).toEqual({
      kind: "show_timer",
      mode: "compact",
      reason: "Show the live timer.",
    });
  });

  test("opens today's editable task surface without requiring LLM routing", () => {
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "show today's tasks",
    })).toEqual({
      kind: "navigate_workspace",
      route: "/workspace/today",
      reason: "Open today's editable task surface.",
    });
  });

  test("creates the launch checklist suggestion without requiring LLM routing", () => {
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "Add launch checklist to side project today",
      todayDate: "2026-06-09",
    })).toEqual({
      kind: "create_tasks",
      dueDate: "2026-06-09",
      tasks: [{
        title: "Launch checklist",
        category: "side_project",
        categoryAllocations: [{ category: "side_project", weight: 100 }],
        lifestyleTraits: [],
      }],
    });
  });

  test("queries open chores this week without requiring LLM routing", () => {
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "List open chores this week",
    })).toEqual({
      kind: "query_tasks",
      category: "chore",
      onlyOpen: true,
      onlyCompleted: false,
      dateRange: "this_week",
      missed: false,
      rolledOver: false,
      postponed: false,
      searchText: null,
    });
  });

  test("queries missed tasks without requiring LLM routing", () => {
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "Show tasks I missed",
    })).toEqual({
      kind: "query_tasks",
      category: null,
      onlyOpen: true,
      onlyCompleted: false,
      dateRange: null,
      missed: true,
      rolledOver: false,
      postponed: false,
      searchText: null,
    });
  });

  test("does not hijack task mutation or other route-shaped prompts", () => {
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "add renew passport to chores today",
    })).toBeNull();
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "show tomorrow tasks",
    })).toBeNull();
    expect(parseDeterministicWorkspaceAgentPrompt({
      prompt: "show progress",
    })).toBeNull();
  });
});
