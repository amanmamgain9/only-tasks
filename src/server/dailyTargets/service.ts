import { sqlite } from "@/server/db/client";
import {
  TASK_CATEGORY_DEFINITIONS,
  getTaskCategoryLabel,
  isTaskCategoryId,
  type TaskCategoryId,
} from "@/features/categories/taskCategories";
import type {
  DailyTargetDefinition,
  DailyTargetInput,
  DailyTargetKind,
  DailyTargetSchedule,
  SaveDailyTargetsInput,
} from "@/features/dailyTargets/types";

type DailyTargetRow = {
  id: number;
  category: string;
  status: string;
  targetKind: string;
  targetMinutes: number | null;
  targetCount: number | null;
  schedule: string;
  updatedAt: string;
};

const listTargetsQuery = sqlite.prepare(`
  SELECT
    id,
    category,
    status,
    target_kind AS targetKind,
    target_minutes AS targetMinutes,
    target_count AS targetCount,
    schedule,
    updated_at AS updatedAt
  FROM pmwd_daily_targets
  WHERE user_id = ?
`);

const upsertTargetQuery = sqlite.prepare(`
  INSERT INTO pmwd_daily_targets (
    user_id, category, status, target_kind, target_minutes, target_count, schedule, created_at, updated_at
  )
  VALUES (
    @userId, @category, @status, @targetKind, @targetMinutes, @targetCount, @schedule, @now, @now
  )
  ON CONFLICT(user_id, category) DO UPDATE SET
    status = excluded.status,
    target_kind = excluded.target_kind,
    target_minutes = excluded.target_minutes,
    target_count = excluded.target_count,
    schedule = excluded.schedule,
    updated_at = excluded.updated_at
`);

export function normalizeDailyTargetKind(value: unknown): DailyTargetKind {
  return value === "count" ? "count" : "time";
}

export function normalizeDailyTargetSchedule(value: unknown): DailyTargetSchedule {
  return value === "weekdays" ? "weekdays" : "every_day";
}

function normalizeMinutes(value: unknown) {
  const minutes = Math.round(Number(value) || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.max(1, Math.min(24 * 60, minutes));
}

function normalizeCount(value: unknown) {
  const count = Math.round(Number(value) || 0);
  if (!Number.isFinite(count) || count <= 0) return null;
  return Math.max(1, Math.min(99, count));
}

function defaultTarget(category: TaskCategoryId): DailyTargetDefinition {
  return {
    id: null,
    category,
    label: getTaskCategoryLabel(category),
    enabled: false,
    kind: "time",
    targetMinutes: null,
    targetCount: null,
    schedule: "every_day",
    updatedAt: null,
  };
}

export function normalizeDailyTargetInput(input: DailyTargetInput) {
  if (!isTaskCategoryId(input.category)) {
    throw new Error("Unsupported daily target category.");
  }

  const kind = normalizeDailyTargetKind(input.kind);
  const schedule = normalizeDailyTargetSchedule(input.schedule);
  const targetMinutes = kind === "time" ? normalizeMinutes(input.targetMinutes) : null;
  const targetCount = kind === "count" ? normalizeCount(input.targetCount) : null;
  const enabled = Boolean(input.enabled);

  return {
    category: input.category,
    status: enabled ? "active" : "inactive",
    targetKind: kind,
    targetMinutes: targetMinutes ?? (enabled && kind === "time" ? 60 : null),
    targetCount: targetCount ?? (enabled && kind === "count" ? 1 : null),
    schedule,
  };
}

export function listDailyTargetsForUser(userId: number): DailyTargetDefinition[] {
  const rows = listTargetsQuery.all(userId) as DailyTargetRow[];
  const rowByCategory = new Map<TaskCategoryId, DailyTargetRow>();

  for (const row of rows) {
    if (isTaskCategoryId(row.category)) rowByCategory.set(row.category, row);
  }

  return TASK_CATEGORY_DEFINITIONS.map((definition) => {
    const row = rowByCategory.get(definition.id);
    if (!row) return defaultTarget(definition.id);

    const kind = normalizeDailyTargetKind(row.targetKind);
    return {
      id: row.id,
      category: definition.id,
      label: definition.label,
      enabled: row.status === "active",
      kind,
      targetMinutes: kind === "time" ? normalizeMinutes(row.targetMinutes) : null,
      targetCount: kind === "count" ? normalizeCount(row.targetCount) : null,
      schedule: normalizeDailyTargetSchedule(row.schedule),
      updatedAt: row.updatedAt,
    };
  });
}

export function saveDailyTargetsForUser(
  userId: number,
  input: SaveDailyTargetsInput,
): DailyTargetDefinition[] {
  const normalizedTargets = input.targets.map(normalizeDailyTargetInput);
  const seen = new Set<TaskCategoryId>();

  const save = sqlite.transaction(() => {
    const now = new Date().toISOString();
    for (const target of normalizedTargets) {
      if (seen.has(target.category)) continue;
      seen.add(target.category);
      upsertTargetQuery.run({
        userId,
        category: target.category,
        status: target.status,
        targetKind: target.targetKind,
        targetMinutes: target.targetMinutes,
        targetCount: target.targetCount,
        schedule: target.schedule,
        now,
      });
    }
  });

  save();
  return listDailyTargetsForUser(userId);
}

export function isDailyTargetScheduledForDate(schedule: DailyTargetSchedule, dateKey: string) {
  if (schedule === "every_day") return true;
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return true;
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}
