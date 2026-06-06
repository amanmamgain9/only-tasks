import { sqlite } from "@/server/db/client";
import type { TaskCategoryId } from "@/features/categories/taskCategories";
import { materializeRecurringTasksForDateRangeInDatabase } from "@/server/tasks/recurrence";
import { buildProgressSummary, getProgressWindow, type ProgressSourceRows } from "./progress-core";

type CompletedTaskRow = {
  id: number;
  title: string;
  projectId: number | null;
  projectTitle: string | null;
  projectType: string | null;
  completedAt: string;
  dueDate: string | null;
  categoryAllocations: string | null;
};

type PlannedTaskRow = {
  dueDate: string;
  isCompleted: number;
};

type PlannedTaskDetailRow = {
  id: number;
  title: string;
  projectTitle: string | null;
  dueDate: string;
  isCompleted: number;
  completedAt: string | null;
};

type TimerSessionRow = {
  projectId: number | null;
  projectTitle: string | null;
  endedAt: string;
  state: "completed" | "skipped";
  durationSeconds: number;
  accumulatedMs: number;
};

type ReviewedTimeRow = {
  workdayDate: string;
  durationMinutes: number;
  projectType: string | null;
  categoryAllocations: string | null;
  category?: TaskCategoryId | null;
};

const completedTasksQuery = sqlite.prepare(`
  SELECT
    task.id AS id,
    task.title AS title,
    task.project_id AS projectId,
    project.title AS projectTitle,
    project.type AS projectType,
    COALESCE(task.completed_at, task.updated_at) AS completedAt,
    task.due_date AS dueDate,
    task.category_allocations AS categoryAllocations
  FROM pmwd_tasks task
  LEFT JOIN pmwd_projects project ON project.id = task.project_id
  WHERE task.user_id = @userId
    AND task.is_completed = 1
    AND task.deleted = 0
    AND task.archived = 0
    AND task.draft = 0
    AND COALESCE(task.completed_at, task.updated_at) >= @rangeStartUtc
    AND COALESCE(task.completed_at, task.updated_at) < @rangeEndUtc
  ORDER BY COALESCE(task.completed_at, task.updated_at) DESC
`);

const plannedTasksQuery = sqlite.prepare(`
  SELECT
    task.due_date AS dueDate,
    task.is_completed AS isCompleted
  FROM pmwd_tasks task
  WHERE task.user_id = @userId
    AND task.due_date IS NOT NULL
    AND task.deleted = 0
    AND task.archived = 0
    AND task.draft = 0
    AND substr(task.due_date, 1, 10) >= @rangeStartDate
    AND substr(task.due_date, 1, 10) < @rangeEndDate
`);

const plannedTaskDetailsQuery = sqlite.prepare(`
  SELECT
    task.id AS id,
    task.title AS title,
    project.title AS projectTitle,
    task.due_date AS dueDate,
    task.is_completed AS isCompleted,
    task.completed_at AS completedAt
  FROM pmwd_tasks task
  LEFT JOIN pmwd_projects project ON project.id = task.project_id
  WHERE task.user_id = @userId
    AND task.due_date IS NOT NULL
    AND task.deleted = 0
    AND task.archived = 0
    AND task.draft = 0
    AND substr(task.due_date, 1, 10) = @todayDate
  ORDER BY task.is_completed ASC, task.priority ASC, task.position ASC
`);

const timerSessionsQuery = sqlite.prepare(`
  SELECT
    session.project_id AS projectId,
    project.title AS projectTitle,
    session.ended_at AS endedAt,
    session.state AS state,
    session.duration_seconds AS durationSeconds,
    session.accumulated_ms AS accumulatedMs
  FROM pmwd_timer_sessions session
  LEFT JOIN pmwd_projects project ON project.id = session.project_id
  WHERE session.user_id = @userId
    AND session.phase = 'work'
    AND session.state IN ('completed', 'skipped')
    AND session.ended_at IS NOT NULL
    AND session.ended_at >= @rangeStartUtc
    AND session.ended_at < @rangeEndUtc
  ORDER BY session.ended_at DESC
`);

