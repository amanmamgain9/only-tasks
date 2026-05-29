"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deriveNextTimerSession,
  getTimerElapsedMs,
  type TimerPhase,
} from "@/features/timer/timer-core";
import {
  completeTimer,
  getTimerStatus,
  pauseTimer,
  resetTimer,
  resumeTimer,
  saveTimerSettings,
  skipTimer,
  startTimer,
} from "../_services/backendService";
import type { ApiResponse, TimerSession, TimerSettings, TimerStatus } from "../types";

export const timerStatusKey = ["timer", "status"];

type TimerMutationContext = {
  previous: ApiResponse<TimerStatus> | null | undefined;
};

function mutationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStatusData(value: ApiResponse<TimerStatus> | null | undefined) {
  return value?.success ? value.data ?? null : null;
}

function createOptimisticResponse(data: TimerStatus): ApiResponse<TimerStatus> {
  return { success: true, data };
}

function updateActiveSession(
  old: ApiResponse<TimerStatus> | null | undefined,
  updater: (status: TimerStatus, active: TimerSession) => TimerStatus,
) {
  const status = getStatusData(old);
  const active = status?.activeSession;
  if (!status || !active) return old;
  return createOptimisticResponse(updater(status, active));
}

export function useTimerStatus() {
  return useQuery<ApiResponse<TimerStatus> | null>({
    queryKey: timerStatusKey,
    queryFn: getTimerStatus,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const status = getStatusData(query.state.data);
      return status?.activeSession?.state === "running" ? 15000 : false;
    },
  });
}

export function useStartTimerMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerStatus>, Error, { phase?: TimerPhase; taskId?: number | null }, TimerMutationContext>({
    mutationFn: (input) => startTimer({ ...input, clientMutationId: mutationId() }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: timerStatusKey });
      const previous = queryClient.getQueryData<ApiResponse<TimerStatus> | null>(timerStatusKey);
      const previousStatus = getStatusData(previous);
      const now = new Date().toISOString();
      const settings = previousStatus?.settings;
      const nextSession = previousStatus?.nextSession ?? {
        phase: "work" as TimerPhase,
        workSessionNumber: 1,
        durationSeconds: 25 * 60,
      };
      const phase = input.phase ?? nextSession.phase;
      const durationSeconds = phase === nextSession.phase ? nextSession.durationSeconds : 25 * 60;

      const optimisticActive: TimerSession = {
        id: -Date.now(),
        userId: 0,
        taskId: input.taskId ?? null,
        taskTitle: null,
        projectId: null,
        phase,
        state: "running",
        workSessionNumber: nextSession.workSessionNumber,
        durationSeconds,
        accumulatedMs: 0,
        startedAt: now,
        lastResumedAt: now,
        pausedAt: null,
        endedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<ApiResponse<TimerStatus>>(timerStatusKey, createOptimisticResponse({
        activeSession: optimisticActive,
        nextSession,
        settings: settings ?? {
          focusDurationMinutes: 25,
          shortBreakDurationMinutes: 5,
          longBreakDurationMinutes: 15,
          sessionsBeforeLongBreak: 4,
          soundEnabled: true,
          selectedSound: "chime",
        },
        serverNow: now,
      }));

      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(timerStatusKey, context?.previous ?? null);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(timerStatusKey, response);
    },
  });
}

export function usePauseTimerMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerStatus>, Error, number, TimerMutationContext>({
    mutationFn: pauseTimer,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: timerStatusKey });
      const previous = queryClient.getQueryData<ApiResponse<TimerStatus> | null>(timerStatusKey);
      const now = new Date().toISOString();

      queryClient.setQueryData(timerStatusKey, updateActiveSession(previous, (status, active) => ({
        ...status,
        activeSession: {
          ...active,
          state: "paused",
          accumulatedMs: getTimerElapsedMs(active, now),
          pausedAt: now,
          updatedAt: now,
        },
        serverNow: now,
      })));

      return { previous };
    },
    onError: (_error, _timerId, context) => {
      queryClient.setQueryData(timerStatusKey, context?.previous ?? null);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(timerStatusKey, response);
    },
  });
}

export function useResumeTimerMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerStatus>, Error, number, TimerMutationContext>({
    mutationFn: resumeTimer,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: timerStatusKey });
      const previous = queryClient.getQueryData<ApiResponse<TimerStatus> | null>(timerStatusKey);
      const now = new Date().toISOString();

      queryClient.setQueryData(timerStatusKey, updateActiveSession(previous, (status, active) => ({
        ...status,
        activeSession: {
          ...active,
          state: "running",
          lastResumedAt: now,
          pausedAt: null,
          updatedAt: now,
        },
        serverNow: now,
      })));

      return { previous };
    },
    onError: (_error, _timerId, context) => {
      queryClient.setQueryData(timerStatusKey, context?.previous ?? null);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(timerStatusKey, response);
    },
  });
}

export function useSkipTimerMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerStatus>, Error, number, TimerMutationContext>({
    mutationFn: skipTimer,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: timerStatusKey });
      const previous = queryClient.getQueryData<ApiResponse<TimerStatus> | null>(timerStatusKey);
      const status = getStatusData(previous);
      const now = new Date().toISOString();

      if (status?.activeSession) {
        const nextSession = deriveNextTimerSession(status.activeSession, status.settings);
        queryClient.setQueryData(timerStatusKey, createOptimisticResponse({
          ...status,
          activeSession: null,
          nextSession,
          serverNow: now,
        }));
      }

      return { previous };
    },
    onError: (_error, _timerId, context) => {
      queryClient.setQueryData(timerStatusKey, context?.previous ?? null);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(timerStatusKey, response);
    },
  });
}

export function useCompleteTimerMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerStatus>, Error, number>({
    mutationFn: completeTimer,
    onSuccess: (response) => {
      queryClient.setQueryData(timerStatusKey, response);
    },
  });
}

export function useResetTimerMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerStatus>, Error, number, TimerMutationContext>({
    mutationFn: resetTimer,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: timerStatusKey });
      const previous = queryClient.getQueryData<ApiResponse<TimerStatus> | null>(timerStatusKey);
      const now = new Date().toISOString();

      queryClient.setQueryData(timerStatusKey, updateActiveSession(previous, (status, active) => ({
        ...status,
        activeSession: {
          ...active,
          state: "running",
          accumulatedMs: 0,
          startedAt: now,
          lastResumedAt: now,
          pausedAt: null,
          endedAt: null,
          updatedAt: now,
        },
        serverNow: now,
      })));

      return { previous };
    },
    onError: (_error, _timerId, context) => {
      queryClient.setQueryData(timerStatusKey, context?.previous ?? null);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(timerStatusKey, response);
    },
  });
}

export function useSaveTimerSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TimerSettings>, Error, TimerSettings>({
    mutationFn: saveTimerSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerStatusKey });
    },
  });
}
