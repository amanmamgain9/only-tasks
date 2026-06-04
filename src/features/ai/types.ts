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
