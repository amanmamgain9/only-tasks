import { describe, expect, test } from "vitest";
import { buildDayRecapSummary } from "./dayRecap";
import type { TimeReviewSummary } from "./types";

const baseSummary: TimeReviewSummary = {
  workdayDate: "2026-06-01",
  timeZone: "Asia/Calcutta",
  generatedAt: "2026-06-01T12:00:00.000Z",
  localNowMinutes: 1080,
  minutesUntilRollover: 360,
  reviewWindow: "same_workday_end",
  phase: "reviewed",
  settings: {
    workdayRolloverTime: "04:00",
    middayReviewEnabled: true,
    middayReviewTime: "12:00",
  },
  targets: [],
  plannedTasks: [],
  tasks: [],
  totals: {
    completedTasks: 0,
    reviewedTasks: 0,
    reviewedMinutes: 0,
    reviewedTargets: 0,
    targetReviewedMinutes: 0,
  },
};

describe("day recap summary", () => {
  test("splits promise and proof into category and lifestyle trait rows with chore last", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      plannedTasks: [
        {
          taskId: 1,
          title: "Build launch page",
          projectId: 1,
          projectTitle: "Launch",
          dueDate: "2026-06-01",
          isCompleted: true,
          completedAt: "2026-06-01T10:00:00.000Z",
          estimatedTimeMinutes: 120,
          categoryAllocations: [{ category: "side_project", weight: 100 }],
          lifestyleTraits: [],
        },
        {
          taskId: 2,
          title: "Dance class",
          projectId: null,
          projectTitle: null,
          dueDate: "2026-06-01",
          isCompleted: true,
          completedAt: "2026-06-01T11:00:00.000Z",
          estimatedTimeMinutes: 60,
          categoryAllocations: [{ category: "lifestyle", weight: 100 }],
          lifestyleTraits: [
            { trait: "health", weight: 70 },
            { trait: "hobby", weight: 30 },
          ],
        },
        {
          taskId: 3,
          title: "Pay tax",
          projectId: null,
          projectTitle: null,
          dueDate: "2026-06-01",
          isCompleted: false,
          completedAt: null,
          estimatedTimeMinutes: 30,
          categoryAllocations: [{ category: "chore", weight: 100 }],
          lifestyleTraits: [],
        },
      ],
      tasks: [
        {
          taskId: 1,
          title: "Build launch page",
          projectId: 1,
          projectTitle: "Launch",
          completedAt: "2026-06-01T10:00:00.000Z",
          estimatedTimeMinutes: 120,
          categoryAllocations: [{ category: "side_project", weight: 100 }],
          lifestyleTraits: [],
          durationMinutes: 140,
          startMinute: null,
          endMinute: null,
          reviewStatus: "confirmed",
        },
        {
          taskId: 2,
          title: "Dance class",
          projectId: null,
          projectTitle: null,
          completedAt: "2026-06-01T11:00:00.000Z",
          estimatedTimeMinutes: 60,
          categoryAllocations: [{ category: "lifestyle", weight: 100 }],
          lifestyleTraits: [
            { trait: "health", weight: 50 },
            { trait: "hobby", weight: 50 },
          ],
          durationMinutes: 50,
          startMinute: null,
          endMinute: null,
          reviewStatus: "confirmed",
        },
      ],
      totals: {
        completedTasks: 2,
        reviewedTasks: 2,
        reviewedMinutes: 190,
        reviewedTargets: 0,
        targetReviewedMinutes: 0,
      },
    });

    expect(summary.rows.map((row) => row.id)).toEqual([
      "job",
      "side_project",
      "learning",
      "health",
      "social",
      "hobby",
      "chore",
    ]);
    expect(summary.rows.find((row) => row.id === "side_project")).toMatchObject({
      doneMinutes: 140,
      promisedMinutes: 120,
      doneValue: 140,
      promisedValue: 120,
    });
    expect(summary.rows.find((row) => row.id === "health")).toMatchObject({
      doneMinutes: 25,
      promisedMinutes: 42,
    });
    expect(summary.rows.find((row) => row.id === "hobby")).toMatchObject({
      doneMinutes: 25,
      promisedMinutes: 18,
    });
    expect(summary.rows.find((row) => row.id === "chore")).toMatchObject({
      doneMinutes: 0,
      promisedMinutes: 30,
    });
    expect(summary.totalPromisedMinutes).toBe(210);
    expect(summary.totalDoneMinutes).toBe(190);
    expect(summary.primaryMetric).toBe("time");
    expect(summary.totalPromisedValue).toBe(210);
    expect(summary.totalDoneValue).toBe(190);
    expect(summary.title).toBe("SIDE PROJECT WON");
  });

  test("falls back to task counts when time has not been estimated or reviewed", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      plannedTasks: [
        {
          taskId: 1,
          title: "Client draft",
          projectId: 1,
          projectTitle: "Client Work",
          dueDate: "2026-06-01",
          isCompleted: true,
          completedAt: "2026-06-01T09:00:00.000Z",
          estimatedTimeMinutes: null,
          categoryAllocations: [{ category: "job", weight: 100 }],
          lifestyleTraits: [],
        },
        {
          taskId: 2,
          title: "Padel",
          projectId: null,
          projectTitle: null,
          dueDate: "2026-06-01",
          isCompleted: true,
          completedAt: "2026-06-01T11:00:00.000Z",
          estimatedTimeMinutes: null,
          categoryAllocations: [{ category: "lifestyle", weight: 100 }],
          lifestyleTraits: [
            { trait: "health", weight: 60 },
            { trait: "social", weight: 40 },
          ],
        },
        {
          taskId: 3,
          title: "Errand",
          projectId: null,
          projectTitle: null,
          dueDate: "2026-06-01",
          isCompleted: false,
          completedAt: null,
          estimatedTimeMinutes: null,
          categoryAllocations: [{ category: "chore", weight: 100 }],
          lifestyleTraits: [],
        },
      ],
      tasks: [
        {
          taskId: 1,
          title: "Client draft",
          projectId: 1,
          projectTitle: "Client Work",
          completedAt: "2026-06-01T09:00:00.000Z",
          estimatedTimeMinutes: null,
          categoryAllocations: [{ category: "job", weight: 100 }],
          lifestyleTraits: [],
          durationMinutes: 0,
          startMinute: null,
          endMinute: null,
          reviewStatus: "draft",
        },
        {
          taskId: 2,
          title: "Padel",
          projectId: null,
          projectTitle: null,
          completedAt: "2026-06-01T11:00:00.000Z",
          estimatedTimeMinutes: null,
          categoryAllocations: [{ category: "lifestyle", weight: 100 }],
          lifestyleTraits: [
            { trait: "health", weight: 60 },
            { trait: "social", weight: 40 },
          ],
          durationMinutes: 0,
          startMinute: null,
          endMinute: null,
          reviewStatus: "draft",
        },
      ],
      totals: {
        completedTasks: 2,
        reviewedTasks: 0,
        reviewedMinutes: 0,
        reviewedTargets: 0,
        targetReviewedMinutes: 0,
      },
    });

    expect(summary.primaryMetric).toBe("tasks");
    expect(summary.totalDoneValue).toBe(2);
    expect(summary.totalPromisedValue).toBe(3);
    expect(summary.totalDoneMinutes).toBe(0);
    expect(summary.totalPromisedMinutes).toBe(0);
    expect(summary.rows.find((row) => row.id === "job")).toMatchObject({
      doneValue: 1,
      promisedValue: 1,
    });
    expect(summary.rows.find((row) => row.id === "health")).toMatchObject({
      doneValue: 0.6,
      promisedValue: 0.6,
    });
    expect(summary.rows.find((row) => row.id === "chore")).toMatchObject({
      doneValue: 0,
      promisedValue: 1,
    });
    expect(summary.title).toBe("MAIN WORK MOVED");
  });

  test("keeps estimated completed tasks visible when no reviewed time exists", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      plannedTasks: [
        {
          taskId: 1,
          title: "Client draft",
          projectId: 1,
          projectTitle: "Client Work",
          dueDate: "2026-06-01",
          isCompleted: true,
          completedAt: "2026-06-01T09:00:00.000Z",
          estimatedTimeMinutes: 60,
          categoryAllocations: [{ category: "job", weight: 100 }],
          lifestyleTraits: [],
        },
      ],
      tasks: [
        {
          taskId: 1,
          title: "Client draft",
          projectId: 1,
          projectTitle: "Client Work",
          completedAt: "2026-06-01T09:00:00.000Z",
          estimatedTimeMinutes: 60,
          categoryAllocations: [{ category: "job", weight: 100 }],
          lifestyleTraits: [],
          durationMinutes: 0,
          startMinute: null,
          endMinute: null,
          reviewStatus: "draft",
        },
      ],
      totals: {
        completedTasks: 1,
        reviewedTasks: 0,
        reviewedMinutes: 0,
        reviewedTargets: 0,
        targetReviewedMinutes: 0,
      },
    });

    expect(summary.primaryMetric).toBe("tasks");
    expect(summary.rows.find((row) => row.id === "job")).toMatchObject({
      metric: "tasks",
      doneValue: 1,
      promisedValue: 1,
    });
    expect(summary.title).toBe("MAIN WORK MOVED");
  });

  test("uses target-reviewed minutes in recap rows even without task durations", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      targets: [
        {
          id: 1,
          category: "side_project",
          label: "Side Project",
          enabled: true,
          kind: "time",
          targetMinutes: 180,
          targetCount: null,
          schedule: "every_day",
          updatedAt: null,
          appliesToday: true,
          completedTasks: 2,
          plannedTasks: 0,
          completedPlannedTasks: 0,
          reviewedMinutes: 120,
          reviewedCount: 0,
          reviewStatus: "confirmed",
          reviewSource: "target_review",
          progressPercent: 67,
          met: false,
        },
      ],
      totals: {
        completedTasks: 2,
        reviewedTasks: 0,
        reviewedMinutes: 120,
        reviewedTargets: 1,
        targetReviewedMinutes: 120,
      },
    });

    expect(summary.primaryMetric).toBe("time");
    expect(summary.totalDoneMinutes).toBe(120);
    expect(summary.totalPromisedMinutes).toBe(180);
    expect(summary.rows.find((row) => row.id === "side_project")).toMatchObject({
      doneMinutes: 120,
      promisedMinutes: 180,
      doneValue: 120,
      promisedValue: 180,
    });
    expect(summary.title).toBe("SIDE PROJECT LED");
  });

  test("keeps missed time targets visible as time promises", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      targets: [
        {
          id: 1,
          category: "job",
          label: "Main Work",
          enabled: true,
          kind: "time",
          targetMinutes: 180,
          targetCount: null,
          schedule: "every_day",
          updatedAt: null,
          appliesToday: true,
          completedTasks: 0,
          plannedTasks: 0,
          completedPlannedTasks: 0,
          reviewedMinutes: 0,
          reviewedCount: 0,
          reviewStatus: "confirmed",
          reviewSource: "target_review",
          progressPercent: 0,
          met: false,
        },
      ],
      totals: {
        completedTasks: 0,
        reviewedTasks: 0,
        reviewedMinutes: 0,
        reviewedTargets: 1,
        targetReviewedMinutes: 0,
      },
    });

    expect(summary.primaryMetric).toBe("time");
    expect(summary.totalDoneValue).toBe(0);
    expect(summary.totalPromisedValue).toBe(180);
    expect(summary.rows.find((row) => row.id === "job")).toMatchObject({
      doneValue: 0,
      promisedValue: 180,
    });
    expect(summary.title).toBe("DAY NEEDS SHAPE");
  });

  test("uses count targets as task-count promises and proof", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      plannedTasks: [
        {
          taskId: 1,
          title: "GST filing",
          projectId: null,
          projectTitle: null,
          dueDate: "2026-06-01",
          isCompleted: true,
          completedAt: "2026-06-01T09:00:00.000Z",
          estimatedTimeMinutes: 60,
          categoryAllocations: [{ category: "chore", weight: 100 }],
          lifestyleTraits: [],
        },
      ],
      tasks: [
        {
          taskId: 1,
          title: "GST filing",
          projectId: null,
          projectTitle: null,
          completedAt: "2026-06-01T09:00:00.000Z",
          estimatedTimeMinutes: 60,
          categoryAllocations: [{ category: "chore", weight: 100 }],
          lifestyleTraits: [],
          durationMinutes: 30,
          startMinute: null,
          endMinute: null,
          reviewStatus: "confirmed",
        },
      ],
      targets: [
        {
          id: 1,
          category: "chore",
          label: "Chore",
          enabled: true,
          kind: "count",
          targetMinutes: null,
          targetCount: 3,
          schedule: "every_day",
          updatedAt: null,
          appliesToday: true,
          completedTasks: 2,
          plannedTasks: 0,
          completedPlannedTasks: 0,
          reviewedMinutes: 0,
          reviewedCount: 2,
          reviewStatus: "confirmed",
          reviewSource: "target_review",
          progressPercent: 67,
          met: false,
        },
      ],
      totals: {
        completedTasks: 2,
        reviewedTasks: 0,
        reviewedMinutes: 0,
        reviewedTargets: 1,
        targetReviewedMinutes: 0,
      },
    });

    expect(summary.primaryMetric).toBe("tasks");
    expect(summary.totalDoneValue).toBe(2);
    expect(summary.totalPromisedValue).toBe(3);
    expect(summary.rows.find((row) => row.id === "chore")).toMatchObject({
      metric: "tasks",
      doneMinutes: 0,
      promisedMinutes: 0,
      doneValue: 2,
      promisedValue: 3,
    });
    expect(summary.title).toBe("CHORES CLEARED");
  });

  test("keeps count target rows visible when time targets also exist", () => {
    const summary = buildDayRecapSummary({
      ...baseSummary,
      targets: [
        {
          id: 1,
          category: "side_project",
          label: "Side Project",
          enabled: true,
          kind: "time",
          targetMinutes: 180,
          targetCount: null,
          schedule: "every_day",
          updatedAt: null,
          appliesToday: true,
          completedTasks: 0,
          plannedTasks: 0,
          completedPlannedTasks: 0,
          reviewedMinutes: 120,
          reviewedCount: 0,
          reviewStatus: "confirmed",
          reviewSource: "target_review",
          progressPercent: 67,
          met: false,
        },
        {
          id: 2,
          category: "chore",
          label: "Chore",
          enabled: true,
          kind: "count",
          targetMinutes: null,
          targetCount: 3,
          schedule: "every_day",
          updatedAt: null,
          appliesToday: true,
          completedTasks: 0,
          plannedTasks: 0,
          completedPlannedTasks: 0,
          reviewedMinutes: 0,
          reviewedCount: 2,
          reviewStatus: "confirmed",
          reviewSource: "target_review",
          progressPercent: 67,
          met: false,
        },
      ],
      totals: {
        completedTasks: 2,
        reviewedTasks: 0,
        reviewedMinutes: 120,
        reviewedTargets: 2,
        targetReviewedMinutes: 120,
      },
    });

    expect(summary.primaryMetric).toBe("time");
    expect(summary.secondaryMetric).toBe("tasks");
    expect(summary.secondaryTotalDoneValue).toBe(2);
    expect(summary.secondaryTotalPromisedValue).toBe(3);
    expect(summary.rows.find((row) => row.id === "side_project")).toMatchObject({
      metric: "time",
      doneValue: 120,
      promisedValue: 180,
    });
    expect(summary.rows.find((row) => row.id === "chore")).toMatchObject({
      metric: "tasks",
      doneValue: 2,
      promisedValue: 3,
    });
  });
});
