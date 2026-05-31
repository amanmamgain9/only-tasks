"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiResponse } from "../types";
import type { ProgressSummary } from "@/features/progress/types";
import { getProgressSummary } from "../_services/backendService";

export const progressSummaryKey = ["progress", "summary"];

export function useProgressSummary(timeZone: string) {
  return useQuery<ApiResponse<ProgressSummary> | null>({
    queryKey: [...progressSummaryKey, timeZone],
    queryFn: () => getProgressSummary(timeZone),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
