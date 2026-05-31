import type {
  ProgressCategoryBreakdown,
  ProgressCategoryTimeBreakdown,
  ProgressDay,
  ProgressPlannedTask,
  ProgressProjectBreakdown,
  ProgressRecentCompletion,
  ProgressSummary,
} from "../../features/progress/types";
import {
  getTaskCategoryLabel,
  normalizeTaskCategoryAllocations,
  type ProjectCategorySeed,
  type TaskCategoryId,
} from "../../features/categories/taskCategories";
import {
  addDaysToDateKey,
  enumerateDateKeys,
  formatLocalDateKey,
  getDateKeyLabel,
  getDateKeyWeekdayLabel,
  getStartOfLocalDateUtc,
  getWeekStartDateKey,
  normalizeTimeZone,
} from "./timezone";

export type CompletedTaskProgressRow = {
  id: number;
  title: string;
  projectId: number | null;
  projectTitle: string | null;
  projectType?: string | null;
  completedAt: string;
  dueDate: string | null;
  categoryAllocations?: string | null;
};

export type PlannedTaskProgressRow = {
  dueDate: string;
  isCompleted: number;
};

export type PlannedTaskDetailProgressRow = {
  id: number;
  title: string;
  projectTitle: string | null;
  dueDate: string;
  isCompleted: number;
  completedAt: string | null;
};

export type TimerProgressRow = {
  projectId: number | null;
  projectTitle: string | null;
  endedAt: string;
  state: "completed" | "skipped";
  durationSeconds: number;
  accumulatedMs: number;
};

export type ReviewedTimeProgressRow = {
  workdayDate: string;
  durationMinutes: number;
  projectType?: string | null;
  categoryAllocations?: string | null;
};

export type ProgressSourceRows = {
  completedTasks: CompletedTaskProgressRow[];
  plannedTasks: PlannedTaskProgressRow[];
  plannedTaskDetails?: PlannedTaskDetailProgressRow[];
  timerSessions: TimerProgressRow[];
  reviewedTimeEntries?: ReviewedTimeProgressRow[];
};

export type ProgressWindow = {
  timeZone: string;
  todayDate: string;
  firstHistoryDate: string;
  tomorrowDate: string;
  weekStartDate: string;
  weekEndDate: string;
  historyStartUtc: string;
  historyEndUtc: string;
  weekStartUtc: string;
  weekEndUtc: string;
};

function percent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function getDueDateKey(dueDate: string | null) {
  return dueDate?.slice(0, 10) ?? null;
}

function createEmptyDay(date: string, todayDate: string): ProgressDay {
  return {
    date,
    label: getDateKeyLabel(date),
    weekday: getDateKeyWeekdayLabel(date),
    isToday: date === todayDate,
    completedTasks: 0,
    plannedTasks: 0,
    completedPlannedTasks: 0,
    focusMinutes: 0,
    pomodoros: 0,
    planCompletionPercent: 0,
  };
}

function getProjectKey(projectId: number | null) {
  return projectId === null ? "none" : String(projectId);
}

function getProjectTitle(projectTitle: string | null) {
  return projectTitle?.trim() || "No project";
}

function isDateInRange(date: string, startInclusive: string, endExclusive: string) {
  return date >= startInclusive && date < endExclusive;
}

function getProjectType(value: string | null): ProjectCategorySeed | null {
  if (value === "main" || value === "side_project" || value === "chore") return value;
  return null;
}

function addTaskCategoryWeights(
  totals: Map<TaskCategoryId, number>,
  task: Pick<CompletedTaskProgressRow, "categoryAllocations" | "projectType">,
) {
  const allocations = normalizeTaskCategoryAllocations(task.categoryAllocations, {
    projectType: getProjectType(task.projectType ?? null),
  });

  for (const allocation of allocations) {
    totals.set(allocation.category, (totals.get(allocation.category) ?? 0) + allocation.weight / 100);
  }
}

function buildCategoryBreakdown(totals: Map<TaskCategoryId, number>): ProgressCategoryBreakdown[] {
  const totalWeight = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) return [];

  return Array.from(totals.entries())
    .map(([category, weightedTasks]) => ({
      category,
      label: getTaskCategoryLabel(category),
      weightedTasks: Math.round(weightedTasks * 10) / 10,
      percent: percent(weightedTasks, totalWeight),
    }))
    .sort((a, b) => b.weightedTasks - a.weightedTasks || a.label.localeCompare(b.label));
}

function addTaskCategoryMinutes(
  totals: Map<TaskCategoryId, number>,
  entry: Pick<ReviewedTimeProgressRow, "categoryAllocations" | "projectType" | "durationMinutes">,
) {
  const allocations = normalizeTaskCategoryAllocations(entry.categoryAllocations, {
    projectType: getProjectType(entry.projectType ?? null),
  });

  for (const allocation of allocations) {
    totals.set(allocation.category, (totals.get(allocation.category) ?? 0) + entry.durationMinutes * (allocation.weight / 100));
  }
}

