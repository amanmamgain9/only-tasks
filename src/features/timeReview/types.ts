import type { LifestyleTraitAllocation, TaskCategoryAllocation } from "@/features/categories/taskCategories";

export type ReviewWindow = "same_workday_midday" | "same_workday_end";
export type ReviewPhase = "quiet" | "midday" | "end" | "reviewed";

export type TimeReviewSettings = {
  workdayRolloverTime: string;
  middayReviewEnabled: boolean;
  middayReviewTime: string | null;
};

export type TimeReviewTask = {
  taskId: number;
  title: string;
  projectId: number | null;
  projectTitle: string | null;
  completedAt: string;
  estimatedTimeMinutes: number | null;
  categoryAllocations: TaskCategoryAllocation[];
  lifestyleTraits: LifestyleTraitAllocation[];
  durationMinutes: number;
  startMinute: number | null;
  endMinute: number | null;
  reviewStatus: "draft" | "confirmed";
};

export type TimeReviewEntryInput = {
  taskId: number;
  durationMinutes: number;
  startMinute?: number | null;
  endMinute?: number | null;
};

export type TimeReviewSummary = {
  workdayDate: string;
  timeZone: string;
  generatedAt: string;
  localNowMinutes: number;
  minutesUntilRollover: number;
  reviewWindow: ReviewWindow;
  phase: ReviewPhase;
  settings: TimeReviewSettings;
  tasks: TimeReviewTask[];
  totals: {
    completedTasks: number;
    reviewedTasks: number;
    reviewedMinutes: number;
  };
};

export type SaveTimeReviewInput = {
  timeZone: string;
  entries: TimeReviewEntryInput[];
  settings?: Partial<TimeReviewSettings>;
};
