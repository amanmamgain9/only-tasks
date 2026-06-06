"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, CircleDot, Settings2, Target, X } from "lucide-react";
import type {
  DailyTargetDefinition,
  DailyTargetInput,
  DailyTargetKind,
  DailyTargetSchedule,
} from "@/features/dailyTargets/types";
import type { TimeReviewTarget } from "@/features/timeReview/types";
import { useDailyTargets, useSaveDailyTargets } from "../../_hooks/useDailyTargets";
import { useTodayTimeReview } from "../../_hooks/useTimeReview";
import { NavigationService } from "../../_services/navigationService";

const QUICK_TIME_MINUTES = [30, 60, 120, 180];

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatMinutes(minutes: number | null | undefined) {
  const value = Math.max(0, Math.round(minutes ?? 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatTargetValue(target: Pick<TimeReviewTarget, "kind" | "targetMinutes" | "targetCount">) {
  if (target.kind === "count") return `${target.targetCount ?? 0} ${target.targetCount === 1 ? "task" : "tasks"}`;
  return formatMinutes(target.targetMinutes);
}

function formatActualValue(target: Pick<TimeReviewTarget, "kind" | "reviewedMinutes" | "reviewedCount">) {
  if (target.kind === "count") return `${target.reviewedCount}`;
  return formatMinutes(target.reviewedMinutes);
}

function parseDurationInput(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Math.max(1, Number(normalized));

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h/);
  const minuteMatch = normalized.match(/(\d+)\s*m/);
  const minutes = Math.round(
    (hourMatch ? Number(hourMatch[1]) * 60 : 0) +
    (minuteMatch ? Number(minuteMatch[1]) : 0),
  );
  return Number.isFinite(minutes) && minutes > 0 ? Math.min(24 * 60, minutes) : null;
}

function targetToInput(target: DailyTargetDefinition): DailyTargetInput {
  return {
    category: target.category,
    enabled: target.enabled,
    kind: target.kind,
    targetMinutes: target.kind === "time" ? target.targetMinutes ?? 60 : null,
    targetCount: target.kind === "count" ? target.targetCount ?? 1 : null,
    schedule: target.schedule,
  };
}

function normalizeDraftTargets(targets: Array<DailyTargetDefinition | TimeReviewTarget>): DailyTargetInput[] {
  return targets.map((target) => targetToInput(target));
}

function TargetAmountField({
  target,
  onChange,
}: {
  target: DailyTargetInput;
  onChange: (target: DailyTargetInput) => void;
}) {
  const [draft, setDraft] = useState(target.kind === "time" ? formatMinutes(target.targetMinutes ?? 60) : String(target.targetCount ?? 1));

  useEffect(() => {
    setDraft(target.kind === "time" ? formatMinutes(target.targetMinutes ?? 60) : String(target.targetCount ?? 1));
  }, [target.kind, target.targetMinutes, target.targetCount]);

  const commit = () => {
    if (target.kind === "time") {
      onChange({ ...target, targetMinutes: parseDurationInput(draft) ?? target.targetMinutes ?? 60 });
      return;
    }
    const count = Math.max(1, Math.min(99, Math.round(Number(draft) || target.targetCount || 1)));
    onChange({ ...target, targetCount: count });
  };

  return (
    <input
      data-focusable
      data-tab-consume
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
          return;
        }
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        if (target.kind === "time") {
          onChange({
            ...target,
            targetMinutes: Math.max(5, Math.min(24 * 60, (target.targetMinutes ?? 60) + delta * (event.shiftKey ? 60 : 15))),
          });
          return;
        }
        onChange({
          ...target,
          targetCount: Math.max(1, Math.min(99, (target.targetCount ?? 1) + delta)),
        });
      }}
      className="h-9 w-24 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-950 outline-none transition focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-white"
      aria-label="Daily target amount"
    />
  );
}

