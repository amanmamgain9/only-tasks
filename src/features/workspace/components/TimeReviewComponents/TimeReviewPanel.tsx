"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Minus,
  Plus,
  Save,
} from "lucide-react";
import {
  getLifestyleTraitLabel,
  getTaskCategoryLabel,
  type LifestyleTraitAllocation,
  type TaskCategoryAllocation,
} from "@/features/categories/taskCategories";
import type {
  TimeReviewEntryInput,
  TimeReviewSettings,
  TimeReviewSummary,
  TimeReviewTask,
} from "@/features/timeReview/types";
import { useSaveTodayTimeReview, useTodayTimeReview } from "../../_hooks/useTimeReview";

type DraftEntry = {
  taskId: number;
  durationMinutes: number;
  startMinute: number | null;
  endMinute: number | null;
};

type TimelineEntryLayout = DraftEntry & {
  laneIndex: number;
  laneCount: number;
  hasTimeOverlap: boolean;
};

const QUICK_MINUTES = [15, 30, 45, 60];
const TIMELINE_HEIGHT = 420;
const MIN_ENTRY_HEIGHT = 42;
const SNAP_MINUTES = 5;

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function parseTimeOfDay(value: string, fallback = 0) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function workdayMinuteFromLocal(localMinute: number, rolloverMinute: number) {
  return (localMinute - rolloverMinute + 1440) % 1440;
}

function localMinuteFromWorkday(workdayMinute: number, rolloverMinute: number) {
  return (rolloverMinute + workdayMinute) % 1440;
}

