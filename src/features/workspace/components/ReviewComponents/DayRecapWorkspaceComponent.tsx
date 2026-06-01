"use client";

import React, { Suspense, useMemo } from "react";
import { ArrowLeft, CalendarCheck2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { buildDayRecapSummary, type DayRecapRow, type DayRecapSummary } from "@/features/timeReview/dayRecap";
import type { AuthenticatedUser } from "@/server/auth";
import { useTodayTimeReview } from "../../_hooks/useTimeReview";
import WorkspaceSidebar from "../WorkspaceSidebar";

interface DayRecapWorkspaceComponentProps {
  regionOrder: number;
  viewer: AuthenticatedUser;
}

const ROW_COLORS: Record<DayRecapRow["id"], { fill: string; stroke: string }> = {
  job: { fill: "#0f172a", stroke: "#94a3b8" },
  side_project: { fill: "#0891b2", stroke: "#67e8f9" },
  learning: { fill: "#4f46e5", stroke: "#a5b4fc" },
  health: { fill: "#059669", stroke: "#6ee7b7" },
  social: { fill: "#be123c", stroke: "#fda4af" },
  hobby: { fill: "#7c3aed", stroke: "#c4b5fd" },
  chore: { fill: "#64748b", stroke: "#cbd5e1" },
};

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

function formatTaskCount(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatRecapPair(row: DayRecapRow, metric: DayRecapSummary["primaryMetric"]) {
  if (metric === "time") {
    return `${formatDuration(row.doneValue)} / ${formatDuration(row.promisedValue)}`;
  }

  return `${formatTaskCount(row.doneValue)} / ${formatTaskCount(row.promisedValue)} tasks`;
}

function formatRecapTotal(recap: DayRecapSummary) {
  if (recap.primaryMetric === "time") {
    return `${formatDuration(recap.totalDoneValue)} done of ${formatDuration(recap.totalPromisedValue)} promised`;
  }

  return `${formatTaskCount(recap.totalDoneValue)} tasks done of ${formatTaskCount(recap.totalPromisedValue)} promised`;
}

function getDateParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { weekday: "DAY", date: dateKey };
  }

  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toUpperCase(),
    date: date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function terrainPath(x: number, baseline: number, width: number, height: number, seed: number) {
  if (width <= 0) return "";

  const w = Math.max(10, width);
  const peakA = x + w * 0.28;
  const peakB = x + w * 0.58;
  const peakC = x + w * 0.82;
  const low = baseline - height * (0.38 + (seed % 2) * 0.08);
  const high = baseline - height;
  const mid = baseline - height * (0.64 + (seed % 3) * 0.04);

  return [
    `M ${x} ${baseline}`,
    `C ${x + w * 0.08} ${low}, ${x + w * 0.16} ${high}, ${peakA} ${mid}`,
    `C ${x + w * 0.38} ${baseline - height * 0.24}, ${x + w * 0.44} ${high}, ${peakB} ${baseline - height * 0.5}`,
    `C ${x + w * 0.68} ${baseline - height * 0.2}, ${x + w * 0.72} ${mid}, ${peakC} ${baseline - height * 0.42}`,
    `C ${x + w * 0.9} ${baseline - height * 0.22}, ${x + w * 0.96} ${low}, ${x + w} ${baseline}`,
    "Z",
  ].join(" ");
}

function promisedPath(x: number, y: number, width: number, seed: number) {
  if (width <= 0) return "";

  const w = Math.max(10, width);
  const lift = 10 + (seed % 3) * 3;
  return [
    `M ${x} ${y}`,
    `C ${x + w * 0.22} ${y - lift}, ${x + w * 0.36} ${y + lift * 0.4}, ${x + w * 0.5} ${y - lift * 0.45}`,
    `S ${x + w * 0.78} ${y - lift}, ${x + w} ${y}`,
  ].join(" ");
}

function RecapTerrain({ recap }: { recap: DayRecapSummary }) {
  const minScaleValue = recap.primaryMetric === "time" ? 45 : 1;
  const maxValue = Math.max(minScaleValue, ...recap.rows.flatMap((row) => [row.doneValue, row.promisedValue]));
  const widthScale = 470 / maxValue;

  return (
    <svg viewBox="0 0 920 470" role="img" aria-label="Promise versus proof terrain" className="h-full w-full">
      <defs>
        <filter id="recap-soft-shadow" x="-20%" y="-30%" width="140%" height="170%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.13" />
        </filter>
      </defs>

      {recap.rows.map((row, index) => {
        const y = 39 + index * 61;
        const promisedWidth = row.promisedValue * widthScale;
        const doneWidth = row.doneValue * widthScale;
        const ratio = row.promisedValue > 0
          ? row.doneValue / row.promisedValue
          : row.doneValue > 0
            ? 1.18
            : 0;
        const height = row.doneValue > 0 ? clamp(10 + ratio * 11, 12, 27) : 0;
        const colors = ROW_COLORS[row.id];
        const x = 390;
        const promised = promisedPath(x, y + 6, promisedWidth, index);
        const done = terrainPath(x, y + 30, doneWidth, height, index);

        return (
          <g key={row.id}>
            <line x1="30" y1={y + 48} x2="890" y2={y + 48} stroke="#0f172a" strokeOpacity="0.09" />
            <circle cx="48" cy={y + 10} r="9" fill={colors.fill} opacity="0.96" />
            <text x="72" y={y + 16} fill="#0f172a" fontSize="20" fontWeight="800" letterSpacing="0">
              {row.label}
            </text>
            <text x="348" y={y + 16} textAnchor="end" fill={colors.fill} fontSize="19" fontWeight="900" letterSpacing="0">
              {formatRecapPair(row, recap.primaryMetric)}
            </text>
            {promised && (
              <path
                d={promised}
                fill="none"
                stroke={colors.stroke}
                strokeDasharray="5 6"
                strokeLinecap="round"
                strokeWidth="2.5"
                opacity="0.68"
              />
            )}
            {done && (
              <path
                d={done}
                fill={colors.fill}
                opacity="0.88"
                filter="url(#recap-soft-shadow)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function DayAlbumCard({ recap, dateKey, timeZone }: { recap: DayRecapSummary; dateKey: string; timeZone: string }) {
  const dateParts = getDateParts(dateKey);
  const completionPercent = recap.totalPromisedValue > 0
    ? Math.round((recap.totalDoneValue / recap.totalPromisedValue) * 100)
    : recap.totalDoneValue > 0
      ? 100
      : 0;

  return (
    <article
      className="mx-auto flex aspect-square w-full max-w-[720px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_32px_90px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-slate-950 sm:p-8"
      style={{
        backgroundImage:
          "radial-gradient(circle at 18% 14%, rgba(6,182,212,0.08), transparent 30%), radial-gradient(circle at 84% 10%, rgba(79,70,229,0.08), transparent 26%), linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.98))",
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <p className="text-sm font-black uppercase leading-none tracking-[0.22em] text-slate-950">{dateParts.weekday}</p>
          <p className="mt-2 text-base font-medium text-slate-500">{dateParts.date}</p>
        </div>
        <div className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-4xl font-black leading-none tracking-normal text-slate-950 shadow-sm">
          {completionPercent}%
        </div>
      </div>

      <div className="mt-5">
        <h1 className="text-5xl font-black leading-[0.88] tracking-normal text-slate-950">
          PROMISE
          <span className="block text-cyan-600">VS PROOF</span>
        </h1>
        <p className="mt-3 text-lg font-black uppercase tracking-[0.24em] text-slate-500">{recap.title}</p>
      </div>

      <div className="mt-4 min-h-0 flex-1">
        <RecapTerrain recap={recap} />
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-slate-200 pt-4 sm:gap-4">
        <div className="min-w-0">
          <p className="text-3xl font-black leading-none tracking-normal text-slate-950">
            {formatRecapTotal(recap)}
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-600 sm:text-sm">
            {recap.tasksClosed} tasks closed · {recap.tasksPromised} promised · {timeZone}
          </p>
        </div>
        <p className="shrink-0 text-right text-xs font-black uppercase tracking-normal text-slate-500">
          Plan My
          <span className="block">Workday</span>
        </p>
      </div>
    </article>
  );
}

function RecapSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="h-16 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="mx-auto aspect-square w-full max-w-[720px] animate-pulse rounded-[28px] bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

function DayRecapView() {
  const timeZone = getBrowserTimeZone();
  const reviewQuery = useTodayTimeReview(timeZone);
  const summary = reviewQuery.data?.success ? reviewQuery.data.data ?? null : null;
  const recap = useMemo(() => (summary ? buildDayRecapSummary(summary) : null), [summary]);

  if (reviewQuery.isLoading) return <RecapSkeleton />;

  if (!summary || !recap) {
    return (
      <div className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
        Day recap is not available yet.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <CalendarCheck2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-normal text-slate-950 dark:text-white">Day Recap</h1>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{summary.workdayDate} - {summary.timeZone}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/workspace/day-review"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <RotateCcw className="size-4" />
            Review
          </Link>
          <Link
            to="/workspace/today"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <ArrowLeft className="size-4" />
            Today
          </Link>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60 sm:p-6">
        <DayAlbumCard recap={recap} dateKey={summary.workdayDate} timeZone={summary.timeZone} />
      </div>
    </div>
  );
}

const DayRecapWorkspaceComponent: React.FC<DayRecapWorkspaceComponentProps> = ({ regionOrder, viewer }) => {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.12),rgba(255,255,255,0)),linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.18),rgba(0,0,0,0)),linear-gradient(135deg,#020617_0%,#0f172a_48%,#1e293b_100%)]">
      <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <WorkspaceSidebar regionOrder={regionOrder} viewer={viewer} />
        <div className="relative min-w-0 pb-24 lg:pb-0">
          <div data-region id="workspace-region" data-order={regionOrder + 1} className="px-4 py-5 sm:px-6 md:px-8">
            <div data-layout="vertical">
              <div data-order="0">
                <Suspense fallback={<RecapSkeleton />}>
                  <DayRecapView />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayRecapWorkspaceComponent;
