import type { ApiResponse, Project, SaveProjectInput } from "../types";
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
      }
    : projectData;

  const response = await fetch(url, {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseResponse<Project>(response);
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