function formatClockFromLocalMinutes(totalMinutes: number) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${suffix}`;
}

function formatWorkdayMinute(workdayMinute: number, rolloverMinute: number) {
  return formatClockFromLocalMinutes(localMinuteFromWorkday(workdayMinute, rolloverMinute));
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function parseDurationInput(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const hourMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/);
  const minuteMatch = trimmed.match(/(\d+)\s*m/);
  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = Math.round(hours + minutes);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

function clampMinute(value: number, min = 0, max = 1440) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function snapAbsoluteMinute(value: number) {
  return Math.max(0, Math.min(1440, Math.round(value / SNAP_MINUTES) * SNAP_MINUTES));
}

function snapDeltaMinutes(value: number) {
  return Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;
}

function layoutTimelineEntries(entries: DraftEntry[], minimumVisibleMinutes: number): TimelineEntryLayout[] {
  const candidates = [...entries]
    .filter((entry) => entry.durationMinutes > 0 && entry.startMinute !== null && entry.endMinute !== null)
    .sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0) || (a.endMinute ?? 0) - (b.endMinute ?? 0));
  const groups: DraftEntry[][] = [];
  let currentGroup: DraftEntry[] = [];
  let currentGroupEnd = -1;

  for (const entry of candidates) {
    const start = entry.startMinute ?? 0;
    const end = entry.endMinute ?? start;
    const visualEnd = Math.max(end, start + minimumVisibleMinutes);

    if (currentGroup.length === 0 || start < currentGroupEnd) {
      currentGroup.push(entry);
      currentGroupEnd = Math.max(currentGroupEnd, visualEnd);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [entry];
    currentGroupEnd = visualEnd;
  }

  if (currentGroup.length > 0) groups.push(currentGroup);

  return groups.flatMap((group) => {
    const laneEnds: number[] = [];
    const assigned = group.map((entry) => {
      const start = entry.startMinute ?? 0;
      const end = entry.endMinute ?? start;
      const visualEnd = Math.max(end, start + minimumVisibleMinutes);
      let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= start);

      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(visualEnd);
      } else {
        laneEnds[laneIndex] = visualEnd;
      }

      return { entry, laneIndex };
    });
    const laneCount = Math.max(1, laneEnds.length);

    return assigned.map(({ entry, laneIndex }) => ({
      ...entry,
      laneIndex,
      laneCount,
      hasTimeOverlap: group.some((other) => {
        if (other.taskId === entry.taskId) return false;
        const start = entry.startMinute ?? 0;
        const end = entry.endMinute ?? start;
        const otherStart = other.startMinute ?? 0;
        const otherEnd = other.endMinute ?? otherStart;
        return start < otherEnd && otherStart < end;
      }),
    }));
  });
}

function getCategorySummary(allocations: TaskCategoryAllocation[], lifestyleTraits: LifestyleTraitAllocation[]) {
  if (allocations.some((allocation) => allocation.category === "lifestyle") && lifestyleTraits.length > 0) {
    return lifestyleTraits.map((allocation) => getLifestyleTraitLabel(allocation.trait)).join(" + ");
  }
  if (allocations.length === 0) return "Task";
  return allocations.map((allocation) => getTaskCategoryLabel(allocation.category)).join(" + ");
}

function getTaskContext(task: TimeReviewTask) {
  const categorySummary = getCategorySummary(task.categoryAllocations, task.lifestyleTraits);
  const projectTitle = task.projectTitle?.trim();
  if (!projectTitle || projectTitle.toLowerCase() === "workspace") return categorySummary;
  return `${projectTitle} · ${categorySummary}`;
}

function getPanelTitle(summary: TimeReviewSummary) {
  if (summary.phase === "reviewed") return "Day shaped";
  if (summary.phase === "end") return "Shape today";
  if (summary.phase === "midday") return "Review morning";
  return "Time review";
}

function getPanelSubtitle(summary: TimeReviewSummary) {
  if (summary.totals.completedTasks === 0) return "Completed tasks will appear here during the current workday.";
  if (summary.phase === "reviewed") return `${formatDuration(summary.totals.reviewedMinutes)} reviewed across ${summary.totals.reviewedTasks} tasks.`;
  return `${summary.totals.completedTasks} completed ${summary.totals.completedTasks === 1 ? "task" : "tasks"} can be shaped into time.`;
}

function buildEntries(summary: TimeReviewSummary): DraftEntry[] {
  return summary.tasks.map((task) => ({
    taskId: task.taskId,
    durationMinutes: task.durationMinutes,
    startMinute: task.startMinute,
    endMinute: task.endMinute,
  }));
}

function getTimelineBounds(entries: DraftEntry[], rolloverTime: string) {
  const rolloverMinute = parseTimeOfDay(rolloverTime);
  const morningStart = workdayMinuteFromLocal(6 * 60, rolloverMinute);
  const firstEntry = entries
    .filter((entry) => entry.durationMinutes > 0 && entry.startMinute !== null)
    .reduce<number | null>((min, entry) => (
      min === null ? entry.startMinute : Math.min(min, entry.startMinute ?? min)
    ), null);
  const startMinute = Math.max(0, Math.min(morningStart, firstEntry ?? morningStart));
  return {
    rolloverMinute,
    startMinute,
    endMinute: 1440,
  };
}

function TimeReviewLoading({ embedded = false }: { embedded?: boolean }) {
  return (
    <section className={`${embedded ? "border-t" : "rounded-lg border shadow-sm"} border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900`}>
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-3 h-16 animate-pulse rounded bg-slate-100 dark:bg-white/10" />
    </section>
  );
}

function DurationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState(formatDuration(value));

  useEffect(() => {
    setDraft(formatDuration(value));
  }, [value]);

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onChange(parseDurationInput(draft))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(value + (event.shiftKey ? 15 : 5));
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(Math.max(0, value - (event.shiftKey ? 15 : 5)));
        }
      }}
      className="h-9 w-24 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-950 outline-none transition focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-white"
      aria-label="Reviewed duration"
    />
  );
}

function TaskDurationRow({
  task,
  entry,
  onDurationChange,
}: {
  task: TimeReviewTask;
  entry: DraftEntry;
  onDurationChange: (minutes: number) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{task.title || "Untitled task"}</p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {getTaskContext(task)}
          </p>
        </div>
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onDurationChange(Math.max(0, entry.durationMinutes - 15))}
          className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label="Shorten by 15 minutes"
        >
          <Minus className="size-4" />
        </button>
        <DurationField value={entry.durationMinutes} onChange={onDurationChange} />
        <button
          type="button"
          onClick={() => onDurationChange(entry.durationMinutes + 15)}
          className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label="Extend by 15 minutes"
        >
          <Plus className="size-4" />
        </button>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              onClick={() => onDurationChange(minutes)}
              className="h-8 rounded-md bg-slate-100 px-2.5 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
            >
              {formatDuration(minutes)}
            </button>
          ))}
          {task.estimatedTimeMinutes && (
            <button
              type="button"
              onClick={() => onDurationChange(task.estimatedTimeMinutes ?? 0)}
              className="h-8 rounded-md bg-cyan-50 px-2.5 text-xs font-medium text-cyan-700 outline-none transition hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:bg-cyan-500/10 dark:text-cyan-200"
            >
              Estimate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type DragState = {
  taskId: number;
  mode: "move" | "resize-start" | "resize-end";
  pointerY: number;
  startMinute: number;
  endMinute: number;
  boundsStartMinute: number;
  boundsEndMinute: number;
  pxPerMinute: number;
};

function TimeReviewTimeline({
  tasks,
  entries,
  rolloverTime,
  onEntryChange,
}: {
  tasks: TimeReviewTask[];
  entries: DraftEntry[];
  rolloverTime: string;
  onEntryChange: (taskId: number, next: Partial<DraftEntry>) => void;
}) {
  const bounds = useMemo(() => getTimelineBounds(entries, rolloverTime), [entries, rolloverTime]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.taskId, task])), [tasks]);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const activeBounds = dragState
    ? {
        ...bounds,
        startMinute: dragState.boundsStartMinute,
        endMinute: dragState.boundsEndMinute,
      }
    : bounds;
  const range = Math.max(60, activeBounds.endMinute - activeBounds.startMinute);
  const pxPerMinute = TIMELINE_HEIGHT / range;
  const visibleEntries = useMemo(
    () => layoutTimelineEntries(entries, MIN_ENTRY_HEIGHT / pxPerMinute),
    [entries, pxPerMinute],
  );

  useEffect(() => {
    if (!dragState) return;

    let lastStartMinute = dragState.startMinute;
    let lastEndMinute = dragState.endMinute;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const deltaMinutes = snapDeltaMinutes((event.clientY - dragState.pointerY) / dragState.pxPerMinute);
      let startMinute = dragState.startMinute;
      let endMinute = dragState.endMinute;

      if (dragState.mode === "move") {
        const duration = endMinute - startMinute;
        startMinute = clampMinute(
          snapAbsoluteMinute(dragState.startMinute + deltaMinutes),
          dragState.boundsStartMinute,
          dragState.boundsEndMinute - duration,
        );
        endMinute = startMinute + duration;
      } else if (dragState.mode === "resize-start") {
        startMinute = clampMinute(
          snapAbsoluteMinute(dragState.startMinute + deltaMinutes),
          dragState.boundsStartMinute,
          endMinute - SNAP_MINUTES,
        );
      } else {
        endMinute = clampMinute(
          snapAbsoluteMinute(dragState.endMinute + deltaMinutes),
          startMinute + SNAP_MINUTES,
          dragState.boundsEndMinute,
        );
      }

      if (startMinute === lastStartMinute && endMinute === lastEndMinute) return;
      lastStartMinute = startMinute;
      lastEndMinute = endMinute;

      onEntryChange(dragState.taskId, {
        startMinute,
        endMinute,
        durationMinutes: endMinute - startMinute,
      });
    };

    const handlePointerUp = () => setDragState(null);
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = dragState.mode === "move" ? "grabbing" : "ns-resize";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerUp, { once: true });
    window.addEventListener("blur", handlePointerUp, { once: true });
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("blur", handlePointerUp);
    };
  }, [dragState, onEntryChange]);

  const tickMinutes = [];
  for (let minute = Math.ceil(activeBounds.startMinute / 60) * 60; minute <= activeBounds.endMinute; minute += 120) {
    tickMinutes.push(minute);
  }

  if (visibleEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        Add a duration to place completed tasks on the day shape.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/60">
      <div
        ref={timelineRef}
        className="relative select-none overflow-hidden rounded-md bg-white dark:bg-slate-900"
        style={{ height: TIMELINE_HEIGHT }}
      >
        {tickMinutes.map((minute) => (
          <div
            key={minute}
            className="absolute left-0 right-0 border-t border-slate-100 text-[11px] text-slate-400 dark:border-white/10"
            style={{ top: (minute - activeBounds.startMinute) * pxPerMinute }}
          >
            <span className="absolute left-2 -translate-y-1/2 bg-white pr-2 dark:bg-slate-900">
              {formatWorkdayMinute(minute, activeBounds.rolloverMinute)}
            </span>
          </div>
        ))}

        {visibleEntries.map((entry) => {
          const task = taskById.get(entry.taskId);
          if (!task || entry.startMinute === null || entry.endMinute === null) return null;
          const top = (entry.startMinute - activeBounds.startMinute) * pxPerMinute;
          const height = Math.max(MIN_ENTRY_HEIGHT, (entry.endMinute - entry.startMinute) * pxPerMinute);
          const isDraggingEntry = dragState?.taskId === entry.taskId;

          const startDrag = (mode: DragState["mode"]) => (event: React.PointerEvent) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Pointer capture can fail if the pointer is already released.
            }
            setDragState({
              taskId: entry.taskId,
              mode,
              pointerY: event.clientY,
              startMinute: entry.startMinute ?? 0,
              endMinute: entry.endMinute ?? 0,
              boundsStartMinute: activeBounds.startMinute,
              boundsEndMinute: activeBounds.endMinute,
              pxPerMinute,
            });
          };

          return (
            <div
              key={entry.taskId}
              className={`absolute left-16 right-2 touch-none ${isDraggingEntry ? "z-20" : "z-10"}`}
              style={{ top, height }}
            >
              <div
                className="grid h-full gap-1"
                style={{ gridTemplateColumns: `repeat(${entry.laneCount}, minmax(0, 1fr))` }}
              >
                <div
                  className={`relative min-w-0 touch-none overflow-hidden rounded-md border p-2 shadow-sm transition-shadow ${
                    isDraggingEntry
                      ? "ring-2 ring-cyan-300"
                      : ""
                  } ${
                    entry.hasTimeOverlap
                      ? "border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-500/15"
                      : "border-cyan-300 bg-cyan-50 dark:border-cyan-400/40 dark:bg-cyan-500/15"
                  }`}
                  style={{ gridColumn: `${entry.laneIndex + 1}` }}
                >
                  <button
                    type="button"
                    onPointerDown={startDrag("resize-start")}
                    className="absolute left-0 right-0 top-0 z-10 h-5 cursor-ns-resize touch-none rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label="Resize start"
                  >
                    <span className="absolute left-1/2 top-1 h-0.5 w-8 -translate-x-1/2 rounded-full bg-slate-400/50" />
                  </button>
                  <button
                    type="button"
                    onPointerDown={startDrag("move")}
                    className="flex h-full w-full cursor-grab touch-none select-none items-center gap-2 text-left outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label={`Move ${task.title}`}
                  >
                    <GripVertical className={`size-4 shrink-0 ${entry.hasTimeOverlap ? "text-amber-600 dark:text-amber-200" : "text-cyan-600 dark:text-cyan-200"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-950 dark:text-white">{task.title || "Untitled task"}</span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-300">
                        {formatWorkdayMinute(entry.startMinute, activeBounds.rolloverMinute)} - {formatWorkdayMinute(entry.endMinute, activeBounds.rolloverMinute)} · {formatDuration(entry.durationMinutes)}
                      </span>
                      {entry.hasTimeOverlap && (
                        <span className="mt-0.5 block truncate text-[10px] font-medium text-amber-700 dark:text-amber-200">
                          Overlap
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={startDrag("resize-end")}
                    className="absolute bottom-0 left-0 right-0 z-10 h-5 cursor-ns-resize touch-none rounded-b-md outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    aria-label="Resize end"
                  >
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-slate-400/50" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TimeReviewPanel({
  embedded = false,
  leadingContent = null,
  initialExpanded = false,
  pageMode = false,
}: {
  embedded?: boolean;
  leadingContent?: React.ReactNode;
  initialExpanded?: boolean;
  pageMode?: boolean;
}) {
  const [timeZone] = useState(getBrowserTimeZone);
  const reviewQuery = useTodayTimeReview(timeZone);
  const saveMutation = useSaveTodayTimeReview();
  const summary = reviewQuery.data?.success ? reviewQuery.data.data ?? null : null;
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [settings, setSettings] = useState<TimeReviewSettings | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!summary) return;
    setEntries(buildEntries(summary));
    setSettings(summary.settings);
    setIsExpanded(pageMode || initialExpanded || (!embedded && (summary.phase === "midday" || summary.phase === "end")));
  }, [embedded, initialExpanded, pageMode, summary]);

  const updateEntry = useCallback((taskId: number, updates: Partial<DraftEntry>) => {
    setEntries((current) => current.map((entry) => (
      entry.taskId === taskId ? { ...entry, ...updates } : entry
    )));
  }, []);

  if (reviewQuery.isLoading) return <TimeReviewLoading embedded={embedded} />;
  if (!summary || !settings) return null;

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const reviewedCount = entries.filter((entry) => entry.durationMinutes > 0).length;
  const entryByTaskId = new Map(entries.map((entry) => [entry.taskId, entry]));

  const setDuration = (task: TimeReviewTask, minutes: number) => {
    const durationMinutes = Math.max(0, Math.min(1440, Math.round(minutes)));
    const current = entryByTaskId.get(task.taskId);
    const rolloverMinute = parseTimeOfDay(settings.workdayRolloverTime);
    const defaultStart = workdayMinuteFromLocal(9 * 60, rolloverMinute);
    const placedEntries = entries.filter((entry) => entry.taskId !== task.taskId && entry.endMinute !== null);
    const nextStart = placedEntries.length > 0
      ? Math.min(1440 - durationMinutes, Math.max(defaultStart, Math.max(...placedEntries.map((entry) => entry.endMinute ?? defaultStart))))
      : defaultStart;
    const startMinute = durationMinutes > 0
      ? clampMinute(current?.startMinute ?? nextStart, 0, 1440 - durationMinutes)
      : null;

    updateEntry(task.taskId, {
      durationMinutes,
      startMinute,
      endMinute: startMinute !== null ? startMinute + durationMinutes : null,
    });
  };

  const saveReview = () => {
    saveMutation.mutate({
      timeZone,
      settings,
      entries: entries.map((entry): TimeReviewEntryInput => ({
        taskId: entry.taskId,
        durationMinutes: entry.durationMinutes,
        startMinute: entry.startMinute,
        endMinute: entry.endMinute,
      })),
    });
  };

  const phaseBorderClass = summary.phase === "end"
    ? "border-cyan-300 dark:border-cyan-400/30"
    : "border-slate-200 dark:border-white/10";
  const phaseSurfaceClass = summary.phase === "end"
    ? "bg-cyan-50 dark:bg-cyan-500/10"
    : "bg-white dark:bg-slate-900";
  const panelClass = embedded
    ? `p-3 ${phaseBorderClass} ${phaseSurfaceClass}`
    : pageMode
      ? `rounded-lg border p-4 shadow-sm ${phaseBorderClass} ${phaseSurfaceClass}`
      : `rounded-lg border p-4 shadow-sm ${phaseBorderClass} ${phaseSurfaceClass}`;
  const expanded = pageMode || isExpanded;

  return (
    <section className={panelClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          {leadingContent && <div className="shrink-0">{leadingContent}</div>}
          <button
            type="button"
            onClick={() => {
              if (!pageMode) setIsExpanded((value) => !value);
            }}
            className="flex min-w-0 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            aria-expanded={expanded}
          >
            {!embedded && (
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                <AlarmClock className="size-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-950 dark:text-white">{getPanelTitle(summary)}</span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{getPanelSubtitle(summary)}</span>
            </span>
            {!pageMode && (expanded ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />)}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={settings.workdayRolloverTime}
            onChange={(event) => setSettings({ ...settings, workdayRolloverTime: event.target.value })}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
            aria-label="Workday ends"
          >
            {["00:00", "01:00", "02:00", "03:00", "04:00"].map((time) => (
              <option key={time} value={time}>Ends {formatClockFromLocalMinutes(parseTimeOfDay(time))}</option>
            ))}
          </select>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {reviewedCount}/{summary.totals.completedTasks} · {formatDuration(totalMinutes)}
          </span>
          <button
            type="button"
            onClick={saveReview}
            disabled={saveMutation.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Save className="size-4" />
            {saveMutation.isPending ? "Saving" : "Save"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-3">
            {summary.tasks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                Complete tasks during the current workday and they will appear here.
              </p>
            ) : (
              summary.tasks.map((task) => {
                const entry = entryByTaskId.get(task.taskId) ?? {
                  taskId: task.taskId,
                  durationMinutes: 0,
                  startMinute: null,
                  endMinute: null,
                };
                return (
                  <TaskDurationRow
                    key={task.taskId}
                    task={task}
                    entry={entry}
                    onDurationChange={(minutes) => setDuration(task, minutes)}
                  />
                );
              })
            )}
          </div>

          <TimeReviewTimeline
            tasks={summary.tasks}
            entries={entries}
            rolloverTime={settings.workdayRolloverTime}
            onEntryChange={updateEntry}
          />
        </div>
      )}

      {saveMutation.error && (
        <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          {saveMutation.error.message}
        </p>
      )}
    </section>
  );
}
