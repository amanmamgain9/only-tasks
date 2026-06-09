import type { RecurrenceAssistantResult, RecurrenceAssistantSchedule } from "@/features/recurrence/recurrenceAssistant";

export type AssistantStoredMessage = {
  id: number;
  threadId: number;
  role: "assistant" | "user" | "system";
  content: string;
  structuredPayload: unknown | null;
  createdAt: string;
};

export type AssistantThread = {
  id: number;
  surface: string;
  entityType: string | null;
  entityId: number | null;
  entityClientId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurrenceAssistantThread = {
  thread: AssistantThread;
  messages: AssistantStoredMessage[];
  latestResult: RecurrenceAssistantResult | null;
  currentRecurrence: RecurrenceAssistantSchedule | null;
};

export type WorkspaceAgentTaskSummary = {
  clientId: string | null;
  title: string;
  category: "job" | "side_project" | "chore" | "lifestyle" | null;
  categoryLabel: string;
  parentTitles: string[];
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  rolloverCount: number;
};

export type WorkspaceUiAction =
  | {
      type: "navigate";
      to:
        | "/workspace/all-tasks"
        | "/workspace/today"
        | "/workspace/tomorrow"
        | "/workspace/this-week"
        | "/workspace/day-review"
        | "/workspace/progress";
      reason: string;
    }
  | {
      type: "focus_task";
      clientId: string;
      reason: string;
    }
  | {
      type: "show_block";
      block: WorkspaceUiBlock;
      reason: string;
    };

export type WorkspaceUiBlock =
  | {
      type: "task_tree";
      id?: string;
      title?: string;
      view: "all" | "today" | "tomorrow" | "this_week";
      focusTaskId?: string;
    }
  | {
      type: "timer";
      id?: string;
      title?: string;
      mode: "compact" | "full";
      taskClientId?: string;
    }
  | {
      type: "day_review";
      id?: string;
      title?: string;
      mode: "compact" | "full";
    }
  | {
      type: "progress";
      id?: string;
      title?: string;
      range: "daily" | "weekly";
    }
  | {
      type: "daily_targets";
      id?: string;
      title?: string;
    };

export type WorkspaceAgentAtomicAction =
  | {
      type: "tasks_created";
      createdCount: number;
      dueDate: string | null;
      uiActions: WorkspaceUiAction[];
      groups: Array<{
        category: "job" | "side_project" | "chore" | "lifestyle";
        label: string;
        titles: string[];
      }>;
    }
  | {
      type: "task_query";
      resultCount: number;
      shownCount: number;
      filters: string[];
      uiActions: WorkspaceUiAction[];
      tasks: WorkspaceAgentTaskSummary[];
    }
  | {
      type: "capabilities";
      uiActions: WorkspaceUiAction[];
      commands: string[];
    }
  | {
      type: "unsupported";
      reason: string;
      uiActions: WorkspaceUiAction[];
      suggestions: string[];
    }
  | {
      type: "agent_response";
      message: string;
      uiActions: WorkspaceUiAction[];
    };

export type WorkspaceAgentAction =
  | WorkspaceAgentAtomicAction
  | {
      type: "agent_workflow";
      summary: string;
      uiActions: WorkspaceUiAction[];
      steps: Array<{
        id: string;
        commandKind: string;
        title: string;
        action: WorkspaceAgentAtomicAction;
      }>;
    };

export type WorkspaceAgentThread = {
  thread: AssistantThread;
  messages: AssistantStoredMessage[];
  latestAction: WorkspaceAgentAction | null;
  llmConfigured: boolean;
};
