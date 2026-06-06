"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startTransition } from "react";
import type { DailyTargetDefinition, SaveDailyTargetsInput } from "@/features/dailyTargets/types";
import type { ApiResponse } from "../types";
import { getDailyTargets, saveDailyTargets } from "../_services/backendService";
import { progressSummaryKey } from "./useProgressSummary";
import { timeReviewKey } from "./useTimeReview";

export const dailyTargetsKey = ["daily-targets"];

export function useDailyTargets() {
  return useQuery<ApiResponse<DailyTargetDefinition[]> | null>({
    queryKey: dailyTargetsKey,
    queryFn: getDailyTargets,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useSaveDailyTargets() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<DailyTargetDefinition[]>, Error, SaveDailyTargetsInput>({
    mutationFn: saveDailyTargets,
    onSuccess: (data) => {
      if (data?.success && data.data) {
        queryClient.setQueryData(dailyTargetsKey, data);
      }

      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: dailyTargetsKey });
        queryClient.invalidateQueries({ queryKey: timeReviewKey });
        queryClient.invalidateQueries({ queryKey: progressSummaryKey });
      });
    },
  });
}