function buildCategoryTimeBreakdown(totals: Map<TaskCategoryId, number>): ProgressCategoryTimeBreakdown[] {
  const totalMinutes = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  if (totalMinutes <= 0) return [];

  return Array.from(totals.entries())
    .map(([category, minutes]) => ({
      category,
      label: getTaskCategoryLabel(category),
      minutes: Math.round(minutes),
      percent: percent(minutes, totalMinutes),
    }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label));
}

export function getProgressWindow(input: {
  timeZone?: string | null;
  now?: Date;
  historyDays?: number;
} = {}): ProgressWindow {
  const timeZone = normalizeTimeZone(input.timeZone);
  const now = input.now ?? new Date();
  const historyDays = input.historyDays ?? 7;
  const todayDate = formatLocalDateKey(now, timeZone);
  const firstHistoryDate = addDaysToDateKey(todayDate, -(historyDays - 1));
  const tomorrowDate = addDaysToDateKey(todayDate, 1);
  const weekStartDate = getWeekStartDateKey(todayDate, 1);
  const weekEndDate = addDaysToDateKey(weekStartDate, 7);

  return {
    timeZone,
    todayDate,
    firstHistoryDate,
    tomorrowDate,
    weekStartDate,
    weekEndDate,
    historyStartUtc: getStartOfLocalDateUtc(firstHistoryDate, timeZone).toISOString(),
    historyEndUtc: getStartOfLocalDateUtc(tomorrowDate, timeZone).toISOString(),
    weekStartUtc: getStartOfLocalDateUtc(weekStartDate, timeZone).toISOString(),
    weekEndUtc: getStartOfLocalDateUtc(weekEndDate, timeZone).toISOString(),
  };
}

