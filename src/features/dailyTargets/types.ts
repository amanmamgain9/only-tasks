import type { TaskCategoryId } from "@/features/categories/taskCategories";

export type DailyTargetKind = "time" | "count";
export type DailyTargetSchedule = "every_day" | "weekdays";

export type DailyTargetDefinition = {
  id: number | null;
  category: TaskCategoryId;
  label: string;
  enabled: boolean;
  kind: DailyTargetKind;
  targetMinutes: number | null;
  targetCount: number | null;
  schedule: DailyTargetSchedule;
  updatedAt: string | null;
};

export type DailyTargetInput = {
  category: TaskCategoryId;
  enabled: boolean;
  kind: DailyTargetKind;
  targetMinutes?: number | null;
  targetCount?: number | null;
  schedule?: DailyTargetSchedule;
};

export type SaveDailyTargetsInput = {
  targets: DailyTargetInput[];
};
