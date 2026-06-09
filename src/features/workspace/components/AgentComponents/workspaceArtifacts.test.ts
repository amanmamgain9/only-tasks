import { describe, expect, test } from "vitest";
import type { WorkspaceUiBlock } from "@/features/ai/types";
import {
  mergeWorkspaceArtifactBlocks,
  restorePinnedWorkspaceArtifacts,
  serializePinnedWorkspaceArtifacts,
  upsertWorkspaceArtifact,
  workspaceArtifactKey,
  workspaceArtifactTitle,
} from "./workspaceArtifacts";

const todayTree: WorkspaceUiBlock = { type: "task_tree", id: "today", view: "today" };
const dailyTargets: WorkspaceUiBlock = { type: "daily_targets", id: "targets" };
const timer: WorkspaceUiBlock = { type: "timer", id: "timer", mode: "compact" };

describe("workspace artifact helpers", () => {
  test("uses task tree view as the artifact identity so Today does not duplicate", () => {
    expect(workspaceArtifactKey([todayTree])).toBe("task_tree:today");
    expect(workspaceArtifactKey([{ ...todayTree, focusTaskId: "task-1" }])).toBe("task_tree:today");
  });

  test("groups daily targets under the Today task tree artifact title", () => {
    expect(workspaceArtifactKey([dailyTargets, todayTree])).toBe("task_tree:today");
    expect(workspaceArtifactTitle([dailyTargets, todayTree])).toBe("Today");
  });

  test("drops stale companion blocks when the same artifact is reopened with one block", () => {
    const agentTodayTree: WorkspaceUiBlock = { type: "task_tree", id: "agent-today", view: "today" };

    expect(mergeWorkspaceArtifactBlocks([dailyTargets, todayTree], [agentTodayTree])).toEqual([agentTodayTree]);

    const artifacts = upsertWorkspaceArtifact({}, [dailyTargets, todayTree], {
      source: "route",
      now: 10,
    });
    const reopened = upsertWorkspaceArtifact(artifacts, [agentTodayTree], {
      source: "agent",
      now: 20,
    });

    expect(reopened["task_tree:today"].blocks).toEqual([agentTodayTree]);
    expect(reopened["task_tree:today"].source).toBe("agent");
  });

  test("keeps timer artifacts singleton by task context", () => {
    expect(workspaceArtifactKey([timer])).toBe("timer:workspace");
    expect(workspaceArtifactKey([{ ...timer, mode: "full" }])).toBe("timer:workspace");
  });

  test("dedupes day review artifacts across route, quick, and agent sources", () => {
    expect(workspaceArtifactKey([{ type: "day_review", id: "route-day-review", mode: "full" }])).toBe("day_review:full");
    expect(workspaceArtifactKey([{ type: "day_review", id: "local-day-review", mode: "full" }])).toBe("day_review:full");
    expect(workspaceArtifactKey([{ type: "day_review", mode: "full" }])).toBe("day_review:full");
  });

  test("serializes and restores only pinned artifact metadata", () => {
    const artifacts = upsertWorkspaceArtifact({}, [todayTree], {
      pinned: true,
      source: "quick",
      now: 10,
    });
    const withUnpinned = upsertWorkspaceArtifact(artifacts, [timer], {
      pinned: false,
      source: "quick",
      now: 20,
    });

    const restored = restorePinnedWorkspaceArtifacts(serializePinnedWorkspaceArtifacts(withUnpinned));

    expect(Object.keys(restored)).toEqual(["task_tree:today"]);
    expect(restored["task_tree:today"].pinned).toBe(true);
    expect(restored["task_tree:today"].blocks).toEqual([todayTree]);
  });

  test("recovers from malformed persisted artifact state", () => {
    expect(restorePinnedWorkspaceArtifacts("not json")).toEqual({});
    expect(restorePinnedWorkspaceArtifacts(JSON.stringify({ pinned: "bad" }))).toEqual({});
  });
});
