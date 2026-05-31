import type { TaskCategoryId } from "@/features/categories/taskCategories";

export type ProgressDay = {
  date: string;
  label: string;
  weekday: string;
  isToday: boolean;
  completedTasks: number;
  plannedTasks: number;
  completedPlannedTasks: number;
  focusMinutes: number;
  pomodoros: number;
  planCompletionPercent: number;
};

export type ProgressProjectBreakdown = {
  projectId: number | null;
  title: string;
  completedTasks: number;
  focusMinutes: number;
};

export type ProgressCategoryBreakdown = {
  category: TaskCategoryId;
  label: string;
  weightedTasks: number;
  percent: number;
};

export type ProgressRecentCompletion = {
  id: number;
  title: string;
  projectTitle: string | null;
  completedAt: string;
  localDate: string;
};

export type ProgressPlannedTask = {
  id: number;
  title: string;
  projectTitle: string | null;
  isCompleted: boolean;
  dueDate: string;
  completedAt: string | null;
};

export type ProgressSummary = {
  timeZone: string;
  generatedAt: string;
  todayDate: string;
  weekStartDate: string;
  weekEndDate: string;
  days: ProgressDay[];
  today: {
    completedTasks: number;
    plannedTasks: number;
    completedPlannedTasks: number;
    focusMinutes: number;
    pomodoros: number;
    planCompletionPercent: number;
  };
  week: {
    completedTasks: number;
    plannedTasks: number;
    completedPlannedTasks: number;
    focusMinutes: number;
    pomodoros: number;
    productiveDays: number;
    bestDay: ProgressDay | null;
    planCompletionPercent: number;
  };
  todayPlan: ProgressPlannedTask[];
  todayCategoryBreakdown: ProgressCategoryBreakdown[];
  weekCategoryBreakdown: ProgressCategoryBreakdown[];
  projectBreakdown: ProgressProjectBreakdown[];
  recentCompletions: ProgressRecentCompletion[];
};
