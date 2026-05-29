"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Laptop,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipForward,
  TimerReset,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  formatTimerSeconds,
  getDisplaySecondsRemaining,
  getTimerPhaseLabel,
  getTimerProgressPercent,
  type TimerPhase,
} from "@/features/timer/timer-core";
import {
  useCompleteTimerMutation,
  usePauseTimerMutation,
  useResetTimerMutation,
  useResumeTimerMutation,
  useSaveTimerSettingsMutation,
  useSkipTimerMutation,
  useStartTimerMutation,
  useTimerStatus,
} from "../../_hooks/useTimerManagement";
import { NavigationService } from "../../_services/navigationService";
import type { TimerSettings, TimerSession, TimerStatus } from "../../types";

type TimerViewModel = {
  activeSession: TimerSession | null;
  nextSession: TimerStatus["nextSession"];
  settings: TimerSettings;
  displaySeconds: number;
  formattedTime: string;
  phase: TimerPhase;
  progressPercent: number;
  isRunning: boolean;
  isPaused: boolean;
  isIdle: boolean;
  isBusy: boolean;
  label: string;
  contextLabel: string;
  toggle: () => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  reset: () => void;
};

const defaultSettings: TimerSettings = {
  focusDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  selectedSound: "chime",
};

const phaseStyles: Record<TimerPhase, {
  stroke: string;
}> = {
  work: {
    stroke: "#4f46e5",
  },
  short_break: {
    stroke: "#059669",
  },
  long_break: {
    stroke: "#d97706",
  },
};

function getPhaseEmoji(phase: TimerPhase) {
  switch (phase) {
    case "work":
      return "🎯";
    case "short_break":
      return "☕";
    case "long_break":
      return "🎉";
  }
}

function getSessionText(timer: Pick<TimerViewModel, "nextSession" | "phase" | "settings">) {
  const total = timer.settings.sessionsBeforeLongBreak;
  const displayNumber = ((timer.nextSession.workSessionNumber - 1) % total) + 1;

  if (timer.phase === "long_break") return "Long Break";
  return `Session ${displayNumber} of ${total}`;
}

function getFocusTitle(phase: TimerPhase) {
  switch (phase) {
    case "work":
      return "Focus Time";
    case "short_break":
      return "Short Break";
    case "long_break":
      return "Long Break";
  }
}

function getTimerColorState(timer: Pick<TimerViewModel, "isRunning" | "isPaused">) {
  if (timer.isPaused) {
    return {
      time: "text-red-600 dark:text-red-400",
      status: "text-red-500",
      glow: "bg-red-300 dark:bg-red-500",
      action: "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus-visible:ring-green-500",
    };
  }

  if (timer.isRunning) {
    return {
      time: "text-green-500 dark:text-green-400",
      status: "text-green-500",
      glow: "bg-green-300 dark:bg-green-500",
      action: "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 focus-visible:ring-red-500",
    };
  }

  return {
    time: "text-blue-500 dark:text-blue-400",
    status: "text-slate-500 dark:text-slate-400",
    glow: "bg-blue-300 dark:bg-blue-500",
    action: "bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus-visible:ring-green-500",
  };
}

function playCompletionChime(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
    gain.connect(context.destination);

    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.12);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + 0.52 + index * 0.12);
    });

    window.setTimeout(() => {
      context.close().catch(() => {});
    }, 1200);
  } catch {
    // Ignore browsers that block audio before a user gesture.
  }
}

function useTick(isRunning: boolean) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) {
      setTick(Date.now());
      return;
    }

    const interval = window.setInterval(() => {
      setTick(Date.now());
    }, 250);

    return () => window.clearInterval(interval);
  }, [isRunning]);

  return tick;
}

