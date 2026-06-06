"use client";

import React, { Suspense } from "react";
import { ArrowLeft, CalendarCheck2, CheckCircle2, Clock3, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthenticatedUser } from "@/server/auth";
import WorkspaceSidebar from "../WorkspaceSidebar";
import TargetReviewPanel from "./TargetReviewPanel";
import TimeReviewPanel from "../TimeReviewComponents/TimeReviewPanel";
import { useTodayTimeReview } from "../../_hooks/useTimeReview";

interface ReviewWorkspaceComponentProps {
  regionOrder: number;
  viewer: AuthenticatedUser;
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getReviewDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function ReviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="h-8 w-44 animate-pulse rounded-md bg-slate-200 dark:bg-white/10" />
      <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

function ReviewView() {
  const timeZone = getBrowserTimeZone();
  const navigate = useNavigate();
  const reviewQuery = useTodayTimeReview(timeZone);
  const summary = reviewQuery.data?.success ? reviewQuery.data.data ?? null : null;
  const activeTargets = summary?.targets.filter((target) => target.enabled && target.appliesToday) ?? [];
  const metTargets = activeTargets.filter((target) => target.met).length;
  const reviewedTasks = summary?.totals.reviewedTasks ?? 0;
  const remainingTaskReviews = Math.max(0, (summary?.totals.completedTasks ?? 0) - reviewedTasks);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <CalendarCheck2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-slate-950 dark:text-white">Day Review</h1>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {summary ? `${getReviewDateLabel(summary.workdayDate)} - ${summary.timeZone}` : "Close out completed work and shape the timeline."}
            </p>
          </div>
        </div>
        <Link
          to="/workspace/today"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
          Today
        </Link>
      </div>

      {activeTargets.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Promised</p>
              <Target className="size-4 text-cyan-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{activeTargets.length}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">daily targets for this workday</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Proof</p>
              <Clock3 className="size-4 text-cyan-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{formatDuration(summary?.totals.reviewedMinutes ?? 0)}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{summary?.totals.reviewedTargets ?? 0} targets reviewed</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Met</p>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{metTargets}/{activeTargets.length}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">targets at or above promise</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Completed</p>
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{summary?.totals.completedTasks ?? 0}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">tasks finished today</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Reviewed</p>
              <Clock3 className="size-4 text-cyan-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{formatDuration(summary?.totals.reviewedMinutes ?? 0)}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{reviewedTasks} tasks have time</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Remaining</p>
              <Target className="size-4 text-cyan-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{remainingTaskReviews}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">completed tasks need time</p>
          </div>
        </div>
      )}

      {summary && activeTargets.length > 0 ? (
        <TargetReviewPanel summary={summary} onSaved={() => navigate("/workspace/day-recap")} />
      ) : null}

      <TimeReviewPanel
        pageMode
        initialExpanded={activeTargets.length === 0}
        onSaved={() => navigate("/workspace/day-recap")}
      />
    </div>
  );
}

const ReviewWorkspaceComponent: React.FC<ReviewWorkspaceComponentProps> = ({ regionOrder, viewer }) => {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.12),rgba(255,255,255,0)),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(0,0,0,0)),linear-gradient(135deg,#020617_0%,#0f172a_48%,#1e293b_100%)]">
      <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <WorkspaceSidebar regionOrder={regionOrder} viewer={viewer} />
        <div className="relative min-w-0 pb-24 lg:pb-0">
          <div data-region id="workspace-region" data-order={regionOrder + 1} className="px-4 py-5 sm:px-6 md:px-8">
            <div data-layout="vertical">
              <div data-order="0">
                <Suspense fallback={<ReviewSkeleton />}>
                  <ReviewView />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewWorkspaceComponent;
