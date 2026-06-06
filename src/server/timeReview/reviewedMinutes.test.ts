import { describe, expect, test } from "vitest";
import type { TimeReviewTarget, TimeReviewTask } from "@/features/timeReview/types";
import { calculateReviewedMinutesForSummary } from "./reviewedMinutes";

function task(input: {
  durationMinutes: number;
  categoryAllocations: TimeReviewTask["categoryAllocations"];
}): TimeReviewTask {
  return {
    taskId: 1,
    title: "Task",
    projectId: null,
    projectTitle: null,
    completedAt: "2026-06-01T09:00:00.000Z",
    estimatedTimeMinutes: null,
    categoryAllocations: input.categoryAllocations,
    lifestyleTraits: [],
    durationMinutes: input.durationMinutes,
    startMinute: null,
    endMinute: null,
    reviewStatus: "confirmed",
  };
}

function target(input: {
  category: TimeReviewTarget["category"];
  kind: TimeReviewTarget["kind"];
  reviewedMinutes?: number;
  reviewedCount?: number;
  reviewStatus?: TimeReviewTarget["reviewStatus"];
}): TimeReviewTarget {
  return {
    id: 1,
    category: input.category,
    label: input.category,
    enabled: true,
    kind: input.kind,
    targetMinutes: input.kind === "time" ? 180 : null,
    targetCount: input.kind === "count" ? 3 : null,
    schedule: "every_day",
    updatedAt: null,
    appliesToday: true,
    completedTasks: 0,
    plannedTasks: 0,
    completedPlannedTasks: 0,
    reviewedMinutes: input.reviewedMinutes ?? 0,
    reviewedCount: input.reviewedCount ?? 0,
    reviewStatus: input.reviewStatus ?? "confirmed",
    reviewSource: "target_review",
    progressPercent: 0,
    met: false,
  };
}

describe("time review reviewed minute totals", () => {
  test("target time reviews replace only covered task categories", () => {
    const result = calculateReviewedMinutesForSummary({
      targets: [
        target({ category: "side_project", kind: "time", reviewedMinutes: 120 }),
      ],
      tasks: [
        task({
          durationMinutes: 60,
          categoryAllocations: [
            { category: "side_project", weight: 70 },
            { category: "lifestyle", weight: 30 },
          ],
        }),
        task({
          durationMinutes: 60,
          categoryAllocations: [{ category: "job", weight: 100 }],
        }),
      ],
    });

    expect(result).toEqual({
      targetReviewedMinutes: 120,
      reviewedMinutes: 198,
    });
  });

  test("count target reviews do not erase reviewed task time", () => {
    const result = calculateReviewedMinutesForSummary({
      targets: [
        target({ category: "chore", kind: "count", reviewedCount: 2 }),
      ],
      tasks: [
        task({
          durationMinutes: 45,
          categoryAllocations: [{ category: "chore", weight: 100 }],
        }),
      ],
    });

    expect(result).toEqual({
      targetReviewedMinutes: 0,
      reviewedMinutes: 45,
    });
  });
});
