import type { ApiResponse, Project } from "../types";
import type { EnhancedTaskTreeType, OperationBatch } from "../components/MyWorkplaceComponents/TaskTreeComponents/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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

export const getProjects = async (): Promise<ApiResponse<Project[]> | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: "POST",
      cache: "no-store",
    });
    return await parseResponse<Project[]>(response);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return null;
  }
};

export const getProjectTree = async (
  projectId: number,
  params?: {
    dueDate?: "today" | "tomorrow" | "this-week";
    chatId?: number;
  },
): Promise<ApiResponse<EnhancedTaskTreeType[]> | null> => {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("projectId", projectId.toString());
    if (params?.chatId) {
      searchParams.append("chatId", params.chatId.toString());
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
