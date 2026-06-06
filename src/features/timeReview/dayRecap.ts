import {
  LIFESTYLE_TRAIT_DEFINITIONS,
  TASK_CATEGORY_DEFINITIONS,
  type LifestyleTraitAllocation,
  type LifestyleTraitId,
  type TaskCategoryAllocation,
  type TaskCategoryId,
} from "../categories/taskCategories";
import type { TimeReviewPlannedTask, TimeReviewSummary, TimeReviewTarget, TimeReviewTask } from "./types";

export type DayRecapRowId = Exclude<TaskCategoryId, "lifestyle"> | LifestyleTraitId;

export type DayRecapRow = {
  id: DayRecapRowId;
  label: string;
  metric: "time" | "tasks";
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
  secondaryMetric: "tasks" | null;
  totalDoneValue: number;
  totalPromisedValue: number;
  secondaryTotalDoneValue: number;
  secondaryTotalPromisedValue: number;
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
        metric: "tasks",
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

function withoutSkippedCategories(
  allocations: TaskCategoryAllocation[],
  skippedCategories: Set<TaskCategoryId>,
) {
  return allocations.filter((allocation) => !skippedCategories.has(allocation.category));
}

function addPromisedTask(
  rows: Map<DayRecapRowId, DayRecapRow>,
  task: TimeReviewPlannedTask,
  options: {
    minuteTargetCategories: Set<TaskCategoryId>;
    countTargetCategories: Set<TaskCategoryId>;
  },
) {
  addAllocationToRows(rows, {
    minutes: task.estimatedTimeMinutes ?? 0,
    taskWeight: 0,
    target: "promised",
    categoryAllocations: withoutSkippedCategories(task.categoryAllocations, options.minuteTargetCategories),
    lifestyleTraits: task.lifestyleTraits,
  });

  addAllocationToRows(rows, {
    minutes: 0,
    taskWeight: 1,
    target: "promised",
    categoryAllocations: withoutSkippedCategories(task.categoryAllocations, options.countTargetCategories),
    lifestyleTraits: task.lifestyleTraits,
  });
}

function addCompletedTask(
  rows: Map<DayRecapRowId, DayRecapRow>,
  task: TimeReviewTask,
  options: {
    reviewedMinuteTargetCategories: Set<TaskCategoryId>;
    reviewedCountTargetCategories: Set<TaskCategoryId>;
  },
) {
  addAllocationToRows(rows, {
    minutes: task.durationMinutes,
    taskWeight: 0,
    target: "done",
    categoryAllocations: withoutSkippedCategories(task.categoryAllocations, options.reviewedMinuteTargetCategories),
    lifestyleTraits: task.lifestyleTraits,
  });

  addAllocationToRows(rows, {
    minutes: 0,
    taskWeight: 1,
    target: "done",
    categoryAllocations: withoutSkippedCategories(task.categoryAllocations, options.reviewedCountTargetCategories),
    lifestyleTraits: task.lifestyleTraits,
  });
}

function addTargetPromise(rows: Map<DayRecapRowId, DayRecapRow>, target: TimeReviewTarget) {
  addAllocationToRows(rows, {
    minutes: target.kind === "time" ? target.targetMinutes ?? 0 : 0,
    taskWeight: target.kind === "count" ? target.targetCount ?? 0 : 0,
    target: "promised",
    categoryAllocations: [{ category: target.category, weight: 100 }],
    lifestyleTraits: [],
  });
}

function addTargetProof(rows: Map<DayRecapRowId, DayRecapRow>, target: TimeReviewTarget) {
  addAllocationToRows(rows, {
    minutes: target.kind === "time" ? target.reviewedMinutes : 0,
    taskWeight: target.kind === "count" ? target.reviewedCount : 0,
    target: "done",
    categoryAllocations: [{ category: target.category, weight: 100 }],
    lifestyleTraits: [],
  });
}

function getTargetRowIds(target: Pick<TimeReviewTarget, "category">): DayRecapRowId[] {
  if (target.category === "lifestyle") {
    return LIFESTYLE_TRAIT_DEFINITIONS.map((definition) => definition.id);
  }

  return [target.category];
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
  const activeTargets = summary.targets.filter((target) => target.appliesToday && (target.enabled || target.reviewStatus === "confirmed"));
  const activeTimeTargets = activeTargets.filter((target) => target.kind === "time");
  const activeCountTargets = activeTargets.filter((target) => target.kind === "count");
  const reviewedTimeTargets = activeTimeTargets.filter((target) => target.reviewStatus === "confirmed");
  const reviewedCountTargets = activeCountTargets.filter((target) => target.reviewStatus === "confirmed");
  const minuteTargetCategories = new Set(activeTimeTargets.map((target) => target.category));
  const countTargetCategories = new Set(activeCountTargets.map((target) => target.category));
  const reviewedMinuteTargetCategories = new Set(reviewedTimeTargets.map((target) => target.category));
  const reviewedCountTargetCategories = new Set(reviewedCountTargets.map((target) => target.category));
  const promisedMinuteCoveredCategories = new Set([...minuteTargetCategories, ...countTargetCategories]);
  const reviewedMinuteCoveredCategories = new Set([...reviewedMinuteTargetCategories, ...countTargetCategories]);

  for (const task of summary.plannedTasks) {
    addPromisedTask(rows, task, {
      minuteTargetCategories: promisedMinuteCoveredCategories,
      countTargetCategories,
    });
  }

  for (const task of summary.tasks) {
    addCompletedTask(rows, task, {
      reviewedMinuteTargetCategories: reviewedMinuteCoveredCategories,
      reviewedCountTargetCategories,
    });
  }

  for (const target of activeTargets) {
    addTargetPromise(rows, target);
  }

  for (const target of [...reviewedTimeTargets, ...reviewedCountTargets]) {
    addTargetProof(rows, target);
  }

  const rawRows = ROWS.map((row) => rows.get(row.id))
    .filter((row): row is DayRecapRow => Boolean(row));
  const totalDoneMinutes = Math.round(rawRows.reduce((total, row) => total + row.doneMinutes, 0));
  const totalPromisedMinutes = Math.round(rawRows.reduce((total, row) => total + row.promisedMinutes, 0));
  const totalDoneTaskWeight = Math.round(rawRows.reduce((total, row) => total + row.completedTaskWeight, 0) * 10) / 10;
  const totalPromisedTaskWeight = Math.round(rawRows.reduce((total, row) => total + row.promisedTaskWeight, 0) * 10) / 10;
  const primaryMetric = totalPromisedMinutes > 0 && (totalDoneMinutes > 0 || activeTimeTargets.length > 0) ? "time" : "tasks";
  const timeTargetRowIds = new Set(activeTimeTargets.flatMap(getTargetRowIds));

  const orderedRows = ROWS.map((row) => rows.get(row.id))
    .filter((row): row is DayRecapRow => Boolean(row))
    .map((row) => {
      const metric: DayRecapRow["metric"] = primaryMetric === "tasks" && !timeTargetRowIds.has(row.id)
        ? "tasks"
        : row.doneMinutes > 0 || row.promisedMinutes > 0
          ? "time"
          : "tasks";
      const doneMinutes = Math.round(row.doneMinutes);
      const promisedMinutes = Math.round(row.promisedMinutes);
      const completedTaskWeight = Math.round(row.completedTaskWeight * 10) / 10;
      const promisedTaskWeight = Math.round(row.promisedTaskWeight * 10) / 10;

      return {
        ...row,
        metric,
        doneMinutes,
        promisedMinutes,
        completedTaskWeight,
        promisedTaskWeight,
        doneValue: metric === "time" ? doneMinutes : completedTaskWeight,
        promisedValue: metric === "time" ? promisedMinutes : promisedTaskWeight,
      };
    });
  const secondaryMetric = primaryMetric === "time"
    && orderedRows.some((row) => row.metric === "tasks" && (row.doneValue > 0 || row.promisedValue > 0))
    ? "tasks"
    : null;
  const secondaryTotalDoneValue = secondaryMetric
    ? Math.round(orderedRows
      .filter((row) => row.metric === secondaryMetric)
      .reduce((total, row) => total + row.doneValue, 0) * 10) / 10
    : 0;
  const secondaryTotalPromisedValue = secondaryMetric
    ? Math.round(orderedRows
      .filter((row) => row.metric === secondaryMetric)
      .reduce((total, row) => total + row.promisedValue, 0) * 10) / 10
    : 0;

  return {
    rows: orderedRows,
    primaryMetric,
    secondaryMetric,
    totalDoneValue: primaryMetric === "time" ? totalDoneMinutes : totalDoneTaskWeight,
    totalPromisedValue: primaryMetric === "time" ? totalPromisedMinutes : totalPromisedTaskWeight,
    secondaryTotalDoneValue,
    secondaryTotalPromisedValue,
    totalDoneMinutes,
    totalPromisedMinutes,
    tasksClosed: summary.totals.completedTasks,
    tasksPromised: totalPromisedTaskWeight,
    title: getRecapTitle(orderedRows),
  };
}
