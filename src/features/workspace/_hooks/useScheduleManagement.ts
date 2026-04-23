"use client";

import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../_services/backendService";
import type { ApiResponse, Project } from "../types";

export const projectsKey = ["projects"];

type ProjectQueryParams = Record<string, string | number | boolean | undefined | null>;

export function useProjects(queryParams?: ProjectQueryParams) {
  return useQuery<ApiResponse<Project[]> | null>({
    queryKey: queryParams ? [...projectsKey, queryParams] : projectsKey,
    queryFn: () => getProjects(),
  });
}
