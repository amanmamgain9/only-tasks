import { sqlite } from "@/server/db/client";
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
  };

  return buildProgressSummary({
    rows,
    timeZone: progressWindow.timeZone,
    now: input.now,
  });
}
