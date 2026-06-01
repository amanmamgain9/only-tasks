import type { LifestyleTraitAllocation, TaskCategoryAllocation } from "@/features/categories/taskCategories";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Project {
  id: number;
  userId: number;
  title: string;
  status: "active" | "completed" | "on_hold" | "cancelled" | "archived";
  targetDate: string | null;
  type: "main" | "side_project" | "chore";
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  draft?: number;
  createdByChatId?: number | null;
}

export type ProjectFormData = {
  title: string;
  type: Project["type"];
};

export type CreateProjectInput = ProjectFormData;

export type UpdateProjectInput = Partial<ProjectFormData> & {
  id: number;
  status?: Project["status"];
  targetDate?: string | null;
};

export type SaveProjectInput = CreateProjectInput | UpdateProjectInput;
export type ProjectStatus = Project["status"];

export interface Task {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  parentTaskId: number | null;
  projectId: number | null;
  dueDate: string | null;
  originalDueDate?: string | null;
  rolloverHistory?: string | null;
  isCompleted: boolean;
  priority: number | null;
  estimatedTimeMinutes: number | null;
  completedAt?: string | null;
  categoryAllocations?: TaskCategoryAllocation[] | string | null;
  lifestyleTraits?: LifestyleTraitAllocation[] | string | null;
  systemType?: string | null;
  recurrenceSeriesId?: number | null;
  recurrenceRole?: "template" | "occurrence_root" | "occurrence_child" | null;
  recurrenceTemplateTaskId?: number | null;
  recurrenceOccurrenceDate?: string | null;
  recurrenceStatus?: "scheduled" | "skipped" | null;
  recurrenceIsOverride?: number | boolean | null;
  createdAt: string;
  updatedAt: string;
  subtasks?: Task[];
  position: string;
  clientId?: string | null;
  archived?: boolean;
  deleted?: boolean;
  path?: string;
}

type TaskData = Omit<Task, "id" | "userId" | "createdAt" | "updatedAt" | "subtasks"> & {
  subtasks?: Partial<Task>[];
};

export type TaskTreeType = {
  id?: number;
  title?: string;
  isCompleted?: boolean;
  subtasks?: TaskTreeType[];
} & Partial<Omit<TaskData, "subtasks">>;

export type TimerPhase = "work" | "short_break" | "long_break";
export type TimerSessionState = "running" | "paused" | "completed" | "skipped";

export interface TimerSettings {
  focusDurationMinutes: number;
  shortBreakDurationMinutes: number;
  longBreakDurationMinutes: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
  selectedSound: string;
}

export interface TimerSession {
  id: number;
  userId: number;
  taskId: number | null;
  taskTitle: string | null;
  projectId: number | null;
  phase: TimerPhase;
  state: TimerSessionState;
  workSessionNumber: number;
  durationSeconds: number;
  accumulatedMs: number;
  startedAt: string;
  lastResumedAt: string | null;
  pausedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NextTimerSession {
  phase: TimerPhase;
  workSessionNumber: number;
  durationSeconds: number;
}

export interface TimerStatus {
  activeSession: TimerSession | null;
  nextSession: NextTimerSession;
  settings: TimerSettings;
  serverNow: string;
}