function DailyTargetsEditor({
  isOpen,
  targets,
  onClose,
}: {
  isOpen: boolean;
  targets: Array<DailyTargetDefinition | TimeReviewTarget>;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const saveMutation = useSaveDailyTargets();
  const [draftTargets, setDraftTargets] = useState<DailyTargetInput[]>(() => normalizeDraftTargets(targets));

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftTargets(normalizeDraftTargets(targets));
  }, [isOpen, targets]);

  useEffect(() => {
    if (!isOpen) return;
    const modalElement = modalRef.current;
    if (modalElement) {
      NavigationService.pushScope(modalElement, {
        getInitialFocus: (root) => root.querySelector("[data-target-editor-first]") as HTMLElement | null,
      });
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (modalElement) NavigationService.popScope();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const updateDraft = (category: DailyTargetInput["category"], updater: (target: DailyTargetInput) => DailyTargetInput) => {
    setDraftTargets((current) => current.map((target) => (
      target.category === category ? updater(target) : target
    )));
  };

  const saveTargets = () => {
    saveMutation.mutate({ targets: draftTargets }, {
      onSuccess: (response) => {
        if (response.success) onClose();
      },
    });
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        ref={modalRef}
        open
        data-scope
        aria-modal="true"
        aria-labelledby="daily-targets-title"
        className="static m-0 w-full max-w-2xl rounded-xl border-0 bg-white p-0 text-left shadow-2xl dark:bg-slate-900"
      >
        <div data-region id="daily-targets-editor-region" data-tab-consume>
          <div data-layout="vertical" className="max-h-[88vh] overflow-y-auto p-5">
            <div data-order="0" className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <Target className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="daily-targets-title" className="text-lg font-semibold text-slate-950 dark:text-white">Daily Targets</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Set the promise layer above tasks.</p>
                </div>
              </div>
              <button
                type="button"
                data-focusable
                data-tab-consume
                data-order="0"
                onClick={onClose}
                className="inline-flex size-9 items-center justify-center rounded-md text-slate-500 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Close daily targets"
              >
                <X className="size-5" />
              </button>
            </div>

            <div data-order="1" data-layout="vertical" className="space-y-2">
              {targets.map((target, index) => {
                const draft = draftTargets.find((item) => item.category === target.category) ?? targetToInput(target);
                return (
                  <div
                    key={target.category}
                    data-order={String(index)}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-950/60"
                  >
                    <div data-layout="horizontal" className="grid gap-3 md:grid-cols-[minmax(9rem,1fr)_auto_auto_auto] md:items-center">
                      <label className="flex min-w-0 items-center gap-3">
                        <input
                          data-focusable
                          data-tab-consume
                          data-target-editor-first={index === 0 ? "" : undefined}
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(event) => updateDraft(target.category, (current) => ({ ...current, enabled: event.target.checked }))}
                          className="size-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-300"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">{target.label}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {draft.enabled ? "Shown in review" : "No daily promise"}
                          </span>
                        </span>
                      </label>

                      <select
                        data-focusable
                        data-tab-consume
                        value={draft.kind}
                        onChange={(event) => updateDraft(target.category, (current) => ({
                          ...current,
                          kind: event.target.value as DailyTargetKind,
                          targetMinutes: event.target.value === "time" ? current.targetMinutes ?? 60 : null,
                          targetCount: event.target.value === "count" ? current.targetCount ?? 1 : null,
                        }))}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                        aria-label={`${target.label} target type`}
                      >
                        <option value="time">Time</option>
                        <option value="count">Tasks</option>
                      </select>

                      <TargetAmountField
                        target={draft}
                        onChange={(next) => updateDraft(target.category, () => next)}
                      />

                      <select
                        data-focusable
                        data-tab-consume
                        value={draft.schedule ?? "every_day"}
                        onChange={(event) => updateDraft(target.category, (current) => ({
                          ...current,
                          schedule: event.target.value as DailyTargetSchedule,
                        }))}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-cyan-300 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                        aria-label={`${target.label} schedule`}
                      >
                        <option value="every_day">Every day</option>
                        <option value="weekdays">Weekdays</option>
                      </select>
                    </div>

                    {draft.kind === "time" && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {QUICK_TIME_MINUTES.map((minutes) => (
                          <button
                            key={minutes}
                            type="button"
                            data-focusable
                            data-tab-consume
                            onClick={() => updateDraft(target.category, (current) => ({ ...current, targetMinutes: minutes }))}
                            className="h-8 rounded-md bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                          >
                            {formatMinutes(minutes)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div data-order="2" className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Targets measure the day. Tasks stay concrete.
              </p>
              <div data-layout="horizontal" className="flex gap-2">
                <button
                  type="button"
                  data-focusable
                  data-tab-consume
                  onClick={onClose}
                  className="h-9 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-focusable
                  data-tab-consume
                  onClick={saveTargets}
                  disabled={saveMutation.isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {saveMutation.isPending ? "Saving" : "Save"}
                </button>
              </div>
            </div>

            {saveMutation.error && (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                {saveMutation.error.message}
              </p>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}

function TargetChip({ target }: { target: TimeReviewTarget }) {
  const valueText = target.kind === "time"
    ? `${formatActualValue(target)} / ${formatTargetValue(target)}`
    : `${formatActualValue(target)} / ${formatTargetValue(target)}`;

  return (
    <div className="min-w-[10rem] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-slate-950/50">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{target.label}</span>
        {target.met ? <CheckCircle2 className="size-4 text-emerald-500" /> : <CircleDot className="size-4 text-cyan-500" />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-lg font-semibold text-slate-950 dark:text-white">{valueText}</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{target.progressPercent}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className={`h-full rounded-full ${target.met ? "bg-emerald-500" : "bg-cyan-500"}`}
          style={{ width: `${Math.min(100, Math.max(3, target.progressPercent))}%` }}
        />
      </div>
    </div>
  );
}

export default function DailyTargetsStrip() {
  const [timeZone] = useState(getBrowserTimeZone);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const reviewQuery = useTodayTimeReview(timeZone);
  const targetsQuery = useDailyTargets();
  const summaryTargets = reviewQuery.data?.success ? reviewQuery.data.data?.targets ?? [] : [];
  const settingsTargets = targetsQuery.data?.success ? targetsQuery.data.data ?? [] : [];
  const editorTargets = settingsTargets.length > 0 ? settingsTargets : summaryTargets;
  const visibleTargets = useMemo(
    () => summaryTargets.filter((target) => target.enabled && target.appliesToday),
    [summaryTargets],
  );

  if (reviewQuery.isLoading && targetsQuery.isLoading) {
    return (
      <div className="h-16 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" />
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          data-focusable
          data-order="0"
          data-entrypoint-focus
          onClick={() => setIsEditorOpen(true)}
          className="flex min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Target className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">Daily Targets</span>
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
              {visibleTargets.length > 0 ? "Promise vs proof for today" : "Set a daily promise above tasks"}
            </span>
          </span>
        </button>

        {visibleTargets.length > 0 ? (
          <div data-layout="horizontal" className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[70%]">
            {visibleTargets.map((target) => (
              <TargetChip key={target.category} target={target} />
            ))}
          </div>
        ) : (
          <button
            type="button"
            data-focusable
            data-order="1"
            onClick={() => setIsEditorOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <CalendarDays className="size-4" />
            Add target
          </button>
        )}

        {visibleTargets.length > 0 && (
          <button
            type="button"
            data-focusable
            data-order="2"
            onClick={() => setIsEditorOpen(true)}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            aria-label="Edit daily targets"
          >
            <Settings2 className="size-4" />
          </button>
        )}
      </div>

      <DailyTargetsEditor
        isOpen={isEditorOpen}
        targets={editorTargets}
        onClose={() => setIsEditorOpen(false)}
      />
    </section>
  );
}