export function buildProgressSummary(input: {
  rows: ProgressSourceRows;
  timeZone?: string | null;
  now?: Date;
  generatedAt?: Date;
}): ProgressSummary {
  const window = getProgressWindow({ timeZone: input.timeZone, now: input.now });
  const dateKeys = enumerateDateKeys(window.firstHistoryDate, 7);
  const days = new Map(dateKeys.map((date) => [date, createEmptyDay(date, window.todayDate)]));
  const focusMsByDay = new Map<string, number>();
  const projectBreakdown = new Map<string, ProgressProjectBreakdown>();
  const todayCategoryTotals = new Map<TaskCategoryId, number>();
  const weekCategoryTotals = new Map<TaskCategoryId, number>();
  const todayCategoryTimeTotals = new Map<TaskCategoryId, number>();
  const weekCategoryTimeTotals = new Map<TaskCategoryId, number>();

  const ensureProject = (projectId: number | null, title: string | null) => {
    const key = getProjectKey(projectId);
    const existing = projectBreakdown.get(key);
    if (existing) return existing;

    const next = {
      projectId,
      title: getProjectTitle(title),
      completedTasks: 0,
      focusMinutes: 0,
    };
    projectBreakdown.set(key, next);
    return next;
  };

  for (const task of input.rows.completedTasks) {
    const completedAt = new Date(task.completedAt);
    if (Number.isNaN(completedAt.getTime())) continue;

    const localDate = formatLocalDateKey(completedAt, window.timeZone);
    const day = days.get(localDate);
    if (day) day.completedTasks += 1;

    if (localDate === window.todayDate) {
      addTaskCategoryWeights(todayCategoryTotals, task);
    }

    if (isDateInRange(localDate, window.weekStartDate, window.weekEndDate)) {
      addTaskCategoryWeights(weekCategoryTotals, task);
      ensureProject(task.projectId, task.projectTitle).completedTasks += 1;
    }
  }

  for (const task of input.rows.plannedTasks) {
    const dueDate = getDueDateKey(task.dueDate);
    if (!dueDate) continue;

    const day = days.get(dueDate);
    if (day) {
      day.plannedTasks += 1;
      if (task.isCompleted === 1) day.completedPlannedTasks += 1;
    }
  }

  for (const session of input.rows.timerSessions) {
    const endedAt = new Date(session.endedAt);
    if (Number.isNaN(endedAt.getTime())) continue;

    const localDate = formatLocalDateKey(endedAt, window.timeZone);
    const day = days.get(localDate);
    const cappedMs = Math.max(0, Math.min(session.accumulatedMs, session.durationSeconds * 1000));

    if (day) {
      focusMsByDay.set(localDate, (focusMsByDay.get(localDate) ?? 0) + cappedMs);
      if (session.state === "completed") day.pomodoros += 1;
    }

    if (isDateInRange(localDate, window.weekStartDate, window.weekEndDate)) {
      const project = ensureProject(session.projectId, session.projectTitle);
      project.focusMinutes += cappedMs / 60_000;
    }
  }

  const reviewedTimeEntries = input.rows.reviewedTimeEntries ?? [];
  for (const entry of reviewedTimeEntries) {
    if (entry.durationMinutes <= 0) continue;

    if (entry.workdayDate === window.todayDate) {
      addTaskCategoryMinutes(todayCategoryTimeTotals, entry);
    }

    if (isDateInRange(entry.workdayDate, window.weekStartDate, window.weekEndDate)) {
      addTaskCategoryMinutes(weekCategoryTimeTotals, entry);
    }
  }

  for (const day of days.values()) {
    day.focusMinutes = Math.round((focusMsByDay.get(day.date) ?? 0) / 60_000);
    day.planCompletionPercent = percent(day.completedPlannedTasks, day.plannedTasks);
  }

  for (const project of projectBreakdown.values()) {
    project.focusMinutes = Math.round(project.focusMinutes);
  }

  const dayList = Array.from(days.values());
  const weekDays = dayList.filter((day) => isDateInRange(day.date, window.weekStartDate, window.tomorrowDate));
  const today = days.get(window.todayDate) ?? createEmptyDay(window.todayDate, window.todayDate);
  const plannedWeekRows = input.rows.plannedTasks.filter((task) => {
    const dueDate = getDueDateKey(task.dueDate);
    return dueDate ? isDateInRange(dueDate, window.weekStartDate, window.weekEndDate) : false;
  });
  const weekPlannedTasks = plannedWeekRows.length;
  const weekCompletedPlannedTasks = plannedWeekRows.filter((task) => task.isCompleted === 1).length;
  const todayReviewedMinutes = reviewedTimeEntries
    .filter((entry) => entry.workdayDate === window.todayDate)
    .reduce((total, entry) => total + Math.max(0, entry.durationMinutes), 0);
  const weekReviewedMinutes = reviewedTimeEntries
    .filter((entry) => isDateInRange(entry.workdayDate, window.weekStartDate, window.weekEndDate))
    .reduce((total, entry) => total + Math.max(0, entry.durationMinutes), 0);
  const productiveWeekDays = weekDays.filter((day) => day.completedTasks > 0);
  const bestDay =
    productiveWeekDays
      .slice()
      .sort((a, b) => b.completedTasks - a.completedTasks || b.completedPlannedTasks - a.completedPlannedTasks)[0] ?? null;

  const recentCompletions: ProgressRecentCompletion[] = input.rows.completedTasks
    .slice()
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      projectTitle: task.projectTitle,
      completedAt: task.completedAt,
      localDate: formatLocalDateKey(new Date(task.completedAt), window.timeZone),
    }));
  const todayPlan: ProgressPlannedTask[] = (input.rows.plannedTaskDetails ?? [])
    .filter((task) => getDueDateKey(task.dueDate) === window.todayDate)
    .sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted - b.isCompleted;
      return a.title.localeCompare(b.title);
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      projectTitle: task.projectTitle,
      isCompleted: task.isCompleted === 1,
      dueDate: task.dueDate,
      completedAt: task.completedAt,
    }));

  return {
    timeZone: window.timeZone,
    generatedAt: (input.generatedAt ?? input.now ?? new Date()).toISOString(),
    todayDate: window.todayDate,
    weekStartDate: window.weekStartDate,
    weekEndDate: window.weekEndDate,
    days: dayList,
    today: {
      completedTasks: today.completedTasks,
      plannedTasks: today.plannedTasks,
      completedPlannedTasks: today.completedPlannedTasks,
      focusMinutes: today.focusMinutes,
      pomodoros: today.pomodoros,
      reviewedMinutes: todayReviewedMinutes,
      planCompletionPercent: today.planCompletionPercent,
    },
    week: {
      completedTasks: weekDays.reduce((total, day) => total + day.completedTasks, 0),
      plannedTasks: weekPlannedTasks,
      completedPlannedTasks: weekCompletedPlannedTasks,
      focusMinutes: weekDays.reduce((total, day) => total + day.focusMinutes, 0),
      pomodoros: weekDays.reduce((total, day) => total + day.pomodoros, 0),
      reviewedMinutes: weekReviewedMinutes,
      productiveDays: productiveWeekDays.length,
      bestDay,
      planCompletionPercent: percent(weekCompletedPlannedTasks, weekPlannedTasks),
    },
    todayPlan,
    todayCategoryBreakdown: buildCategoryBreakdown(todayCategoryTotals),
    weekCategoryBreakdown: buildCategoryBreakdown(weekCategoryTotals),
    todayCategoryTimeBreakdown: buildCategoryTimeBreakdown(todayCategoryTimeTotals),
    weekCategoryTimeBreakdown: buildCategoryTimeBreakdown(weekCategoryTimeTotals),
    projectBreakdown: Array.from(projectBreakdown.values())
      .filter((project) => project.completedTasks > 0)
      .sort((a, b) => b.completedTasks - a.completedTasks || b.focusMinutes - a.focusMinutes)
      .slice(0, 5),
    recentCompletions,
  };
}
