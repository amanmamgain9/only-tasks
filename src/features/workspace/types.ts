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
  isCompleted: boolean;
  priority: number | null;
  estimatedTimeMinutes: number | null;
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
