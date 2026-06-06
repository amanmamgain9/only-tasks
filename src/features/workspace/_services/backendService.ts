import type { ProgressSummary } from "@/features/progress/types";
import type { DailyTargetDefinition, SaveDailyTargetsInput } from "@/features/dailyTargets/types";
import type { SaveTimeReviewInput, TimeReviewSummary } from "@/features/timeReview/types";
import type { RecurrenceAssistantThread } from "@/features/ai/types";
import type { ApiResponse, Project, SaveProjectInput, TimerSettings, TimerStatus } from "../types";
import type { EnhancedTaskTreeType, OperationBatch } from "../components/MyWorkplaceComponents/TaskTreeComponents/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type QueryParamValue = string | number | boolean | string[] | undefined | null;
type QueryParams = Record<string, QueryParamValue>;

interface ErrorResponse {
  message?: string;
  error?: string;
}

const parseResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  if (!response.ok) {
    let errorData: ErrorResponse = {};
    try {
      errorData = (await response.json()) as ErrorResponse;
    } catch {
      // ignore invalid error payloads
    }
    throw new Error(errorData.error || errorData.message || response.statusText);
  }

  return (await response.json()) as ApiResponse<T>;
};

const toQueryString = (queryParams?: QueryParams): string => {
  const searchParams = new URLSearchParams();

  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item.toString()));
      return;
    }

    searchParams.append(key, value.toString());
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const getProjects = async (queryParams?: QueryParams): Promise<ApiResponse<Project[]> | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects${toQueryString(queryParams)}`, {
      method: "POST",
      cache: "no-store",
    });
    return await parseResponse<Project[]>(response);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return null;
  }
};

export const saveProject = async (projectData: SaveProjectInput): Promise<ApiResponse<Project>> => {
  const isUpdate = "id" in projectData;
  const url = isUpdate ? `${API_BASE_URL}/api/projects/${projectData.id}` : `${API_BASE_URL}/api/projects`;
  const body = isUpdate
    ? {
        title: projectData.title,
        type: projectData.type,
        status: projectData.status,
        targetDate: projectData.targetDate,
      }
    : projectData;

  const response = await fetch(url, {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseResponse<Project>(response);
};

export const deleteProject = async (projectId: number): Promise<ApiResponse<Project>> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}`, {
    method: "DELETE",
  });

  return parseResponse<Project>(response);
};

export const archiveProject = async (projectId: number): Promise<ApiResponse<Project>> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/archive`, {
    method: "POST",
  });

  return parseResponse<Project>(response);
};

export const unarchiveProject = async (projectId: number): Promise<ApiResponse<Project>> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/unarchive`, {
    method: "POST",
  });

  return parseResponse<Project>(response);
};

export const getProjectTree = async (
  projectId: number,
  params?: {
    dueDate?: "today" | "tomorrow" | "this-week";
    chatId?: number;
    timeZone?: string;
  },
): Promise<ApiResponse<EnhancedTaskTreeType[]> | null> => {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("projectId", projectId.toString());
    if (params?.chatId) {
      searchParams.append("chatId", params.chatId.toString());
    }
    if (params?.timeZone) {
      searchParams.append("timeZone", params.timeZone);
    }

    const url = params?.dueDate
      ? `${API_BASE_URL}/api/tasks/scheduled/${params.dueDate}?${searchParams.toString()}`
      : `${API_BASE_URL}/api/projects/${projectId}/tree?${searchParams.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
    });
    return await parseResponse<EnhancedTaskTreeType[]>(response);
  } catch (error) {
    console.error("Error fetching project tree:", error);
    return null;
  }
};

export const applyOperationBatch = async (
  batch: OperationBatch,
): Promise<ApiResponse<EnhancedTaskTreeType[]>> => {
  const response = await fetch(`${API_BASE_URL}/api/tasks/operations/apply-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });

  return parseResponse<EnhancedTaskTreeType[]>(response);
};

