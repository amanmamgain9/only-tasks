"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListChecks, Minus, Plus, Save, Target } from "lucide-react";
import type {
  TimeReviewSummary,
  TimeReviewTarget,
  TimeReviewTargetEntryInput,
} from "@/features/timeReview/types";
import { useSaveTodayTimeReview } from "../../_hooks/useTimeReview";

type DraftTargetEntry = {
  category: TimeReviewTarget["category"];
  actualMinutes: number | null;
  actualCount: number | null;
};

const QUICK_MINUTES = [30, 60, 120, 180];

function formatMinutes(minutes: number | null | undefined) {
  const value = Math.max(0, Math.round(minutes ?? 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function parseDurationInput(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 0;
  if (/^\d+$/.test(normalized)) return Math.max(0, Number(normalized));

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/);
  const minuteMatch = normalized.match(/(\d+)\s*m/);
  const minutes = Math.round(
    (hourMatch ? Number(hourMatch[1]) * 60 : 0) +
    (minuteMatch ? Number(minuteMatch[1]) : 0),
  );
  return Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
}

function getTargetAmount(target: TimeReviewTarget) {
  if (target.kind === "count") return `${target.targetCount ?? 0} ${target.targetCount === 1 ? "task" : "tasks"}`;
  return formatMinutes(target.targetMinutes);
}

function buildDraftEntries(summary: TimeReviewSummary): DraftTargetEntry[] {
  return summary.targets
    .filter((target) => target.enabled && target.appliesToday)
    .map((target) => ({
      category: target.category,
      actualMinutes: target.kind === "time" ? target.reviewedMinutes : null,
      actualCount: target.kind === "count" ? target.reviewedCount : null,
    }));
}

function DurationField({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState(formatMinutes(value));

  useEffect(() => {
    setDraft(formatMinutes(value));
  }, [value]);

  return (
    <input
      data-focusable
      data-tab-consume
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onChange(parseDurationInput(draft))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(value + (event.shiftKey ? 60 : 15));
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(Math.max(0, value - (event.shiftKey ? 60 : 15)));
        }
      }}
      className="h-10 w-28 rounded-md border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 outline-none transition focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-white"
      aria-label="Reviewed target time"
    />
  );
}

function CountField({
  value,
  onChange,
}: {
  value: number;
  onChange: (count: number) => void;
}) {
  return (
    <input
      data-focusable
      data-tab-consume
      type="number"
      min={0}
      max={99}
      value={value}
      onChange={(event) => onChange(Math.max(0, Math.min(99, Number(event.target.value) || 0)))}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(Math.min(99, value + 1));
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(Math.max(0, value - 1));
        }
      }}
      className="h-10 w-24 rounded-md border border-slate-200 bg-white px-3 text-base font-semibold text-slate-950 outline-none transition focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-white"
      aria-label="Reviewed target count"
    />
  );
}

