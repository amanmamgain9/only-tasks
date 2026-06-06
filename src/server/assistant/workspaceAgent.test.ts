import { describe, expect, test } from "vitest";
import { routeForDateRange } from "./capabilities";
import { parseWorkspaceAgentPrompt } from "./workspaceAgent";

describe("workspace agent command parser", () => {
  test("turns a messy list into categorized tasks for today", () => {
    const command = parseWorkspaceAgentPrompt({
      prompt: [
        "Here is a messy list:",
        "- deploy the demo app",
        "- file GST return",
        "- padel with friends",
      ].join("\n"),
      todayDate: "2026-06-06",
      currentView: "today",
    });

    expect(command).toMatchObject({
      kind: "create_tasks",
      dueDate: "2026-06-06",
      tasks: [
        { title: "deploy the demo app", category: "side_project" },
        { title: "file GST return", category: "chore" },
        { title: "padel with friends", category: "lifestyle" },
      ],
    });
  });

  test("understands task query filters for missed chores", () => {
    const command = parseWorkspaceAgentPrompt({
      prompt: "List all Chore tasks I have not done in a week",
      todayDate: "2026-06-06",
    });

    expect(command).toMatchObject({
      kind: "query_tasks",
      category: "chore",
      onlyOpen: true,
      dateRange: "last_7_days",
    });
  });

  test("maps today task requests to the editable Today route", () => {
    const command = parseWorkspaceAgentPrompt({
      prompt: "Give me tasks for today",
      todayDate: "2026-06-06",
    });

    expect(command).toMatchObject({
      kind: "query_tasks",
      dateRange: "today",
      onlyOpen: true,
    });

    if (command.kind !== "query_tasks") throw new Error("Expected query command");
    expect(routeForDateRange(command.dateRange)).toBe("/workspace/today");
  });

  test("routes capability questions without mutating tasks", () => {
    const command = parseWorkspaceAgentPrompt({
      prompt: "What can you do?",
      todayDate: "2026-06-06",
    });

    expect(command).toEqual({ kind: "capabilities" });
  });

  test("does not pretend target planning is wired in the first pass", () => {
    const command = parseWorkspaceAgentPrompt({
      prompt: "I want to move my life toward side project. Set up a realistic daily target.",
      todayDate: "2026-06-06",
    });

    expect(command).toMatchObject({
      kind: "unsupported",
    });
  });
});
