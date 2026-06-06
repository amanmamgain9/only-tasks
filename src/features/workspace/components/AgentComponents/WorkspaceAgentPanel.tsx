"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, ChevronDown, CornerDownRight, ListFilter, Sparkles, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AssistantChatBox, type AssistantChatMessage } from "@/features/ai/AssistantChatBox";
import type { AssistantStoredMessage, WorkspaceAgentAction, WorkspaceAgentTaskSummary, WorkspaceAgentThread, WorkspaceUiAction } from "@/features/ai/types";
import { getWorkspaceAgentThread, sendWorkspaceAgentMessage } from "../../_services/backendService";
import { progressSummaryKey } from "../../_hooks/useProgressSummary";
import { timeReviewKey } from "../../_hooks/useTimeReview";
import { NavigationService } from "../../_services/navigationService";

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const workspaceAgentKey = (projectId: number) => ["workspace-agent", projectId] as const;

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

function WorkspaceAgentActionCard({
  action,
  onUiActions,
}: {
  action: WorkspaceAgentAction;
  onUiActions: (actions: WorkspaceUiAction[]) => void;
}) {
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
                            ...action.uiActions,
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
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
        <XCircle className="size-4 text-amber-500" />
        <span>Not wired yet</span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-200">{action.reason}</p>
      <div className="flex flex-wrap gap-2">
        {action.suggestions.map((suggestion) => (
          <span key={suggestion} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
            {suggestion}
          </span>
        ))}
      </div>
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
    content: action ? <WorkspaceAgentActionCard action={action} onUiActions={onUiActions} /> : message.content,
    tone: action?.type === "unsupported" ? "warning" : action?.type === "tasks_created" ? "success" : "default",
  };
}

function escapeAttributeValue(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}

function executeWorkspaceUiActions(actions: WorkspaceUiAction[], navigate: ReturnType<typeof useNavigate>) {
  for (const action of actions) {
    if (action.type === "navigate") {
      navigate(action.to);
      continue;
    }

    NavigationService.focusBySelector({
      regionId: "workspace-region",
      selector: `[data-node-id="${escapeAttributeValue(action.clientId)}"] [data-entrypoint-focus]`,
    }, true);
  }
}

export default function WorkspaceAgentPanel({
  projectId,
  currentView,
  onWorkspaceChanged,
}: {
  projectId: number;
  currentView?: "today" | "tomorrow" | "this-week";
  onWorkspaceChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [thread, setThread] = useState<WorkspaceAgentThread | null>(null);
  const timeZone = useMemo(() => getBrowserTimeZone(), []);

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

      executeWorkspaceUiActions(nextThread.latestAction?.uiActions ?? [], navigate);

      if (nextThread.latestAction?.type === "tasks_created") {
        onWorkspaceChanged();
        void queryClient.invalidateQueries({ queryKey: timeReviewKey });
        void queryClient.invalidateQueries({ queryKey: progressSummaryKey });
      }
    },
  });

  const handleUiActions = useCallback((actions: WorkspaceUiAction[]) => {
    executeWorkspaceUiActions(actions, navigate);
  }, [navigate]);

  const messages = useMemo(
    () => (thread ?? threadQuery.data)?.messages.map((message) => messageToChatMessage(message, handleUiActions)) ?? [],
    [handleUiActions, thread, threadQuery.data],
  );

  const handleSubmit = useCallback((prompt: string) => {
    setValue("");
    mutation.mutate(prompt);
  }, [mutation]);

  return (
    <section
      data-layout="vertical"
      data-order="0"
      className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">Plan agent</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Add, find, and shape tasks from here.</p>
          </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-slate-400" />
      </div>

      <AssistantChatBox
        messages={messages}
        value={value}
        onValueChange={setValue}
        onSubmit={handleSubmit}
        isBusy={mutation.isPending || threadQuery.isLoading}
        disabled={threadQuery.isError}
        placeholder=""
        emptyState="What do you want to get done?"
        suggestions={messages.length === 0 ? [
          "Add launch checklist to side project today",
          "List open chores this week",
          "Show tasks I missed",
        ] : []}
      />

      {threadQuery.isError || mutation.isError ? (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
          {(threadQuery.error || mutation.error)?.message || "Agent failed."}
        </p>
      ) : null}
    </section>
  );
}