export const getRecurrenceAssistantThread = async (
  taskClientId: string,
): Promise<ApiResponse<RecurrenceAssistantThread>> => {
  const response = await fetch(`${API_BASE_URL}/api/assistant/recurrence/thread${toQueryString({ taskClientId })}`, {
    method: "GET",
    cache: "no-store",
  });

  return parseResponse<RecurrenceAssistantThread>(response);
};

export const sendRecurrenceAssistantMessage = async (input: {
  taskClientId: string;
  prompt: string;
  todayDate?: string;
  initialStartDate?: string | null;
}): Promise<ApiResponse<RecurrenceAssistantThread>> => {
  const response = await fetch(`${API_BASE_URL}/api/assistant/recurrence/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<RecurrenceAssistantThread>(response);
};

export const getTimerStatus = async (): Promise<ApiResponse<TimerStatus> | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/timer`, {
      method: "GET",
      cache: "no-store",
    });
    return await parseResponse<TimerStatus>(response);
  } catch (error) {
    console.error("Error fetching timer:", error);
    return null;
  }
};

export const getProgressSummary = async (timeZone: string): Promise<ApiResponse<ProgressSummary> | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/progress/summary${toQueryString({ timeZone })}`, {
      method: "GET",
      cache: "no-store",
    });
    return await parseResponse<ProgressSummary>(response);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return null;
  }
};

export const getTodayTimeReview = async (timeZone: string): Promise<ApiResponse<TimeReviewSummary> | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/time-review/today${toQueryString({ timeZone })}`, {
      method: "GET",
      cache: "no-store",
    });
    return await parseResponse<TimeReviewSummary>(response);
  } catch (error) {
    console.error("Error fetching time review:", error);
    return null;
  }
};

export const saveTodayTimeReview = async (input: SaveTimeReviewInput): Promise<ApiResponse<TimeReviewSummary>> => {
  const response = await fetch(`${API_BASE_URL}/api/time-review/today`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<TimeReviewSummary>(response);
};

export const getDailyTargets = async (): Promise<ApiResponse<DailyTargetDefinition[]> | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-targets`, {
      method: "GET",
      cache: "no-store",
    });
    return await parseResponse<DailyTargetDefinition[]>(response);
  } catch (error) {
    console.error("Error fetching daily targets:", error);
    return null;
  }
};

export const saveDailyTargets = async (input: SaveDailyTargetsInput): Promise<ApiResponse<DailyTargetDefinition[]>> => {
  const response = await fetch(`${API_BASE_URL}/api/daily-targets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<DailyTargetDefinition[]>(response);
};

export const startTimer = async (input: {
  phase?: TimerStatus["nextSession"]["phase"];
  durationSeconds?: number;
  taskId?: number | null;
  clientMutationId?: string;
}): Promise<ApiResponse<TimerStatus>> => {
  const response = await fetch(`${API_BASE_URL}/api/timer/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return parseResponse<TimerStatus>(response);
};

function postTimerAction(timerId: number, action: "pause" | "resume" | "skip" | "complete" | "reset") {
  return fetch(`${API_BASE_URL}/api/timer/${timerId}/${action}`, {
    method: "POST",
  }).then((response) => parseResponse<TimerStatus>(response));
}

export const pauseTimer = (timerId: number) => postTimerAction(timerId, "pause");
export const resumeTimer = (timerId: number) => postTimerAction(timerId, "resume");
export const skipTimer = (timerId: number) => postTimerAction(timerId, "skip");
export const completeTimer = (timerId: number) => postTimerAction(timerId, "complete");
export const resetTimer = (timerId: number) => postTimerAction(timerId, "reset");

export const saveTimerSettings = async (settings: TimerSettings): Promise<ApiResponse<TimerSettings>> => {
  const response = await fetch(`${API_BASE_URL}/api/timer/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });

  return parseResponse<TimerSettings>(response);
};
