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
  plannedTasks: [],
  tasks: [],
  totals: {
    completedTasks: 0,
    reviewedTasks: 0,
    reviewedMinutes: 0,
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
});
