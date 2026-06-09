"use client";

import React, { useMemo } from "react";
import { createAgentUiBlockRenderer, type AgentUiBlockRegistry } from "@/features/agentRuntime/types";
import type { WorkspaceUiBlock } from "@/features/ai/types";
import type { Project } from "../../types";
import ProgressView from "../ProgressComponents/ProgressView";
import DailyTargetsStrip from "../TargetComponents/DailyTargetsStrip";
import { ReviewView } from "../ReviewComponents/ReviewWorkspaceComponent";
import WorkspaceTimer from "../TimerComponents/WorkspaceTimer";
import TreeMainComponent from "../MyWorkplaceComponents/TaskTreeComponents/TaskTreeMainComponent";

function dueDateFilterForView(view: Extract<WorkspaceUiBlock, { type: "task_tree" }>["view"]) {
  if (view === "today") return "today";
  if (view === "tomorrow") return "tomorrow";
  if (view === "this_week") return "this-week";
  return undefined;
}

function blockTitle(block: WorkspaceUiBlock) {
  if (block.title) return block.title;
  if (block.type === "task_tree") {
    if (block.view === "today") return "Today";
    if (block.view === "tomorrow") return "Tomorrow";
    if (block.view === "this_week") return "This Week";
    return "Workspace";
  }
  if (block.type === "timer") return "Timer";
  if (block.type === "day_review") return "Day Review";
  if (block.type === "daily_targets") return "Daily Targets";
  return "Progress";
}

export function useWorkspaceUiBlockRenderer(input: {
  project: Project;
  chatId?: number;
  agentRevision: number;
  onWorkspaceChanged: () => void;
}) {
  return useMemo(() => {
    const registry: AgentUiBlockRegistry<WorkspaceUiBlock> = {
      task_tree: (block) => (
        <section data-layout="vertical" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 dark:border-white/10">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{blockTitle(block)}</h3>
          </div>
          <TreeMainComponent
            project={input.project}
            dueDateFilter={dueDateFilterForView(block.view)}
            chatId={input.chatId}
            key={`${input.project.id}-${block.view}-${input.chatId || "none"}-${input.agentRevision}-${block.id || "block"}`}
          />
        </section>
      ),
      timer: (block) => (
        <WorkspaceTimer
          embedded
          mode={block.mode}
          regionId={`timer-region-${block.id || block.mode}`}
        />
      ),
      day_review: () => <ReviewView />,
      progress: () => (
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
          <ProgressView />
        </div>
      ),
      daily_targets: () => <DailyTargetsStrip />,
    };

    return createAgentUiBlockRenderer(registry);
  }, [input.agentRevision, input.chatId, input.onWorkspaceChanged, input.project]);
}