function TargetReviewRow({
  target,
  entry,
  onChange,
}: {
  target: TimeReviewTarget;
  entry: DraftTargetEntry;
  onChange: (entry: DraftTargetEntry) => void;
}) {
  const actualValue = target.kind === "time" ? entry.actualMinutes ?? 0 : entry.actualCount ?? 0;
  const targetValue = target.kind === "time" ? target.targetMinutes ?? 0 : target.targetCount ?? 0;
  const progressPercent = targetValue > 0 ? Math.round((actualValue / targetValue) * 100) : 0;
  const met = progressPercent >= 100;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {met ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Target className="size-4 text-cyan-500" />}
            <h3 className="truncate text-base font-semibold text-slate-950 dark:text-white">{target.label}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Target {getTargetAmount(target)} · {target.completedTasks} completed {target.completedTasks === 1 ? "task" : "tasks"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-focusable
            data-tab-consume
            onClick={() => {
              if (target.kind === "time") onChange({ ...entry, actualMinutes: Math.max(0, (entry.actualMinutes ?? 0) - 15) });
              else onChange({ ...entry, actualCount: Math.max(0, (entry.actualCount ?? 0) - 1) });
            }}
            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            aria-label={`Reduce ${target.label} review`}
          >
            <Minus className="size-4" />
          </button>

          {target.kind === "time" ? (
            <DurationField
              value={entry.actualMinutes ?? 0}
              onChange={(minutes) => onChange({ ...entry, actualMinutes: Math.max(0, Math.min(24 * 60, minutes)) })}
            />
          ) : (
            <CountField
              value={entry.actualCount ?? 0}
              onChange={(count) => onChange({ ...entry, actualCount: count })}
            />
          )}

          <button
            type="button"
            data-focusable
            data-tab-consume
            onClick={() => {
              if (target.kind === "time") onChange({ ...entry, actualMinutes: Math.min(24 * 60, (entry.actualMinutes ?? 0) + 15) });
              else onChange({ ...entry, actualCount: Math.min(99, (entry.actualCount ?? 0) + 1) });
            }}
            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            aria-label={`Increase ${target.label} review`}
          >
            <Plus className="size-4" />
          </button>

          {target.kind === "time" && (
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  data-focusable
                  data-tab-consume
                  onClick={() => onChange({ ...entry, actualMinutes: minutes })}
                  className="h-9 rounded-md bg-slate-100 px-2.5 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                >
                  {formatMinutes(minutes)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${met ? "bg-emerald-500" : "bg-cyan-500"}`}
            style={{ width: `${Math.max(3, Math.min(100, progressPercent))}%` }}
          />
        </div>
        <span className="w-12 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{progressPercent}%</span>
      </div>
    </div>
  );
}

function SupportingTasks({ summary }: { summary: TimeReviewSummary }) {
  if (summary.tasks.length === 0) return null;

  return (
    <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 dark:text-slate-100">
        <ListChecks className="size-4 text-cyan-500" />
        Completed tasks supporting today
      </summary>
      <div className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
        {summary.tasks.map((task) => (
          <div key={task.taskId} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950 dark:text-white">{task.title || "Untitled task"}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{task.projectTitle || "Workspace"}</p>
            </div>
            {task.durationMinutes > 0 && (
              <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatMinutes(task.durationMinutes)}
              </span>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

export default function TargetReviewPanel({
  summary,
  onSaved,
}: {
  summary: TimeReviewSummary;
  onSaved?: (summary: TimeReviewSummary) => void;
}) {
  const saveMutation = useSaveTodayTimeReview();
  const targets = useMemo(
    () => summary.targets.filter((target) => target.enabled && target.appliesToday),
    [summary.targets],
  );
  const [entries, setEntries] = useState<DraftTargetEntry[]>(() => buildDraftEntries(summary));

  useEffect(() => {
    setEntries(buildDraftEntries(summary));
  }, [summary]);

  const entryByCategory = new Map(entries.map((entry) => [entry.category, entry]));
  const reviewedTargets = targets.filter((target) => target.reviewStatus === "confirmed").length;
  const totalMinutes = entries.reduce((sum, entry) => sum + (entry.actualMinutes ?? 0), 0);

  const updateEntry = (next: DraftTargetEntry) => {
    setEntries((current) => current.map((entry) => (
      entry.category === next.category ? next : entry
    )));
  };

  const saveReview = () => {
    const targetEntries: TimeReviewTargetEntryInput[] = entries.map((entry) => ({
      category: entry.category,
      actualMinutes: entry.actualMinutes,
      actualCount: entry.actualCount,
      status: "confirmed",
    }));

    saveMutation.mutate({
      timeZone: summary.timeZone,
      settings: summary.settings,
      entries: [],
      targetEntries,
    }, {
      onSuccess: (response) => {
        if (response.success && response.data) onSaved?.(response.data);
      },
    });
  };

  if (targets.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
        <Target className="mx-auto size-8 text-cyan-500" />
        <h2 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">No daily targets yet</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add a daily target from Today, then close the day by reviewing that promise here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyan-600 dark:text-cyan-300">Close the promise</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
              {reviewedTargets}/{targets.length} reviewed · {formatMinutes(totalMinutes)}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Set proof at the category level. Task times can stay as detail.
            </p>
          </div>

          <button
            type="button"
            data-focusable
            data-tab-consume
            onClick={saveReview}
            disabled={saveMutation.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-medium text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Save className="size-4" />
            {saveMutation.isPending ? "Saving" : "Save Review"}
          </button>
        </div>
      </div>

      <div data-layout="vertical" className="space-y-3">
        {targets.map((target, index) => {
          const entry = entryByCategory.get(target.category) ?? {
            category: target.category,
            actualMinutes: target.kind === "time" ? 0 : null,
            actualCount: target.kind === "count" ? 0 : null,
          };
          return (
            <div key={target.category} data-order={String(index)}>
              <TargetReviewRow target={target} entry={entry} onChange={updateEntry} />
            </div>
          );
        })}
      </div>

      <SupportingTasks summary={summary} />

      {saveMutation.error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          {saveMutation.error.message}
        </p>
      )}
    </section>
  );
}
