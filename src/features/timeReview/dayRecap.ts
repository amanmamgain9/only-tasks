import {
  LIFESTYLE_TRAIT_DEFINITIONS,
  TASK_CATEGORY_DEFINITIONS,
  type LifestyleTraitAllocation,
  type LifestyleTraitId,
  type TaskCategoryAllocation,
  type TaskCategoryId,
} from "../categories/taskCategories";
import type { TimeReviewPlannedTask, TimeReviewSummary, TimeReviewTask } from "./types";

export type DayRecapRowId = Exclude<TaskCategoryId, "lifestyle"> | LifestyleTraitId;

export type DayRecapRow = {
  id: DayRecapRowId;
  label: string;
  doneMinutes: number;
  promisedMinutes: number;
  completedTaskWeight: number;
  promisedTaskWeight: number;
  doneValue: number;
  promisedValue: number;
};

export type DayRecapSummary = {
  rows: DayRecapRow[];
  primaryMetric: "time" | "tasks";
  totalDoneValue: number;
  totalPromisedValue: number;
  totalDoneMinutes: number;
  totalPromisedMinutes: number;
  tasksClosed: number;
  tasksPromised: number;
  title: string;
};

const ROWS: Array<{ id: DayRecapRowId; label: string }> = [
  { id: "job", label: TASK_CATEGORY_DEFINITIONS.find((definition) => definition.id === "job")?.label ?? "Main Work" },
  { id: "side_project", label: TASK_CATEGORY_DEFINITIONS.find((definition) => definition.id === "side_project")?.label ?? "Side Project" },
  ...LIFESTYLE_TRAIT_DEFINITIONS.map((definition) => ({ id: definition.id, label: definition.label })),
  { id: "chore", label: TASK_CATEGORY_DEFINITIONS.find((definition) => definition.id === "chore")?.label ?? "Chore" },
];

function createEmptyRows() {
  return new Map<DayRecapRowId, DayRecapRow>(
    ROWS.map((row) => [
      row.id,
      {
        ...row,
        doneMinutes: 0,
        promisedMinutes: 0,
        completedTaskWeight: 0,
        promisedTaskWeight: 0,
        doneValue: 0,
        promisedValue: 0,
      },
    ]),
  );
}

function getLifestyleTraitAllocations(traits: LifestyleTraitAllocation[]) {
  if (traits.length > 0) return traits;

  const evenWeight = Math.floor(100 / LIFESTYLE_TRAIT_DEFINITIONS.length);
  let remainder = 100 - evenWeight * LIFESTYLE_TRAIT_DEFINITIONS.length;
  return LIFESTYLE_TRAIT_DEFINITIONS.map((definition) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { trait: definition.id, weight: evenWeight + extra };
  });
}

function addAllocationToRows(
  rows: Map<DayRecapRowId, DayRecapRow>,
  input: {
    minutes: number;
    taskWeight: number;
    target: "done" | "promised";
    categoryAllocations: TaskCategoryAllocation[];
    lifestyleTraits: LifestyleTraitAllocation[];
  },
) {
  if (input.minutes <= 0 && input.taskWeight <= 0) return;

  for (const allocation of input.categoryAllocations) {
    const categoryShare = allocation.weight / 100;

    if (allocation.category === "lifestyle") {
      for (const traitAllocation of getLifestyleTraitAllocations(input.lifestyleTraits)) {
        const row = rows.get(traitAllocation.trait);
        if (!row) continue;

        const share = categoryShare * (traitAllocation.weight / 100);
        if (input.target === "done") {
          row.doneMinutes += input.minutes * share;
          row.completedTaskWeight += input.taskWeight * share;
        } else {
          row.promisedMinutes += input.minutes * share;
          row.promisedTaskWeight += input.taskWeight * share;
        }
      }
      continue;
    }

    const row = rows.get(allocation.category);
    if (!row) continue;

    if (input.target === "done") {
      row.doneMinutes += input.minutes * categoryShare;
      row.completedTaskWeight += input.taskWeight * categoryShare;
    } else {
      row.promisedMinutes += input.minutes * categoryShare;
      row.promisedTaskWeight += input.taskWeight * categoryShare;
    }
  }
}

function addPromisedTask(rows: Map<DayRecapRowId, DayRecapRow>, task: TimeReviewPlannedTask) {
  addAllocationToRows(rows, {
    minutes: task.estimatedTimeMinutes ?? 0,
    taskWeight: 1,
    target: "promised",
    categoryAllocations: task.categoryAllocations,
    lifestyleTraits: task.lifestyleTraits,
  });
}

function addCompletedTask(rows: Map<DayRecapRowId, DayRecapRow>, task: TimeReviewTask) {
  addAllocationToRows(rows, {
    minutes: task.durationMinutes,
    taskWeight: 1,
    target: "done",
    categoryAllocations: task.categoryAllocations,
    lifestyleTraits: task.lifestyleTraits,
  });
}

function getRecapTitle(rows: DayRecapRow[]) {
  const mostDone = rows
    .filter((row) => row.doneValue > 0)
    .slice()
    .sort((a, b) => b.doneValue - a.doneValue || b.doneValue - b.promisedValue - (a.doneValue - a.promisedValue))[0];

  if (!mostDone) return "DAY NEEDS SHAPE";
  if (mostDone.id === "side_project" && mostDone.doneValue >= mostDone.promisedValue) return "SIDE PROJECT WON";
  if (mostDone.id === "job") return "MAIN WORK MOVED";
  if (mostDone.id === "chore") return "CHORES CLEARED";
  return `${mostDone.label.toUpperCase()} LED`;
}

export function buildDayRecapSummary(summary: TimeReviewSummary): DayRecapSummary {
  const rows = createEmptyRows();
  const totalDoneMinutes = summary.totals.reviewedMinutes;
  const totalPromisedMinutes = summary.plannedTasks.reduce((total, task) => total + (task.estimatedTimeMinutes ?? 0), 0);
  const primaryMetric = totalDoneMinutes > 0 && totalPromisedMinutes > 0 ? "time" : "tasks";

  for (const task of summary.plannedTasks) {
    addPromisedTask(rows, task);
  }

  for (const task of summary.tasks) {
    addCompletedTask(rows, task);
  }

  const orderedRows = ROWS.map((row) => rows.get(row.id))
    .filter((row): row is DayRecapRow => Boolean(row))
    .map((row) => ({
      ...row,
      doneMinutes: Math.round(row.doneMinutes),
      promisedMinutes: Math.round(row.promisedMinutes),
      completedTaskWeight: Math.round(row.completedTaskWeight * 10) / 10,
      promisedTaskWeight: Math.round(row.promisedTaskWeight * 10) / 10,
      doneValue: primaryMetric === "time"
        ? Math.round(row.doneMinutes)
        : Math.round(row.completedTaskWeight * 10) / 10,
      promisedValue: primaryMetric === "time"
        ? Math.round(row.promisedMinutes)
        : Math.round(row.promisedTaskWeight * 10) / 10,
    }));

  return {
    rows: orderedRows,
    primaryMetric,
    totalDoneValue: primaryMetric === "time" ? totalDoneMinutes : summary.totals.completedTasks,
    totalPromisedValue: primaryMetric === "time" ? totalPromisedMinutes : summary.plannedTasks.length,
    totalDoneMinutes,
    totalPromisedMinutes,
    tasksClosed: summary.totals.completedTasks,
    tasksPromised: summary.plannedTasks.length,
    title: getRecapTitle(orderedRows),
  };
}
