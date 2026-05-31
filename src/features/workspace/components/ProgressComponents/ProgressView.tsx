"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  ListChecks,
  Trophy,
} from "lucide-react";
import { useProgressSummary } from "../../_hooks/useProgressSummary";
import type {
  ProgressCategoryBreakdown,
  ProgressDay,
  ProgressPlannedTask,
  ProgressProjectBreakdown,
  ProgressRecentCompletion,
  ProgressSummary,
} from "@/features/progress/types";

type ViewMode = "daily" | "weekly";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function getDailyVerdict(summary: ProgressSummary) {
  const openTasks = summary.today.plannedTasks - summary.today.completedPlannedTasks;
  if (summary.today.plannedTasks === 0) return "No plan logged yet";
  if (openTasks === 0 && summary.today.plannedTasks > 0) return "Today's plan is clear";
  if (summary.today.completedPlannedTasks > 0) return "Real progress is happening";
  if (summary.today.completedTasks > 0) return "Work moved forward";
  return "Start with one scheduled task";
}

function getDailyNudge(summary: ProgressSummary) {
  const openTasks = summary.today.plannedTasks - summary.today.completedPlannedTasks;
  if (openTasks > 0) return `${openTasks} scheduled ${openTasks === 1 ? "task is" : "tasks are"} still open.`;
  if (summary.today.plannedTasks > 0) return "Nothing scheduled for today is left open.";
  return "Plan one concrete task before judging the day.";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</span>
        <Icon className="size-4 text-cyan-500" />
      </div>
      <p className="text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ProgressRing({ value, size = "large" }: { value: number; size?: "small" | "large" }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.max(0, Math.min(value, 100)) / 100) * circumference;
  const sizeClass = size === "small" ? "size-20" : "size-28";
  const textClass = size === "small" ? "text-lg" : "text-2xl";

  return (
    <div className={`relative shrink-0 ${sizeClass}`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="9" className="text-slate-200 dark:text-white/10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="text-cyan-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${textClass} font-semibold text-slate-950 dark:text-white`}>{value}%</span>
      </div>
    </div>
  );
}

function ViewSwitch({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      {(["daily", "weekly"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`h-9 rounded-md px-4 text-sm font-medium capitalize outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
            mode === item
              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function TaskList({ tasks }: { tasks: ProgressPlannedTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No scheduled tasks for today.</p>;
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-white/10">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-start gap-3 py-3">
          {task.isCompleted ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0 text-slate-300 dark:text-slate-600" />
          )}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${task.isCompleted ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
              {task.title || "Untitled task"}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{task.projectTitle || "No project"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentWins({ items, todayOnly = false }: { items: ProgressRecentCompletion[]; todayOnly?: boolean }) {
  const visibleItems = todayOnly ? items.filter((item) => item.localDate === items[0]?.localDate) : items;

  if (visibleItems.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No completed tasks in this window.</p>;
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-white/10">
      {visibleItems.map((task) => (
        <div key={task.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{task.title}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{task.projectTitle || "No project"}</p>
          </div>
          <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatDate(task.localDate)}</span>
        </div>
      ))}
    </div>
  );
}

function WeekStrip({ days }: { days: ProgressDay[] }) {
  const maxValue = Math.max(...days.map((day) => Math.max(day.plannedTasks, day.completedTasks)), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Week Pattern</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Scheduled versus completed tasks</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-200 dark:bg-white/20" />Scheduled</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-cyan-500" />Done</span>
        </div>
      </div>

      <div className="grid h-44 grid-cols-7 items-end gap-2">
        {days.map((day) => {
          const plannedHeight = day.plannedTasks > 0
            ? Math.max(8, Math.round((day.plannedTasks / maxValue) * 132))
            : 4;
          const completedHeight = day.completedTasks > 0
            ? Math.max(6, Math.round((day.completedTasks / maxValue) * 132))
            : 0;

          return (
            <div key={day.date} className="flex h-full min-w-0 flex-col justify-end gap-2">
              <div className="flex min-h-0 flex-1 items-end justify-center">
                <div className={`relative w-full max-w-9 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10 ${day.isToday ? "ring-2 ring-cyan-300/70" : ""}`} style={{ height: plannedHeight }}>
                  {completedHeight > 0 && <div className="absolute bottom-0 left-0 right-0 bg-cyan-500" style={{ height: completedHeight }} />}
                </div>
              </div>
              <div className="text-center">
                <p className={`truncate text-xs font-medium ${day.isToday ? "text-cyan-600 dark:text-cyan-300" : "text-slate-500 dark:text-slate-400"}`}>{day.weekday}</p>
                <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{formatDate(day.date)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectBreakdown({ projects }: { projects: ProgressProjectBreakdown[] }) {
  const maxValue = Math.max(...projects.map((project) => project.completedTasks), 1);

  if (projects.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No project progress yet this week.</p>;
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        return (
          <div key={project.projectId ?? "none"}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-800 dark:text-slate-100">{project.title}</span>
              <span className="shrink-0 text-slate-500 dark:text-slate-400">{project.completedTasks} done</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(6, Math.round((project.completedTasks / maxValue) * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatWeightedTasks(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatMinutes(value: number) {
  const minutes = Math.max(0, Math.round(value));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function CategoryBreakdown({
  items,
  emptyText,
}: {
  items: ProgressCategoryBreakdown[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.category}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
            <span className="shrink-0 font-semibold text-slate-950 dark:text-white">{item.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(6, item.percent)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatWeightedTasks(item.weightedTasks)} weighted {item.weightedTasks === 1 ? "task" : "tasks"}
          </p>
        </div>
      ))}
    </div>
  );
}

function CategoryTimeBreakdown({
  items,
  emptyText,
}: {
  items: ProgressSummary["todayCategoryTimeBreakdown"];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.category}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
            <span className="shrink-0 font-semibold text-slate-950 dark:text-white">{formatMinutes(item.minutes)} · {item.percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(6, item.percent)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-cyan-500" />
        <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DailyView({ summary }: { summary: ProgressSummary }) {
  const openTasks = summary.today.plannedTasks - summary.today.completedPlannedTasks;
  const todaysWins = summary.recentCompletions.filter((item) => item.localDate === summary.todayDate);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyan-600 dark:text-cyan-300">{getDailyVerdict(summary)}</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">
              {summary.today.completedTasks} done · {openTasks} open
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {getDailyNudge(summary)} {summary.today.reviewedMinutes > 0 ? `${formatMinutes(summary.today.reviewedMinutes)} reviewed.` : ""}
            </p>
          </div>

          <div className="flex items-center gap-5">
            <ProgressRing value={summary.today.planCompletionPercent} />
            <div className="space-y-2 text-sm">
              <p className="text-slate-500 dark:text-slate-400">Scheduled</p>
              <p className="text-xl font-semibold text-slate-950 dark:text-white">
                {summary.today.completedPlannedTasks}/{summary.today.plannedTasks}
              </p>
              <p className="text-slate-500 dark:text-slate-400">{openTasks} open</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel title="Today's Plan" icon={ListChecks}>
          <TaskList tasks={summary.todayPlan} />
        </Panel>
        <Panel title="Category Mix" icon={BarChart3}>
          {summary.todayCategoryTimeBreakdown.length > 0 ? (
            <CategoryTimeBreakdown
              items={summary.todayCategoryTimeBreakdown}
              emptyText="Review time today to see the time split."
            />
          ) : (
            <CategoryBreakdown
              items={summary.todayCategoryBreakdown}
              emptyText="Complete a task today to see the category split."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-5">
        <Panel title="Today's Wins" icon={CheckCircle2}>
          <RecentWins items={todaysWins} />
        </Panel>
      </div>
    </div>
  );
}

function WeeklyView({ summary }: { summary: ProgressSummary }) {
  const bestDay = summary.week.bestDay;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={CheckCircle2} label="Done" value={`${summary.week.completedTasks}`} detail="tasks completed" />
        <MetricCard icon={ListChecks} label="Open" value={`${Math.max(0, summary.week.plannedTasks - summary.week.completedPlannedTasks)}`} detail="scheduled remaining" />
        <MetricCard icon={Trophy} label="Consistency" value={`${summary.week.productiveDays}/7`} detail="days with completed tasks" />
        <MetricCard icon={CalendarCheck2} label="Reviewed" value={formatMinutes(summary.week.reviewedMinutes)} detail="time shaped this week" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.8fr)]">
        <WeekStrip days={summary.days} />

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">Weekly Read</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Week of {formatDate(summary.weekStartDate)}
              </p>
            </div>
            <ProgressRing value={summary.week.planCompletionPercent} size="small" />
          </div>

          <div className="divide-y divide-slate-200 dark:divide-white/10">
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><Trophy className="size-4 text-cyan-500" />Best day</span>
              <span className="text-sm font-medium text-slate-950 dark:text-white">{bestDay ? bestDay.label : "No signal yet"}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CheckCircle2 className="size-4 text-cyan-500" />Tasks completed</span>
              <span className="text-sm font-medium text-slate-950 dark:text-white">{summary.week.completedTasks}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><ListChecks className="size-4 text-cyan-500" />Schedule kept</span>
              <span className="text-sm font-medium text-slate-950 dark:text-white">{summary.week.completedPlannedTasks}/{summary.week.plannedTasks}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Category Mix" icon={BarChart3}>
          {summary.weekCategoryTimeBreakdown.length > 0 ? (
            <CategoryTimeBreakdown
              items={summary.weekCategoryTimeBreakdown}
              emptyText="Review time this week to see the time split."
            />
          ) : (
            <CategoryBreakdown
              items={summary.weekCategoryBreakdown}
              emptyText="No completed tasks in this week's category split yet."
            />
          )}
        </Panel>
        <Panel title="Project Momentum" icon={BarChart3}>
          <ProjectBreakdown projects={summary.projectBreakdown} />
        </Panel>
      </div>

      <div className="grid gap-5">
        <Panel title="Recent Wins" icon={CheckCircle2}>
          <RecentWins items={summary.recentCompletions} />
        </Panel>
      </div>
    </div>
  );
}

function ProgressContent({ summary }: { summary: ProgressSummary }) {
  const [mode, setMode] = useState<ViewMode>("daily");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Progress</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatDate(summary.todayDate)} · {summary.timeZone}
          </p>
        </div>
        <ViewSwitch mode={mode} onChange={setMode} />
      </div>

      {mode === "daily" ? <DailyView summary={summary} /> : <WeeklyView summary={summary} />}
    </div>
  );
}

function ProgressLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="h-9 w-64 animate-pulse rounded-md bg-slate-200 dark:bg-white/10" />
      <div className="h-44 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-white/10" />
        ))}
      </div>
    </div>
  );
}

export default function ProgressView() {
  const [timeZone] = useState(getBrowserTimeZone);
  const progressQuery = useProgressSummary(timeZone);
  const summary = progressQuery.data?.success ? progressQuery.data.data ?? null : null;
  const errorMessage = useMemo(() => {
    if (progressQuery.error) return progressQuery.error.message;
    if (progressQuery.data && !progressQuery.data.success) return progressQuery.data.error || "Could not load progress.";
    return null;
  }, [progressQuery.data, progressQuery.error]);

  if (progressQuery.isLoading) return <ProgressLoading />;

  if (errorMessage) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        {errorMessage}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300">
        Progress is not available yet.
      </div>
    );
  }

  return <ProgressContent summary={summary} />;
}
