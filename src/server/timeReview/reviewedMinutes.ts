import type { TimeReviewTarget, TimeReviewTask } from "@/features/timeReview/types";

export function calculateReviewedMinutesForSummary(input: {
  tasks: TimeReviewTask[];
  targets: TimeReviewTarget[];
}) {
  const confirmedTimeTargets = input.targets.filter((target) => (
    target.reviewStatus === "confirmed" && target.kind === "time"
  ));
  const coveredCategories = new Set(confirmedTimeTargets.map((target) => target.category));
  const targetReviewedMinutes = Math.round(
    confirmedTimeTargets.reduce((sum, target) => sum + Math.max(0, target.reviewedMinutes), 0),
  );

  const uncoveredTaskReviewedMinutes = input.tasks.reduce((sum, task) => {
    const durationMinutes = Math.max(0, task.durationMinutes);
    if (durationMinutes <= 0) return sum;

    const uncoveredWeight = task.categoryAllocations
      .filter((allocation) => !coveredCategories.has(allocation.category))
      .reduce((total, allocation) => total + Math.max(0, allocation.weight), 0);

    return sum + durationMinutes * Math.min(100, uncoveredWeight) / 100;
  }, 0);

  return {
    reviewedMinutes: Math.round(targetReviewedMinutes + uncoveredTaskReviewedMinutes),
    targetReviewedMinutes,
  };
}
