// MyWorkdayTasksComponent.tsx - single category-root tree workspace
"use client";

import React, { useMemo } from "react";
import { Calendar, CalendarDays, Sunrise } from "lucide-react";
import { Link } from "react-router-dom";
import { useProjects } from "../../_hooks/useScheduleManagement";
import TreeMainComponent from "./TaskTreeComponents/TaskTreeMainComponent";
import type { Project } from "../../types";

const getDueDateViewInfo = (dueDateFilter: "today" | "tomorrow" | "this-week") => {
  switch (dueDateFilter) {
    case "today":
      return { icon: Calendar, label: "Today", color: "text-blue-600" };
    case "tomorrow":
      return { icon: Sunrise, label: "Tomorrow", color: "text-orange-600" };
    case "this-week":
      return { icon: CalendarDays, label: "This Week", color: "text-purple-600" };
  }
};

function LoadingState() {
  return (
    <div className="space-y-3 p-6">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="flex items-center gap-3 px-3 py-2">
          <div className="size-4 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

function getWorkspaceProject(projects: Project[]) {
  return projects.find((project) => project.title.trim().toLowerCase() === "workspace") ?? projects[0] ?? null;
}

function DateViewHeader({
  dueDateFilter,
  compact = false,
  reviewHref,
}: {
  dueDateFilter: "today" | "tomorrow" | "this-week";
  compact?: boolean;
  reviewHref?: string;
}) {
  const viewInfo = getDueDateViewInfo(dueDateFilter);
  const ViewIcon = viewInfo.icon;

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${compact ? "border-b border-gray-200 pb-3 dark:border-white/10 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4" : "p-4"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`rounded-lg bg-gray-100 ${compact ? "p-1.5" : "p-2"} dark:bg-gray-700 ${viewInfo.color}`}>
          <ViewIcon className={compact ? "size-4" : "size-5"} />
        </div>
        <div className="min-w-0">
          <h2 className={`${compact ? "text-sm" : "text-lg"} font-semibold text-gray-900 dark:text-gray-100`}>
            {viewInfo.label}
          </h2>
          <p className={`${compact ? "text-xs" : "text-sm"} text-gray-500 dark:text-gray-400`}>
            Tasks due for {viewInfo.label.toLowerCase()}
          </p>
        </div>
      </div>
      {reviewHref && (
        <Link
          to={reviewHref}
          className="inline-flex h-9 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-medium text-white outline-none transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Review
        </Link>
      )}
    </div>
  );
}

interface MyDayTasksComponentProps {
  dueDateFilter?: "today" | "tomorrow" | "this-week";
  chatId?: number;
}

const MyDayTasksComponent: React.FC<MyDayTasksComponentProps> = ({ dueDateFilter, chatId }) => {
  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    status: "active",
    chatId,
  });

  const allProjects = useMemo(() => projectsData?.data || [], [projectsData?.data]);
  const workspaceProject = useMemo(() => getWorkspaceProject(allProjects), [allProjects]);

  return (
    <div className="w-full space-y-2">
      {dueDateFilter ? (
        <div className="mb-2 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <DateViewHeader
            dueDateFilter={dueDateFilter}
            reviewHref={dueDateFilter === "today" ? "/workspace/day-review" : undefined}
          />
        </div>
      ) : null}

      <div
        className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        data-layout="vertical"
      >
        {projectsLoading ? (
          <LoadingState />
        ) : workspaceProject ? (
          <TreeMainComponent
            project={workspaceProject}
            dueDateFilter={dueDateFilter}
            chatId={chatId}
            key={`${workspaceProject.id}-${dueDateFilter || "all"}-${chatId || "none"}`}
          />
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Workspace is being prepared.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyDayTasksComponent;
