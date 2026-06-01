import { describe, expect, test } from "vitest";
import { buildProgressSummary } from "./progress-core";

const emptyRows = {
  completedTasks: [],
  plannedTasks: [],
  timerSessions: [],
};

describe("progress summary", () => {
  test("counts completed tasks by the user's local completion date", () => {
    const summary = buildProgressSummary({
      timeZone: "Asia/Kolkata",
      now: new Date("2026-06-01T04:00:00.000Z"),
      rows: {
        ...emptyRows,
        completedTasks: [
          {
            id: 1,
            title: "Late night finish",
            projectId: 10,
            projectTitle: "Launch",
            completedAt: "2026-05-31T20:00:00.000Z",
            dueDate: null,
          },
        ],
      },
    });

    expect(summary.todayDate).toBe("2026-06-01");
    expect(summary.today.completedTasks).toBe(1);
    expect(summary.days.find((day) => day.date === "2026-06-01")?.completedTasks).toBe(1);
  });

  test("keeps planned task counts date-only so due dates do not shift across time zones", () => {
    const summary = buildProgressSummary({
      timeZone: "America/Los_Angeles",
      now: new Date("2026-06-01T18:00:00.000Z"),
      rows: {
        ...emptyRows,
        plannedTasks: [
          { dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 1 },
          { dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 0 },
        ],
      },
    });

    expect(summary.todayDate).toBe("2026-06-01");
    expect(summary.today.plannedTasks).toBe(2);
    expect(summary.today.completedPlannedTasks).toBe(1);
    expect(summary.today.planCompletionPercent).toBe(50);
  });

  test("returns today's planned tasks with incomplete work first", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-01T18:00:00.000Z"),
      rows: {
        ...emptyRows,
        plannedTasks: [
          { dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 1 },
          { dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 0 },
        ],
        plannedTaskDetails: [
          { id: 1, title: "Done task", projectTitle: "Launch", dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 1, completedAt: "2026-06-01T09:00:00.000Z" },
          { id: 2, title: "Open task", projectTitle: "Launch", dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 0, completedAt: null },
        ],
      },
    });

    expect(summary.todayPlan.map((task) => task.title)).toEqual(["Open task", "Done task"]);
  });

  test("counts completed work sessions as pomodoros and skipped work as focus minutes only", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-03T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        timerSessions: [
          {
            projectId: 1,
            projectTitle: "Launch",
            endedAt: "2026-06-03T09:00:00.000Z",
            state: "completed",
            durationSeconds: 1500,
            accumulatedMs: 1_500_000,
          },
          {
            projectId: 1,
            projectTitle: "Launch",
            endedAt: "2026-06-03T10:00:00.000Z",
            state: "skipped",
            durationSeconds: 1500,
            accumulatedMs: 600_000,
          },
        ],
      },
    });

    expect(summary.today.focusMinutes).toBe(35);
    expect(summary.today.pomodoros).toBe(1);
  });

  test("caps focus minutes at configured session duration", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-03T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        timerSessions: [
          {
            projectId: null,
            projectTitle: null,
            endedAt: "2026-06-03T09:00:00.000Z",
            state: "completed",
            durationSeconds: 1500,
            accumulatedMs: 9_999_999,
          },
        ],
      },
    });

    expect(summary.today.focusMinutes).toBe(25);
  });

  test("rolls weekly metrics from Monday through the user's current day", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-04T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        completedTasks: [
          { id: 1, title: "Monday", projectId: 1, projectTitle: "Launch", completedAt: "2026-06-01T10:00:00.000Z", dueDate: null },
          { id: 2, title: "Thursday", projectId: 1, projectTitle: "Launch", completedAt: "2026-06-04T10:00:00.000Z", dueDate: null },
        ],
        plannedTasks: [
          { dueDate: "2026-06-01T00:00:00.000Z", isCompleted: 1 },
          { dueDate: "2026-06-05T00:00:00.000Z", isCompleted: 0 },
        ],
      },
    });

    expect(summary.weekStartDate).toBe("2026-06-01");
    expect(summary.week.completedTasks).toBe(2);
    expect(summary.week.plannedTasks).toBe(2);
    expect(summary.week.completedPlannedTasks).toBe(1);
    expect(summary.week.productiveDays).toBe(2);
  });

  test("sorts project breakdown by completed task momentum", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-03T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        completedTasks: [
          { id: 1, title: "Task", projectId: 1, projectTitle: "Launch", completedAt: "2026-06-03T09:00:00.000Z", dueDate: null },
        ],
        timerSessions: [
          {
            projectId: 2,
            projectTitle: "Content",
            endedAt: "2026-06-03T10:00:00.000Z",
            state: "completed",
            durationSeconds: 3600,
            accumulatedMs: 3_600_000,
          },
        ],
      },
    });

    expect(summary.projectBreakdown).toHaveLength(1);
    expect(summary.projectBreakdown[0]).toMatchObject({ projectId: 1, title: "Launch", completedTasks: 1 });
  });

  test("rolls completed tasks into weighted category percentages", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-03T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        completedTasks: [
          {
            id: 1,
            title: "Build feature",
            projectId: 1,
            projectTitle: "Launch",
            projectType: "side_project",
            completedAt: "2026-06-03T09:00:00.000Z",
            dueDate: null,
            categoryAllocations: JSON.stringify([
              { category: "side_project", weight: 70 },
              { category: "learning", weight: 30 },
            ]),
          },
          {
            id: 2,
            title: "Workout",
            projectId: null,
            projectTitle: null,
            projectType: null,
            completedAt: "2026-06-03T10:00:00.000Z",
            dueDate: null,
            categoryAllocations: JSON.stringify([{ category: "health", weight: 100 }]),
          },
        ],
      },
    });

    expect(summary.todayCategoryBreakdown).toEqual([
      { category: "lifestyle", label: "Lifestyle", weightedTasks: 1.3, percent: 65 },
      { category: "side_project", label: "Side Project", weightedTasks: 0.7, percent: 35 },
    ]);
    expect(summary.weekCategoryBreakdown).toEqual(summary.todayCategoryBreakdown);
  });

  test("rolls reviewed time into category minutes", () => {
    const summary = buildProgressSummary({
      timeZone: "UTC",
      now: new Date("2026-06-03T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        reviewedTimeEntries: [
          {
            workdayDate: "2026-06-03",
            durationMinutes: 60,
            projectType: "side_project",
            categoryAllocations: JSON.stringify([
              { category: "side_project", weight: 70 },
              { category: "learning", weight: 30 },
            ]),
          },
          {
            workdayDate: "2026-06-03",
            durationMinutes: 30,
            projectType: null,
            categoryAllocations: JSON.stringify([{ category: "health", weight: 100 }]),
          },
        ],
      },
    });

    expect(summary.today.reviewedMinutes).toBe(90);
    expect(summary.todayCategoryTimeBreakdown).toEqual([
      { category: "lifestyle", label: "Lifestyle", minutes: 48, percent: 53 },
      { category: "side_project", label: "Side Project", minutes: 42, percent: 47 },
    ]);
    expect(summary.week.reviewedMinutes).toBe(90);
  });

  test("returns recent completions newest first with local dates", () => {
    const summary = buildProgressSummary({
      timeZone: "Asia/Kolkata",
      now: new Date("2026-06-03T12:00:00.000Z"),
      rows: {
        ...emptyRows,
        completedTasks: [
          { id: 1, title: "Old", projectId: null, projectTitle: null, completedAt: "2026-06-01T10:00:00.000Z", dueDate: null },
          { id: 2, title: "New", projectId: null, projectTitle: null, completedAt: "2026-06-02T23:00:00.000Z", dueDate: null },
        ],
      },
    });

    expect(summary.recentCompletions[0]).toMatchObject({ id: 2, title: "New", localDate: "2026-06-03" });
  });
});
