"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CalendarCheck, CheckCircle2, ChevronDown, CornerDownRight, ListFilter, Maximize2, Minimize2, Pin, PinOff, Sparkles, Timer as TimerIcon, X, XCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { AssistantChatBox, type AssistantChatMessage } from "@/features/ai/AssistantChatBox";
import type { AssistantStoredMessage, WorkspaceAgentAction, WorkspaceAgentAtomicAction, WorkspaceAgentTaskSummary, WorkspaceAgentThread, WorkspaceUiAction, WorkspaceUiBlock } from "@/features/ai/types";
import { getWorkspaceAgentThread, sendWorkspaceAgentMessage } from "../../_services/backendService";
import { progressSummaryKey } from "../../_hooks/useProgressSummary";
import { timeReviewKey } from "../../_hooks/useTimeReview";
import { NavigationService } from "../../_services/navigationService";
import type { AuthenticatedUser } from "@/server/auth";
import WorkspaceAccountMenu from "./WorkspaceAccountMenu";
import {
  restorePinnedWorkspaceArtifacts,
  serializePinnedWorkspaceArtifacts,
  upsertWorkspaceArtifact,
  workspaceArtifactKey,
  workspaceBlockTitle,
  type WorkspaceArtifact,
  type WorkspaceArtifactSource,
} from "./workspaceArtifacts";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const workspaceAgentKey = (projectId: number) => ["workspace-agent", projectId] as const;
const SHOW_TIMER_SUGGESTION = "Show timer";
const SHOW_TODAY_SUGGESTION = "Show today's tasks";
const CHAT_COMPOSER_SELECTOR = "textarea[data-entrypoint-focus]";
const NATIVE_CONTENT_FOCUS_SELECTOR = [
  "[data-focusable]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "textarea:not(:disabled)",
  "select:not(:disabled)",
  "a[href]",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(", ");

function timerBlock(): WorkspaceUiBlock {
  return { type: "timer", id: "local-timer", mode: "compact", title: "Timer" };
}

function todayBlocks(): WorkspaceUiBlock[] {
  return [{ type: "task_tree", id: "local-today", view: "today" }];
}

function getWorkspaceAgentAction(payload: unknown): WorkspaceAgentAction | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { type?: unknown; action?: unknown };
  if (candidate.type !== "workspace_agent_action") return null;
  if (!candidate.action || typeof candidate.action !== "object") return null;
  return candidate.action as WorkspaceAgentAction;
}

function formatDueDate(date: string | null) {
  if (!date) return "No deadline";
  return date;
}