function useWorkspaceTimerViewModel(): TimerViewModel {
  const { data } = useTimerStatus();
  const startMutation = useStartTimerMutation();
  const pauseMutation = usePauseTimerMutation();
  const resumeMutation = useResumeTimerMutation();
  const skipMutation = useSkipTimerMutation();
  const resetMutation = useResetTimerMutation();
  const completeMutation = useCompleteTimerMutation();
  const completedTimerRef = useRef<number | null>(null);

  const status = data?.success ? data.data ?? null : null;
  const activeSession = status?.activeSession ?? null;
  const settings = status?.settings ?? defaultSettings;
  const nextSession = status?.nextSession ?? {
    phase: "work" as TimerPhase,
    workSessionNumber: 1,
    durationSeconds: settings.focusDurationMinutes * 60,
  };
  const isRunning = activeSession?.state === "running";
  const isPaused = activeSession?.state === "paused";
  const tick = useTick(isRunning);
  const phase = activeSession?.phase ?? nextSession.phase;
  const displaySeconds = activeSession
    ? getDisplaySecondsRemaining(activeSession, tick)
    : nextSession.durationSeconds;
  const progressPercent = activeSession
    ? getTimerProgressPercent(activeSession, tick)
    : 0;
  const isBusy =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    skipMutation.isPending ||
    resetMutation.isPending ||
    completeMutation.isPending;

  useEffect(() => {
    if (!activeSession || activeSession.id < 0 || activeSession.state !== "running") return;
    if (displaySeconds > 0) {
      completedTimerRef.current = null;
      return;
    }
    if (completedTimerRef.current === activeSession.id) return;

    completedTimerRef.current = activeSession.id;
    playCompletionChime(settings.soundEnabled);
    completeMutation.mutate(activeSession.id);
  }, [activeSession, completeMutation, displaySeconds, settings.soundEnabled]);

  const start = useCallback(() => {
    startMutation.mutate({ phase: nextSession.phase });
  }, [nextSession.phase, startMutation]);

  const pause = useCallback(() => {
    if (activeSession && activeSession.id > 0) pauseMutation.mutate(activeSession.id);
  }, [activeSession, pauseMutation]);

  const resume = useCallback(() => {
    if (activeSession && activeSession.id > 0) resumeMutation.mutate(activeSession.id);
  }, [activeSession, resumeMutation]);

  const skip = useCallback(() => {
    if (activeSession && activeSession.id > 0) skipMutation.mutate(activeSession.id);
  }, [activeSession, skipMutation]);

  const reset = useCallback(() => {
    if (activeSession && activeSession.id > 0) resetMutation.mutate(activeSession.id);
  }, [activeSession, resetMutation]);

  const toggle = useCallback(() => {
    if (!activeSession) {
      start();
      return;
    }
    if (activeSession.state === "paused") {
      resume();
      return;
    }
    pause();
  }, [activeSession, pause, resume, start]);

  const label = getTimerPhaseLabel(phase);
  const contextLabel = activeSession?.taskTitle || "Workspace focus";

  return {
    activeSession,
    nextSession,
    settings,
    displaySeconds,
    formattedTime: formatTimerSeconds(displaySeconds),
    phase,
    progressPercent,
    isRunning,
    isPaused,
    isIdle: !activeSession,
    isBusy,
    label,
    contextLabel,
    toggle,
    start,
    pause,
    resume,
    skip,
    reset,
  };
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  order,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  order: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-focusable
      data-order={order.toString()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${className}`}
    >
      {children}
    </button>
  );
}

function TimerSettingsDialog({
  open,
  settings,
  onClose,
}: {
  open: boolean;
  settings: TimerSettings;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const saveMutation = useSaveTimerSettingsMutation();
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    NavigationService.pushScope(rootRef.current, {
      getInitialFocus: (root) => root.querySelector("[data-entrypoint-focus]") as HTMLElement | null,
    });
    return () => NavigationService.popScope();
  }, [open]);

  const updateNumber = (key: keyof Pick<TimerSettings, "focusDurationMinutes" | "shortBreakDurationMinutes" | "longBreakDurationMinutes" | "sessionsBeforeLongBreak">, value: string) => {
    const parsed = Number.parseInt(value, 10);
    setDraft((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : current[key],
    }));
  };

  const save = async () => {
    await saveMutation.mutateAsync(draft);
    onClose();
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={rootRef}
        data-scope
        role="dialog"
        aria-modal="true"
        aria-labelledby="timer-settings-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="mx-auto mt-20 max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
      >
        <div data-region id="timer-settings-region">
          <div data-layout="vertical" className="p-5">
            <div data-order="0" className="flex items-center justify-between">
              <h2 id="timer-settings-title" className="text-base font-semibold text-slate-950 dark:text-slate-50">Timer Settings</h2>
              <button type="button" data-focusable data-order="0" onClick={onClose} aria-label="Close settings" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:hover:bg-slate-800">
                <X className="size-4" />
              </button>
            </div>

            <div data-order="1" data-layout="vertical" className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Focus minutes
                <input data-focusable data-entrypoint-focus data-order="1" type="number" min={1} max={300} value={draft.focusDurationMinutes} onChange={(event) => updateNumber("focusDurationMinutes", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-400/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Break minutes
                <input data-focusable data-order="2" type="number" min={1} max={300} value={draft.shortBreakDurationMinutes} onChange={(event) => updateNumber("shortBreakDurationMinutes", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-400/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Long break minutes
                <input data-focusable data-order="3" type="number" min={1} max={300} value={draft.longBreakDurationMinutes} onChange={(event) => updateNumber("longBreakDurationMinutes", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-400/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Sessions before long break
                <input data-focusable data-order="4" type="number" min={1} max={12} value={draft.sessionsBeforeLongBreak} onChange={(event) => updateNumber("sessionsBeforeLongBreak", event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:ring-2 focus:ring-indigo-400/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50" />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Sound
                <button
                  type="button"
                  data-focusable
                  data-order="5"
                  onClick={() => setDraft((current) => ({ ...current, soundEnabled: !current.soundEnabled }))}
                  aria-pressed={draft.soundEnabled}
                  className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:bg-slate-800 dark:text-slate-300"
                >
                  {draft.soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </button>
              </label>
            </div>

            <div data-order="2" data-layout="horizontal" className="mt-5 flex justify-end gap-2">
              <button type="button" data-focusable data-order="1" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" data-focusable data-order="2" onClick={save} disabled={saveMutation.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-60">{saveMutation.isPending ? "Saving" : "Save"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FocusTimerDialog({
  open,
  timer,
  onClose,
}: {
  open: boolean;
  timer: TimerViewModel;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const colors = getTimerColorState(timer);
  const sessionText = getSessionText(timer);
  const title = getFocusTitle(timer.phase);

  useEffect(() => {
    if (!open || !rootRef.current) return;
    NavigationService.pushScope(rootRef.current, {
      getInitialFocus: (root) => root.querySelector("[data-entrypoint-focus]") as HTMLElement | null,
    });
    return () => NavigationService.popScope();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={rootRef}
        data-scope
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-timer-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
        className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div data-region id="timer-focus-region" data-order="1" className="p-8">
          <div data-layout="vertical">
            <div data-order="0" className="mb-6 flex items-center justify-between">
              <h2 id="focus-timer-title" className="text-2xl font-bold text-foreground">
                {title}
              </h2>
              <div data-layout="horizontal" className="flex items-center gap-2">
                <IconButton label="Minimize timer" order={4} onClick={onClose} className="size-10 border-0 bg-slate-100 shadow-none dark:bg-slate-700">
                  <Minimize2 className="size-4" />
                </IconButton>
                <IconButton label="Close focus mode" order={5} onClick={onClose} className="size-10 border-0 bg-slate-100 shadow-none dark:bg-slate-700">
                  <X className="size-4" />
                </IconButton>
              </div>
            </div>

            <div data-order="1" className="mb-5 text-center text-base font-semibold text-slate-700 dark:text-slate-300">
              {sessionText}
            </div>

            <div data-order="2" className="relative mx-auto mb-4">
              <div className="relative mx-auto size-64">
                <svg className="size-64 -rotate-90" viewBox="0 0 256 256" aria-hidden="true">
                  <circle
                    cx="128"
                    cy="128"
                    r="120"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200 dark:text-gray-600"
                  />
                  <circle
                    cx="128"
                    cy="128"
                    r="120"
                    stroke={phaseStyles[timer.phase].stroke}
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 120}
                    strokeDashoffset={(2 * Math.PI * 120) - (timer.progressPercent / 100) * (2 * Math.PI * 120)}
                    className="transition-[stroke-dashoffset] duration-500"
                  />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`mb-1 font-mono text-4xl font-bold tracking-normal transition-colors duration-300 ${colors.time}`}>
                      {timer.formattedTime}
                    </div>
                    <div className="flex min-h-5 items-center justify-center text-sm font-medium text-slate-500 dark:text-slate-300">
                      {timer.isRunning ? "In Progress" : timer.isPaused ? "Paused" : "Ready"}
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 left-1/2 rounded-lg bg-white p-2 shadow-md dark:bg-slate-700 dark:shadow-xl" style={{ transform: "translateX(-50%)" }}>
                  <Laptop className={`size-5 transition-colors duration-300 ${colors.status}`} />
                </div>
              </div>

              <div className={`absolute inset-0 -z-10 rounded-full opacity-10 blur-xl transition-colors duration-300 dark:opacity-20 ${colors.glow}`} />
            </div>

            <div data-order="3" data-layout="horizontal" className="flex items-center justify-between">
              <IconButton label="Reset timer" order={3} onClick={timer.reset} disabled={!timer.activeSession || timer.isBusy} className="size-10 border-0 bg-slate-100 shadow-none dark:bg-slate-700">
                <RotateCcw className="size-4" />
              </IconButton>

              <button
                type="button"
                data-focusable
                data-entrypoint-focus
                data-order="1"
                onClick={timer.toggle}
                disabled={timer.isBusy}
                title={timer.isRunning ? "Pause timer" : timer.isPaused ? "Resume timer" : "Start timer"}
                aria-label={timer.isRunning ? "Pause timer" : timer.isPaused ? "Resume timer" : "Start timer"}
                className={`flex size-14 items-center justify-center rounded-full text-white shadow-md transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${colors.action}`}
              >
                {timer.isRunning ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
              </button>

              <IconButton label="Skip timer" order={2} onClick={timer.skip} disabled={!timer.activeSession || timer.isBusy} className="size-10 border-0 bg-slate-100 shadow-none dark:bg-slate-700">
                <SkipForward className="size-4" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CompactTimerDisplay({
  timer,
  variant,
  onToggleDetailed,
  onExpand,
  onCloseDetailed,
}: {
  timer: TimerViewModel;
  variant: "inline" | "detailed";
  onToggleDetailed: () => void;
  onExpand: () => void;
  onCloseDetailed: () => void;
}) {
  const colors = getTimerColorState(timer);
  const sessionText = getSessionText(timer);
  const phaseEmoji = getPhaseEmoji(timer.phase);
  const timeColor = timer.isPaused ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-200";

  if (variant === "inline") {
    return (
      <div data-layout="horizontal" data-order="1">
        <div
          onClick={onToggleDetailed}
          className="flex h-16 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:border-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/50 dark:focus-visible:border-blue-600 sm:gap-3 sm:px-6"
        >
          <button
            type="button"
            data-focusable
            data-order="0"
            onClick={(event) => {
              event.stopPropagation();
              onToggleDetailed();
            }}
            className="flex min-w-0 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 sm:gap-3"
            aria-label={`Pomodoro timer: ${timer.formattedTime} - ${sessionText} - Press Enter to toggle detailed view`}
          >
            <span className="relative size-8 shrink-0">
              <span className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-600" />
              {timer.isRunning ? <span className="absolute inset-2 size-4 animate-pulse rounded-full bg-green-500" /> : null}
            </span>

            <span className={`flex shrink-0 items-center gap-2 font-mono text-lg font-bold ${timeColor}`}>
              <span>{timer.formattedTime}</span>
              <span className="text-sm" aria-hidden="true">{phaseEmoji}</span>
            </span>
          </button>

          <button
            type="button"
            data-focusable
            data-entrypoint-focus
            data-order="1"
            onClick={(event) => {
              event.stopPropagation();
              timer.toggle();
            }}
            disabled={timer.isBusy}
            className={`flex size-8 items-center justify-center rounded-full text-white shadow-md transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${colors.action}`}
            title={timer.isRunning ? "Pause timer" : timer.isPaused ? "Resume timer" : "Start timer"}
            aria-label={timer.isRunning ? "Pause timer" : timer.isPaused ? "Resume timer" : "Start timer"}
          >
            {timer.isRunning ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5" />}
          </button>

          <button
            type="button"
            data-focusable
            data-order="2"
            onClick={(event) => {
              event.stopPropagation();
              timer.skip();
            }}
            disabled={!timer.activeSession || timer.isBusy}
            className="flex size-8 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition-all duration-200 hover:scale-105 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-700/80 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
            title={timer.isIdle ? "Skip to next session" : "Skip current phase"}
            aria-label={timer.isIdle ? "Skip to next session" : "Skip current phase"}
          >
            <SkipForward className="size-3.5" />
          </button>

          <button
            type="button"
            data-focusable
            data-order="3"
            onClick={(event) => {
              event.stopPropagation();
              timer.reset();
            }}
            disabled={!timer.activeSession || timer.isBusy}
            className="flex size-8 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition-all duration-200 hover:scale-105 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-700/80 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
            title="Reset timer"
            aria-label="Reset timer"
          >
            <TimerReset className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout="vertical"
      data-order="1"
      className="rounded-2xl border border-slate-200/50 bg-white px-5 py-3 shadow-xl backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-800"
    >
      <div className="mb-1 flex items-center justify-center gap-1 text-center text-xs text-slate-500 dark:text-slate-400">
        <span aria-hidden="true">{phaseEmoji}</span>
        <span>{sessionText}</span>
      </div>

      <div className="mb-2 flex justify-center">
        <div className={`font-mono text-2xl font-bold tracking-normal ${timeColor}`}>
          {timer.formattedTime}
        </div>
      </div>

      <div data-layout="horizontal" className="flex items-center justify-center gap-2">
        <button
          type="button"
          data-focusable
          data-entrypoint-focus
          data-order="1"
          onClick={timer.toggle}
          disabled={timer.isBusy}
          className={`flex size-10 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${colors.action}`}
          title={timer.isRunning ? "Pause timer" : timer.isPaused ? "Resume timer" : "Start timer"}
          aria-label={timer.isRunning ? "Pause timer" : timer.isPaused ? "Resume timer" : "Start timer"}
        >
          {timer.isRunning ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </button>

        <IconButton label={timer.isIdle ? "Skip to next session" : "Skip current phase"} order={2} onClick={timer.skip} disabled={!timer.activeSession || timer.isBusy} className="size-8 border-0 bg-slate-100/80 shadow-none dark:bg-slate-700/80">
          <SkipForward className="size-3.5" />
        </IconButton>

        <IconButton label="Reset timer" order={3} onClick={timer.reset} disabled={!timer.activeSession || timer.isBusy} className="size-8 border-0 bg-slate-100/80 shadow-none dark:bg-slate-700/80">
          <TimerReset className="size-3.5" />
        </IconButton>

        <IconButton label="Open focus mode" order={4} onClick={onExpand} className="size-8 border-0 bg-slate-100/80 shadow-none dark:bg-slate-700/80">
          <Maximize2 className="size-3.5" />
        </IconButton>

        <IconButton label="Close detailed view" order={5} onClick={onCloseDetailed} className="size-8 border-0 bg-slate-100/80 shadow-none dark:bg-slate-700/80">
          <X className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export default function WorkspaceTimer({ regionOrder }: { regionOrder: number }) {
  const timer = useWorkspaceTimerViewModel();
  const [focusOpen, setFocusOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [variant, setVariant] = useState<"inline" | "detailed">("inline");

  return (
    <>
      <section
        data-region
        id="timer-region"
        data-order={regionOrder}
        className="sticky top-0 z-20 border-b border-border/20 bg-background/90 shadow-sm backdrop-blur-xl"
      >
        <div className={`mx-auto max-w-7xl px-3 sm:px-6 md:px-8 ${variant === "detailed" ? "py-4" : "py-3"}`}>
          <div data-layout="horizontal" className="flex items-center justify-center gap-2 sm:gap-3">
            <CompactTimerDisplay
              timer={timer}
              variant={variant}
              onToggleDetailed={() => setVariant((current) => current === "inline" ? "detailed" : "inline")}
              onExpand={() => setFocusOpen(true)}
              onCloseDetailed={() => setVariant("inline")}
            />

            {variant === "inline" ? (
              <IconButton label="Open focus mode" order={4} onClick={() => setFocusOpen(true)} className="size-10 shrink-0">
                <Maximize2 className="size-4" />
              </IconButton>
            ) : null}

            <IconButton label="Timer settings" order={variant === "inline" ? 5 : 6} onClick={() => setSettingsOpen(true)} className="size-10 shrink-0">
              <Settings className="size-4" />
            </IconButton>
          </div>
        </div>
      </section>

      <FocusTimerDialog open={focusOpen} timer={timer} onClose={() => setFocusOpen(false)} />
      <TimerSettingsDialog open={settingsOpen} settings={timer.settings} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
