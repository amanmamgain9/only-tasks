"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startTransition } from "react";
import { getProjects, saveProject } from "../_services/backendService";
import type { ApiResponse, Project, SaveProjectInput } from "../types";

export const projectsKey = ["projects"];

type ProjectQueryParams = Record<string, string | number | boolean | undefined | null>;

export function useProjects(queryParams?: ProjectQueryParams) {
  return useQuery<ApiResponse<Project[]> | null>({
    queryKey: queryParams ? [...projectsKey, queryParams] : projectsKey,
    queryFn: () => getProjects(queryParams),
  });
}

export function useSaveProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Project>, Error, SaveProjectInput>({
    mutationFn: saveProject,
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: projectsKey });
      });
    },
  });
}
