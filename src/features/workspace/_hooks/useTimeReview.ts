"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startTransition } from "react";
import type { SaveTimeReviewInput, TimeReviewSummary } from "@/features/timeReview/types";
import type { ApiResponse } from "../types";
import { getTodayTimeReview, saveTodayTimeReview } from "../_services/backendService";
import { progressSummaryKey } from "./useProgressSummary";

export const timeReviewKey = ["time-review", "today"];

export function useTodayTimeReview(timeZone: string) {
  return useQuery<ApiResponse<TimeReviewSummary> | null>({
    queryKey: [...timeReviewKey, timeZone],
    queryFn: () => getTodayTimeReview(timeZone),
  });
}

export function useSaveTodayTimeReview() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimeReviewSummary>, Error, SaveTimeReviewInput>({
    mutationFn: saveTodayTimeReview,
    onSuccess: (data, input) => {
      if (data?.success && data.data) {
        queryClient.setQueryData([...timeReviewKey, input.timeZone], data);
      }

      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: [...timeReviewKey, input.timeZone] });
        queryClient.invalidateQueries({ queryKey: progressSummaryKey });
      });
    },
  });
}
