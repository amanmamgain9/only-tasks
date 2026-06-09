// MyWorkdayTasksComponent.tsx - single category-root tree workspace
"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useProjects } from "../../_hooks/useScheduleManagement";
import WorkspaceAgentPanel from "../AgentComponents/WorkspaceAgentPanel";
import { useWorkspaceUiBlockRenderer } from "../AgentComponents/workspaceUiBlocks";
import type { WorkspaceUiBlock } from "@/features/ai/types";
import type { Project } from "../../types";
import type { AuthenticatedUser } from "@/server/auth";

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

type WorkspaceSurface = "chat" | "all-tasks" | "tasks" | "day-review" | "progress";

function getRouteBlocks(surface: WorkspaceSurface, dueDateFilter?: "today" | "tomorrow" | "this-week"): WorkspaceUiBlock[] {
  if (surface === "day-review") return [{ type: "day_review", id: "route-day-review", mode: "full" }];
  if (surface === "progress") return [{ type: "progress", id: "route-progress", range: "daily" }];
  if (surface === "chat") return [];
  if (surface === "all-tasks") return [{ type: "task_tree", id: "route-all", view: "all" }];

  if (dueDateFilter === "today") return [{ type: "task_tree", id: "route-today", view: "today" }];
  if (dueDateFilter === "tomorrow") return [{ type: "task_tree", id: "route-tomorrow", view: "tomorrow" }];
  if (dueDateFilter === "this-week") return [{ type: "task_tree", id: "route-this-week", view: "this_week" }];
  return [];
}

interface MyDayTasksComponentProps {
  dueDateFilter?: "today" | "tomorrow" | "this-week";
  surface?: WorkspaceSurface;
  chatId?: number;
  viewer: AuthenticatedUser;
}

const MyDayTasksComponent: React.FC<MyDayTasksComponentProps> = ({ dueDateFilter, surface = "chat", chatId, viewer }) => {
  const [agentRevision, setAgentRevision] = useState(0);
  const { data: projectsData, isLoading: projectsLoading } = useProjects({
    status: "active",
    chatId,
  });

  const allProjects = useMemo(() => projectsData?.data || [], [projectsData?.data]);
  const workspaceProject = useMemo(() => getWorkspaceProject(allProjects), [allProjects]);
  const routeBlocks = useMemo(() => getRouteBlocks(surface, dueDateFilter), [dueDateFilter, surface]);
  const handleWorkspaceChanged = useCallback(() => {
    setAgentRevision((value) => value + 1);
  }, []);
  const renderUiBlock = useWorkspaceUiBlockRenderer({
    project: workspaceProject ?? {
      id: 0,
      userId: 0,
      title: "Workspace",
      status: "active",
      targetDate: null,
      type: "main",
      deletedAt: null,
      createdAt: "",
      updatedAt: "",
    },
    chatId,
    agentRevision,
    onWorkspaceChanged: handleWorkspaceChanged,
  });

  return (
    <div className="w-full" data-layout="vertical">
      {workspaceProject ? (
        <WorkspaceAgentPanel
          projectId={workspaceProject.id}
          currentView={dueDateFilter}
          onWorkspaceChanged={handleWorkspaceChanged}
          renderUiBlock={renderUiBlock}
          routeBlocks={routeBlocks}
          viewer={viewer}
        />
      ) : projectsLoading ? (
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <LoadingState />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Workspace is being prepared.
          </p>
        </div>
      )}
    </div>
  );
};

export default MyDayTasksComponent;