function groupTasksByCategory(tasks: WorkspaceAgentTaskSummary[]) {
  const groups = new Map<string, { label: string; tasks: WorkspaceAgentTaskSummary[] }>();
  for (const task of tasks) {
    const key = task.category ?? "none";
    const existing = groups.get(key) ?? { label: task.categoryLabel, tasks: [] };
    existing.tasks.push(task);
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
}

function getUiActions(action: { uiActions?: unknown }): WorkspaceUiAction[] {
  return Array.isArray(action.uiActions) ? (action.uiActions as WorkspaceUiAction[]) : [];
}

function getWorkflowSteps(action: Extract<WorkspaceAgentAction, { type: "agent_workflow" }>) {
  return Array.isArray(action.steps) ? action.steps : [];
}

function getActionUiActions(action: WorkspaceAgentAction | null | undefined): WorkspaceUiAction[] {
  if (!action) return [];
  const directActions = getUiActions(action);
  if (directActions.length > 0 || action.type !== "agent_workflow") return directActions;
  return getWorkflowSteps(action).flatMap((step) => getUiActions(step.action));
}

function getShownBlocks(action: WorkspaceAgentAction | null | undefined) {
  return getActionUiActions(action)
    .filter((uiAction): uiAction is Extract<WorkspaceUiAction, { type: "show_block" }> => uiAction.type === "show_block")
    .map((uiAction) => uiAction.block);
}

function blocksKey(blocks: WorkspaceUiBlock[] | undefined) {
  return (blocks ?? []).map((block) => `${workspaceArtifactKey([block])}:${block.id || ""}`).join("|");
}

function WorkspaceAgentActionCard({
  action,
  onUiActions,
}: {
  action: WorkspaceAgentAction;
  onUiActions: (actions: WorkspaceUiAction[]) => void;
}) {
  if (action.type === "agent_workflow") {
    const steps = getWorkflowSteps(action);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <Sparkles className="size-4 text-cyan-500" />
          <span>{action.summary}</span>
        </div>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="rounded-lg border border-slate-200 bg-white/70 p-2.5 dark:border-white/10 dark:bg-slate-950/40">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                <span>{index + 1}</span>
                <span>{step.commandKind.replaceAll("_", " ")}</span>
              </div>
              <WorkspaceAgentAtomicActionCard action={step.action} onUiActions={onUiActions} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <WorkspaceAgentAtomicActionCard action={action} onUiActions={onUiActions} />;
}

function WorkspaceAgentAtomicActionCard({
  action,
  onUiActions,
}: {
  action: WorkspaceAgentAtomicAction;
  onUiActions: (actions: WorkspaceUiAction[]) => void;
}) {
  const uiActions = getUiActions(action);
  const blockActions = uiActions
    .filter((uiAction): uiAction is Extract<WorkspaceUiAction, { type: "show_block" }> => uiAction.type === "show_block");
  const blockContent = blockActions.length > 0 ? (
    <div data-layout="horizontal" className="mt-3 flex flex-wrap gap-2">
      {blockActions.map((uiAction, index) => (
        <button
          key={`${workspaceArtifactKey([uiAction.block])}-${index}`}
          type="button"
          data-focusable
          data-tab-consume
          data-order={index.toString()}
          onClick={() => onUiActions([uiAction])}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400"
        >
          <ArrowUpRight className="size-3.5" />
          <span>Open {workspaceBlockTitle(uiAction.block)}</span>
        </button>
      ))}
    </div>
  ) : null;

  if (action.type === "tasks_created") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <CheckCircle2 className="size-4 text-emerald-500" />
          <span>{action.createdCount} {action.createdCount === 1 ? "task" : "tasks"} added</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDueDate(action.dueDate)}</p>
        <div className="space-y-2">
          {action.groups.map((group) => (
            <div key={group.category} className="rounded-lg border border-slate-200 bg-white/70 p-2 dark:border-white/10 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.label}</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-800 dark:text-slate-100">
                {group.titles.map((title) => <li key={title}>{title}</li>)}
              </ul>
            </div>
          ))}
        </div>
        {blockContent}
      </div>
    );
  }

  if (action.type === "task_query") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <ListFilter className="size-4 text-cyan-500" />
          <span>{action.resultCount} matching {action.resultCount === 1 ? "task" : "tasks"}</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{action.filters.join(" · ")}</p>
        {action.tasks.length > 0 ? (
          <div className="space-y-2">
            {groupTasksByCategory(action.tasks).map((group) => (
              <div key={group.key} className="rounded-lg border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-slate-950/40">
                <div className="flex items-center gap-2 border-b border-slate-200 px-2.5 py-2 dark:border-white/10">
                  <ChevronDown className="size-3.5 text-slate-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.label}</span>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-white/10 dark:text-slate-300">{group.tasks.length}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {group.tasks.map((task) => (
                    <div key={`${task.clientId || task.title}-${task.dueDate || "none"}`} className="px-2.5 py-2">
                      {(task.parentTitles ?? []).length > 0 ? (
                        <div className="mb-1 flex min-w-0 items-center gap-1 pl-5 text-[11px] text-slate-400 dark:text-slate-500">
                          <CornerDownRight className="size-3 shrink-0" />
                          <span className="truncate">{(task.parentTitles ?? []).join(" / ")}</span>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        data-focusable
                        data-tab-consume
                        disabled={!task.clientId}
                        onClick={() => {
                          if (!task.clientId) return;
                          onUiActions([
                            ...uiActions,
                            {
                              type: "focus_task",
                              clientId: task.clientId,
                              reason: "Focus this task in the editable tree.",
                            },
                          ]);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-white/10"
                      >
                        <span className={`size-2 rounded-full ${task.isCompleted ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                        <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{task.title}</span>
                        {task.dueDate ? <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{task.dueDate}</span> : null}
                        {task.rolloverCount > 0 ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">{task.rolloverCount}x</span> : null}
                        <ArrowUpRight className="size-3.5 shrink-0 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {action.resultCount > action.shownCount ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Showing {action.shownCount} of {action.resultCount}.</p>
        ) : null}
        {blockContent}
      </div>
    );
  }

  if (action.type === "capabilities") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <Sparkles className="size-4 text-cyan-500" />
          <span>Current agent commands</span>
        </div>
        <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {action.commands.map((command) => <li key={command}>{command}</li>)}
        </ul>
        {blockContent}
      </div>
    );
  }

  if (action.type === "agent_response") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <Sparkles className="size-4 text-cyan-500" />
          <span>{action.message}</span>
        </div>
        {blockContent}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
        <XCircle className="size-4 text-amber-500" />
        <span>I need a supported command</span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">{action.reason}</p>
      <div className="flex flex-wrap gap-2">
        {action.suggestions.map((suggestion) => (
          <span key={suggestion} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
            {suggestion}
          </span>
        ))}
      </div>
      {blockContent}
    </div>
  );
}

function messageToChatMessage(
  message: AssistantStoredMessage,
  onUiActions: (actions: WorkspaceUiAction[]) => void,
): AssistantChatMessage {
  const action = message.role === "assistant" ? getWorkspaceAgentAction(message.structuredPayload) : null;
  return {
    id: String(message.id),
    role: message.role === "user" ? "user" : "assistant",
    content: action ? (
      <WorkspaceAgentActionCard
        action={action}
        onUiActions={onUiActions}
      />
    ) : message.content,
    tone: action?.type === "unsupported" ? "warning" : action?.type === "tasks_created" ? "success" : "default",
  };
}

function escapeAttributeValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function executeWorkspaceUiActions(
  actions: WorkspaceUiAction[],
  navigate: ReturnType<typeof useNavigate>,
  currentPathname: string,
  onShowBlock?: (block: WorkspaceUiBlock, options?: { focus?: boolean; source?: WorkspaceArtifactSource }) => void,
  isBlockActive?: (block: WorkspaceUiBlock) => boolean,
  options?: { focusShownBlocks?: boolean },
) {
  let shouldWaitForMutation = false;

  for (const action of actions) {
    if (action.type === "navigate") {
      if (action.to !== currentPathname) {
        shouldWaitForMutation = true;
        navigate(action.to);
      }
      continue;
    }

    if (action.type === "show_block") {
      const isActive = isBlockActive?.(action.block) ?? false;
      if (!isActive) {
        shouldWaitForMutation = true;
      }
      onShowBlock?.(action.block, { focus: options?.focusShownBlocks, source: options?.focusShownBlocks ? "quick" : "agent" });
      continue;
    }

    NavigationService.focusBySelector({
      regionId: "workspace-region",
      selector: `[data-node-id="${escapeAttributeValue(action.clientId)}"] [data-entrypoint-focus]`,
    }, shouldWaitForMutation);
  }
}

function actionCreatesTasks(action: WorkspaceAgentAction | null | undefined) {
  if (!action) return false;
  if (action.type === "tasks_created") return true;
  if (action.type !== "agent_workflow") return false;
  return getWorkflowSteps(action).some((step) => step.action.type === "tasks_created");
}

function artifactStorageKey(projectId: number) {
  return `pmwd.workspace-artifacts.${projectId}`;
}

function ArtifactButton({
  artifact,
  order,
  onOpen,
}: {
  artifact: WorkspaceArtifact;
  order: number;
  onOpen: (artifact: WorkspaceArtifact) => void;
}) {
  return (
    <button
      type="button"
      data-focusable
      data-tab-consume
      data-order={order.toString()}
      onClick={() => onOpen(artifact)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-cyan-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-400"
    >
      {artifact.pinned ? <Pin className="size-3.5 text-cyan-500" /> : <ArrowUpRight className="size-3.5" />}
      <span className="truncate">{artifact.title}</span>
    </button>
  );
}

function QuickArtifactButton({
  label,
  icon,
  order,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  order: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-focusable
      data-tab-consume
      data-order={order.toString()}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-white/20"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ArtifactStage({
  artifact,
  expanded,
  renderUiBlock,
  onToggleExpanded,
  onTogglePin,
  onClose,
}: {
  artifact: WorkspaceArtifact;
  expanded: boolean;
  renderUiBlock: (block: WorkspaceUiBlock) => React.ReactNode;
  onToggleExpanded: () => void;
  onTogglePin: (artifact: WorkspaceArtifact) => void;
  onClose: () => void;
}) {
  return (
    <section
      data-artifact-key={artifact.key}
      data-artifact-expanded={expanded ? "true" : "false"}
      data-layout="vertical"
      className={expanded
        ? "fixed inset-0 z-50 flex flex-col overflow-hidden rounded-none border-0 bg-slate-50 shadow-2xl dark:bg-slate-950"
        : "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"}
    >
      <div data-layout="horizontal" className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-900">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{artifact.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{artifact.pinned ? "Pinned" : "Open"}</p>
        </div>
        <button
          type="button"
          data-focusable
          data-tab-consume
          data-order="1"
          onClick={onToggleExpanded}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-400 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={expanded ? "Return artifact to chat size" : "Expand artifact"}
          title={expanded ? "Return to chat size" : "Expand"}
        >
          {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          type="button"
          data-focusable
          data-tab-consume
          data-order="2"
          onClick={() => onTogglePin(artifact)}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-400 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label={artifact.pinned ? "Unpin artifact" : "Pin artifact"}
          title={artifact.pinned ? "Unpin" : "Pin"}
        >
          {artifact.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </button>
        <button
          type="button"
          data-focusable
          data-tab-consume
          data-order="3"
          onClick={onClose}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Close artifact"
          title="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div data-artifact-content data-layout="vertical" className={expanded ? "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" : "space-y-3 p-3"}>
        {artifact.blocks.map((block) => (
          <div key={`${workspaceArtifactKey([block])}-${block.id || "block"}`}>
            {renderUiBlock(block)}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function WorkspaceAgentPanel({
  projectId,
  currentView,
  onWorkspaceChanged,
  renderUiBlock,
  routeBlocks,
  viewer,
}: {
  projectId: number;
  currentView?: "today" | "tomorrow" | "this-week";
  onWorkspaceChanged: () => void;
  renderUiBlock?: (block: WorkspaceUiBlock) => React.ReactNode;
  routeBlocks?: WorkspaceUiBlock[];
  viewer: AuthenticatedUser;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState("");
  const [thread, setThread] = useState<WorkspaceAgentThread | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, WorkspaceArtifact>>({});
  const [activeArtifactKey, setActiveArtifactKey] = useState<string | null>(null);
  const [activeArtifactExpanded, setActiveArtifactExpanded] = useState(false);
  const [pinnedLoaded, setPinnedLoaded] = useState(false);
  const routeArtifactKeyRef = useRef<string | null>(null);
  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const routeBlocksKey = blocksKey(routeBlocks);
  const focusComposer = useCallback((waitForMutation = false) => {
    NavigationService.focusBySelector({
      regionId: "workspace-region",
      selector: CHAT_COMPOSER_SELECTOR,
    }, waitForMutation);
  }, []);
  const focusArtifact = useCallback((key: string, waitForMutation = true) => {
    NavigationService.focusBySelector({
      regionId: "workspace-region",
      selector: `[data-artifact-key="${escapeAttributeValue(key)}"] [data-artifact-content] [data-entrypoint-focus]`,
    }, waitForMutation);
  }, []);
  const focusArtifactFallback = useCallback((key: string, waitForMutation = true) => {
    NavigationService.focusBySelector({
      regionId: "workspace-region",
      selector: `[data-artifact-key="${escapeAttributeValue(key)}"] [data-artifact-content] :is(${NATIVE_CONTENT_FOCUS_SELECTOR})`,
    }, waitForMutation);
  }, []);
  const focusArtifactChromeFallback = useCallback((key: string, waitForMutation = true) => {
    NavigationService.focusBySelector({
      regionId: "workspace-region",
      selector: `[data-artifact-key="${escapeAttributeValue(key)}"] [data-focusable]`,
    }, waitForMutation);
  }, []);
  const openArtifact = useCallback((blocks: WorkspaceUiBlock[], options?: { focus?: boolean; pin?: boolean; source?: WorkspaceArtifactSource }) => {
    if (blocks.length === 0) return;
    const key = workspaceArtifactKey(blocks);
    setArtifacts((current) => upsertWorkspaceArtifact(current, blocks, {
      pinned: options?.pin,
      source: options?.source ?? "quick",
      now: Date.now(),
    }));
    setActiveArtifactKey(key);
    setActiveArtifactExpanded(false);
    if (options?.focus) {
      focusArtifact(key, true);
      window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        const artifactElement = document.querySelector(`[data-artifact-key="${escapeAttributeValue(key)}"]`);
        if (!activeElement || activeElement === document.body || !artifactElement?.contains(activeElement)) {
          focusArtifactFallback(key, false);
          window.requestAnimationFrame(() => {
            const nextActiveElement = document.activeElement;
            if (!nextActiveElement || nextActiveElement === document.body || !artifactElement?.contains(nextActiveElement)) {
              focusArtifactChromeFallback(key, false);
            }
          });
        }
      });
    }
  }, [focusArtifact, focusArtifactChromeFallback, focusArtifactFallback]);
  const showBlock = useCallback((block: WorkspaceUiBlock, options?: { focus?: boolean; source?: WorkspaceArtifactSource }) => {
    openArtifact([block], options);
  }, [openArtifact]);
  const isBlockActive = useCallback((block: WorkspaceUiBlock) => {
    return activeArtifactKey === workspaceArtifactKey([block]);
  }, [activeArtifactKey]);

  const threadQuery = useQuery({
    queryKey: workspaceAgentKey(projectId),
    queryFn: async () => {
      const response = await getWorkspaceAgentThread(projectId);
      if (!response.success || !response.data) throw new Error(response.error || "Could not load agent");
      setThread(response.data);
      return response.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await sendWorkspaceAgentMessage({
        projectId,
        prompt,
        timeZone,
        currentView,
      });
      if (!response.success || !response.data) throw new Error(response.error || "Could not run agent");
      return response.data;
    },
    onSuccess: (nextThread) => {
      setThread(nextThread);
      queryClient.setQueryData(workspaceAgentKey(projectId), nextThread);

      executeWorkspaceUiActions(getActionUiActions(nextThread.latestAction), navigate, location.pathname, showBlock, isBlockActive, {
        focusShownBlocks: true,
      });

      if (actionCreatesTasks(nextThread.latestAction)) {
        onWorkspaceChanged();
        void queryClient.invalidateQueries({ queryKey: timeReviewKey });
        void queryClient.invalidateQueries({ queryKey: progressSummaryKey });
      }
    },
  });

  const handleUiActions = useCallback((actions: WorkspaceUiAction[]) => {
    executeWorkspaceUiActions(actions, navigate, location.pathname, showBlock, isBlockActive, { focusShownBlocks: true });
  }, [isBlockActive, location.pathname, navigate, showBlock]);

  const messages = useMemo(
    () => (thread ?? threadQuery.data)?.messages.map((message) => messageToChatMessage(message, handleUiActions)) ?? [],
    [handleUiActions, thread, threadQuery.data],
  );
  const activeThread = thread ?? threadQuery.data ?? null;
  const llmConfigured = activeThread?.llmConfigured ?? true;
  const activeArtifact = activeArtifactKey ? artifacts[activeArtifactKey] : null;

  useEffect(() => {
    if (pinnedLoaded) return;
    if (typeof window === "undefined") return;
    setArtifacts((current) => ({
      ...restorePinnedWorkspaceArtifacts(window.localStorage.getItem(artifactStorageKey(projectId))),
      ...current,
    }));
    setPinnedLoaded(true);
  }, [pinnedLoaded, projectId]);

  useEffect(() => {
    if (!pinnedLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(artifactStorageKey(projectId), serializePinnedWorkspaceArtifacts(artifacts));
  }, [artifacts, pinnedLoaded, projectId]);

  useEffect(() => {
    if (!activeArtifactExpanded || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeArtifactExpanded]);

  useEffect(() => {
    if (!routeBlocks || routeBlocks.length === 0) {
      setActiveArtifactExpanded(false);
      setActiveArtifactKey((currentKey) => {
        if (!currentKey) return currentKey;
        return currentKey === routeArtifactKeyRef.current ? null : currentKey;
      });
      routeArtifactKeyRef.current = null;
      return;
    }
    const key = workspaceArtifactKey(routeBlocks);
    routeArtifactKeyRef.current = key;
    setArtifacts((current) => upsertWorkspaceArtifact(current, routeBlocks, {
      source: "route",
      now: Date.now(),
    }));
    setActiveArtifactKey(key);
    setActiveArtifactExpanded(false);
  }, [routeBlocks, routeBlocksKey]);

  useEffect(() => {
    const shownBlocks = getShownBlocks(activeThread?.latestAction);
    if (shownBlocks.length === 0) return;
    setArtifacts((current) => {
      let next = current;
      for (const block of shownBlocks) {
        next = upsertWorkspaceArtifact(next, [block], {
          source: "agent",
          now: Date.now(),
        });
      }
      return next;
    });
  }, [activeThread?.latestAction]);

  const handleSubmit = useCallback((prompt: string) => {
    setValue("");
    mutation.mutate(prompt);
  }, [mutation]);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    if (suggestion === SHOW_TIMER_SUGGESTION) {
      setValue("");
      openArtifact([timerBlock()], { focus: true, source: "quick" });
      return;
    }
    if (suggestion === SHOW_TODAY_SUGGESTION) {
      setValue("");
      openArtifact(todayBlocks(), { focus: true, source: "quick" });
      navigate("/workspace/today");
      return;
    }
    handleSubmit(suggestion);
  }, [handleSubmit, navigate, openArtifact]);

  const pinnedArtifacts = useMemo(() => Object.values(artifacts)
    .filter((artifact) => artifact.pinned)
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt), [artifacts]);
  const recentArtifacts = useMemo(() => Object.values(artifacts)
    .filter((artifact) => !artifact.pinned)
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, 4), [artifacts]);
  const toggleArtifactPin = useCallback((artifact: WorkspaceArtifact) => {
    setArtifacts((current) => ({
      ...current,
      [artifact.key]: {
        ...artifact,
        pinned: !artifact.pinned,
        lastOpenedAt: Date.now(),
      },
    }));
  }, []);
  const closeActiveArtifact = useCallback(() => {
    setActiveArtifactKey(null);
    setActiveArtifactExpanded(false);
    focusComposer(false);
  }, [focusComposer]);
  const toggleActiveArtifactExpanded = useCallback(() => {
    setActiveArtifactExpanded((current) => !current);
  }, []);
  const openKnownArtifact = useCallback((artifact: WorkspaceArtifact) => {
    openArtifact(artifact.blocks, { focus: true, source: artifact.source });
  }, [openArtifact]);
  const liveContent = renderUiBlock && activeArtifact ? (
    <div className="mx-auto w-full max-w-5xl">
      <ArtifactStage
        artifact={activeArtifact}
        expanded={activeArtifactExpanded}
        renderUiBlock={renderUiBlock}
        onToggleExpanded={toggleActiveArtifactExpanded}
        onTogglePin={toggleArtifactPin}
        onClose={closeActiveArtifact}
      />
    </div>
  ) : null;

  return (
    <section
      data-layout="vertical"
      data-order="0"
      className="flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-950"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">Plan agent</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Add, find, and shape tasks from here.</p>
          </div>
        </div>
        <div data-layout="horizontal" className="flex shrink-0 items-center gap-2">
          <WorkspaceAccountMenu viewer={viewer} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-2 sm:px-6">
        <div data-layout="horizontal" className="flex min-h-10 flex-wrap items-center gap-2">
          <QuickArtifactButton
            label="Today"
            icon={<CalendarCheck className="size-3.5" />}
            order={0}
            onClick={() => {
              openArtifact(todayBlocks(), { focus: true, source: "quick" });
              navigate("/workspace/today");
            }}
          />
          <QuickArtifactButton
            label="Timer"
            icon={<TimerIcon className="size-3.5" />}
            order={1}
            onClick={() => openArtifact([timerBlock()], { focus: true, source: "quick" })}
          />
          {pinnedArtifacts.length > 0 ? (
            <span className="ml-1 text-xs font-medium text-slate-400 dark:text-slate-500">Pinned</span>
          ) : null}
          {pinnedArtifacts.map((artifact, index) => (
            <ArtifactButton
              key={artifact.key}
              artifact={artifact}
              order={10 + index}
              onOpen={openKnownArtifact}
            />
          ))}
          {recentArtifacts.length > 0 ? (
            <span className="ml-1 text-xs font-medium text-slate-400 dark:text-slate-500">Recent</span>
          ) : null}
          {recentArtifacts.map((artifact, index) => (
            <ArtifactButton
              key={artifact.key}
              artifact={artifact}
              order={20 + index}
              onOpen={openKnownArtifact}
            />
          ))}
        </div>
      </div>

      <AssistantChatBox
        messages={messages}
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        onSuggestionSelect={handleSuggestionSelect}
        isBusy={mutation.isPending || threadQuery.isLoading}
        disabled={threadQuery.isError}
        placeholder=""
        emptyState="Ready when you are."
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-5 sm:px-6"
        messagesClassName="min-h-0 flex-1 overflow-y-auto px-1 py-4"
        liveContent={liveContent}
        suggestions={messages.length === 0 ? [
          SHOW_TODAY_SUGGESTION,
          SHOW_TIMER_SUGGESTION,
          ...(llmConfigured ? ["Add launch checklist to side project today"] : []),
        ] : []}
      />

      {threadQuery.isError || mutation.isError ? (
        <p className="mx-auto w-full max-w-6xl px-4 pb-3 text-xs text-rose-600 dark:text-rose-300 sm:px-6">
          {(threadQuery.error || mutation.error)?.message || "Agent failed."}
        </p>
      ) : null}
    </section>
  );
}