const reviewedTimeQuery = sqlite.prepare(`
  SELECT
    review.workday_date AS workdayDate,
    review.duration_minutes AS durationMinutes,
    project.type AS projectType,
    task.category_allocations AS categoryAllocations,
    NULL AS category
  FROM pmwd_task_time_reviews review
  LEFT JOIN pmwd_tasks task ON task.id = review.task_id
  LEFT JOIN pmwd_projects project ON project.id = review.project_id
  WHERE review.user_id = @userId
    AND review.duration_minutes > 0
    AND review.workday_date >= @rangeStartDate
    AND review.workday_date < @rangeEndDate
  ORDER BY review.workday_date DESC
`);

const targetReviewedTimeQuery = sqlite.prepare(`
  SELECT
    review.workday_date AS workdayDate,
    review.actual_minutes AS durationMinutes,
    NULL AS projectType,
    NULL AS categoryAllocations,
    review.category AS category
  FROM pmwd_daily_target_reviews review
  WHERE review.user_id = @userId
    AND review.actual_minutes IS NOT NULL
    AND review.actual_minutes >= 0
    AND review.workday_date >= @rangeStartDate
    AND review.workday_date < @rangeEndDate
  ORDER BY review.workday_date DESC
`);

export function getProgressSummaryForUser(
  userId: number,
  input: {
    timeZone?: string | null;
    now?: Date;
  } = {},
) {
  const progressWindow = getProgressWindow(input);
  const historyOrWeekStartUtc =
    progressWindow.historyStartUtc < progressWindow.weekStartUtc
      ? progressWindow.historyStartUtc
      : progressWindow.weekStartUtc;
  const historyOrWeekEndUtc =
    progressWindow.historyEndUtc > progressWindow.weekEndUtc
      ? progressWindow.historyEndUtc
      : progressWindow.weekEndUtc;
  const plannedStartDate =
    progressWindow.firstHistoryDate < progressWindow.weekStartDate
      ? progressWindow.firstHistoryDate
      : progressWindow.weekStartDate;
  const plannedEndDate =
    progressWindow.tomorrowDate > progressWindow.weekEndDate
      ? progressWindow.tomorrowDate
      : progressWindow.weekEndDate;

  materializeRecurringTasksForDateRangeInDatabase({
    db: sqlite,
    userId,
    startDate: plannedStartDate,
    endDateExclusive: plannedEndDate,
  });

  const rows: ProgressSourceRows = {
    completedTasks: completedTasksQuery.all({
      userId,
      rangeStartUtc: historyOrWeekStartUtc,
      rangeEndUtc: historyOrWeekEndUtc,
    }) as CompletedTaskRow[],
    plannedTasks: plannedTasksQuery.all({
      userId,
      rangeStartDate: plannedStartDate,
      rangeEndDate: plannedEndDate,
    }) as PlannedTaskRow[],
    plannedTaskDetails: plannedTaskDetailsQuery.all({
      userId,
      todayDate: progressWindow.todayDate,
    }) as PlannedTaskDetailRow[],
    timerSessions: timerSessionsQuery.all({
      userId,
      rangeStartUtc: historyOrWeekStartUtc,
      rangeEndUtc: historyOrWeekEndUtc,
    }) as TimerSessionRow[],
    reviewedTimeEntries: [
      ...(targetReviewedTimeQuery.all({
        userId,
        rangeStartDate: plannedStartDate,
        rangeEndDate: plannedEndDate,
      }) as ReviewedTimeRow[]),
      ...(reviewedTimeQuery.all({
        userId,
        rangeStartDate: plannedStartDate,
        rangeEndDate: plannedEndDate,
      }) as ReviewedTimeRow[]),
    ],
  };

  return buildProgressSummary({
    rows,
    timeZone: progressWindow.timeZone,
    now: input.now,
  });
}
