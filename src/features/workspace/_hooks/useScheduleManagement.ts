"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startTransition } from "react";
import {
  archiveProject,
  deleteProject,
  getProjects,
  saveProject,
  unarchiveProject,
} from "../_services/backendService";
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

function useProjectLifecycleMutation(mutationFn: (projectId: number) => Promise<ApiResponse<Project>>) {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<Project>, Error, number>({
    mutationFn,
    onSuccess: () => {
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: projectsKey });
      });
    },
  });
}

export function useDeleteProjectMutation() {
  return useProjectLifecycleMutation(deleteProject);
}

export function useArchiveProjectMutation() {
  return useProjectLifecycleMutation(archiveProject);
}

export function useUnarchiveProjectMutation() {
  return useProjectLifecycleMutation(unarchiveProject);
}
