import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AssistantChatBox, type AssistantChatMessage } from '@/features/ai/AssistantChatBox';
import type { AssistantStoredMessage, RecurrenceAssistantThread } from '@/features/ai/types';
import {
  getLocalDateKey,
  type RecurrenceAssistantResult,
} from '@/features/recurrence/recurrenceAssistant';
import { getRecurrenceAssistantThread, sendRecurrenceAssistantMessage } from '../../../_services/backendService';
import { NavigationService } from '../../../_services/navigationService';
import type { RecurrenceSchedule } from './types';

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (recurrence: RecurrenceSchedule) => void;
  taskClientId?: string | null;
  initialStartDate?: string | null;
  initialRecurrence?: RecurrenceSchedule | null;
}

function formatPreviewDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function getRecurrenceResultFromMessage(message: AssistantStoredMessage) {
  if (!message.structuredPayload || typeof message.structuredPayload !== 'object') return null;
  const payload = message.structuredPayload as { type?: unknown; result?: unknown };
  if (payload.type !== 'recurrence_assistant_result') return null;
  const result = payload.result as RecurrenceAssistantResult;
  return result && typeof result === 'object' && 'ok' in result ? result : null;
}

function isRecurrenceContextMessage(message: AssistantStoredMessage) {
  if (!message.structuredPayload || typeof message.structuredPayload !== 'object') return false;
  return (message.structuredPayload as { type?: unknown }).type === 'recurrence_assistant_context';
}

function normalizeRecurrenceForComparison(schedule: RecurrenceSchedule | null | undefined) {
  if (!schedule) return { mode: 'none' };
  if (schedule.mode === 'weekly') {
    return {
      ...schedule,
      endDate: schedule.endDate ?? null,
      interval: schedule.interval ?? 1,
      weekdays: [...(schedule.weekdays ?? [])].sort((a, b) => a - b),
    };
  }
  if (schedule.mode === 'daily') {
    return {
      ...schedule,
      endDate: schedule.endDate ?? null,
      interval: schedule.interval ?? 1,
    };
  }
  if (schedule.mode === 'weekdays') {
    return {
      ...schedule,
      endDate: schedule.endDate ?? null,
    };
  }
  return schedule;
}

function recurrenceMatches(a: RecurrenceSchedule | null | undefined, b: RecurrenceSchedule | null | undefined) {
  return JSON.stringify(normalizeRecurrenceForComparison(a)) === JSON.stringify(normalizeRecurrenceForComparison(b));
}

function useRecurrenceAssistantState({ initialStartDate, isOpen, onClose, onSave, taskClientId }: RecurrenceModalProps) {
  const [prompt, setPrompt] = useState('');
  const [thread, setThread] = useState<RecurrenceAssistantThread | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayDate = useMemo(() => getLocalDateKey(), [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPrompt('');
    setThread(null);
    setError(null);
    if (!taskClientId) return;

    let cancelled = false;
    setIsLoadingThread(true);
    getRecurrenceAssistantThread(taskClientId)
      .then((response) => {
        if (cancelled) return;
        setThread(response.data ?? null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load assistant thread');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingThread(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, taskClientId]);

  const submitPrompt = useCallback((value: string) => {
    const nextPrompt = value.trim();
    if (!nextPrompt || !taskClientId) return;
    setPrompt('');
    setError(null);
    setIsSending(true);
    sendRecurrenceAssistantMessage({
      taskClientId,
      prompt: nextPrompt,
      todayDate,
      initialStartDate,
    })
      .then((response) => {
        setThread(response.data ?? null);
      })
      .catch((sendError) => {
        setError(sendError instanceof Error ? sendError.message : 'Failed to send assistant message');
        setPrompt(nextPrompt);
      })
      .finally(() => {
        setIsSending(false);
      });
  }, [initialStartDate, taskClientId, todayDate]);

  const handleSave = useCallback(() => {
    const latestResult = thread?.latestResult;
    if (!latestResult?.ok) return;
    onSave(latestResult.draft.recurrence);
    onClose();
  }, [onClose, onSave, thread?.latestResult]);

  return {
    error,
    handleSave,
    isLoadingThread,
    isSending,
    prompt,
    setPrompt,
    submitPrompt,
    thread,
  };
}

function RecurrenceResultContent({ result }: { result: RecurrenceAssistantResult }) {
  if (!result.ok) {
    return (
      <div>
        <p className="font-medium">{result.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.suggestions.map((suggestion) => (
            <span
              key={suggestion}
              className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-400/10 dark:text-amber-100"
            >
              {suggestion}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white dark:bg-cyan-400 dark:text-slate-950">
          <Check className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{result.draft.summary}</p>
          {result.draft.previewDates.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {result.draft.previewDates.map((date) => (
                <span
                  key={date}
                  className="rounded-lg border border-cyan-200 bg-white px-2.5 py-2 text-center text-xs font-medium text-slate-700 dark:border-cyan-500/20 dark:bg-slate-900 dark:text-slate-200"
                >
                  {formatPreviewDate(date)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RecurrenceActions({
  canSave,
  handleSave,
  saveLabel,
}: {
  canSave: boolean;
  handleSave: () => void;
  saveLabel: string;
}) {
  return (
    <div data-order="3" className="flex justify-end">
      <div data-layout="horizontal" className="flex justify-end gap-3">
        {canSave ? (
          <button
            type="button"
            data-focusable
            data-tab-consume
            data-order="1"
            onClick={handleSave}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const RecurrenceModal: React.FC<RecurrenceModalProps> = (props) => {
  const { initialRecurrence, isOpen, onClose } = props;
  const modalRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const state = useRecurrenceAssistantState(props);
  const latestResult = state.thread?.latestResult ?? null;
  const currentRecurrence = state.thread?.currentRecurrence ?? initialRecurrence ?? null;
  const hasExistingRecurrence = Boolean(currentRecurrence && currentRecurrence.mode !== 'none');
  const canSaveLatestResult = Boolean(
    latestResult?.ok && !recurrenceMatches(latestResult.draft.recurrence, currentRecurrence),
  );
  const saveLabel = latestResult?.ok && latestResult.draft.recurrence.mode === 'none'
    ? 'Remove repeat'
    : hasExistingRecurrence ? 'Save change' : 'Save repeat';
  const emptyState = hasExistingRecurrence ? 'How should this repeat now?' : 'When should this repeat?';
  const messages = useMemo<AssistantChatMessage[]>(() => {
    const storedMessages = state.thread?.messages ?? [];
    const nextMessages = storedMessages.filter((message) => !isRecurrenceContextMessage(message)).map((message): AssistantChatMessage => {
      const result = getRecurrenceResultFromMessage(message);
      if (result) {
        return {
          id: `message-${message.id}`,
          role: 'assistant',
          tone: result.ok ? 'success' : 'warning',
          content: <RecurrenceResultContent result={result} />,
        };
      }

      return {
        id: `message-${message.id}`,
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
      };
    });

    if (state.error) {
      nextMessages.push({
        id: 'assistant-error',
        role: 'assistant',
        tone: 'warning',
        content: state.error,
      });
    }

    return nextMessages;
  }, [state.error, state.thread?.messages]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const modalElement = modalRef.current;
    if (modalElement) {
      NavigationService.pushScope(modalElement, {
        getInitialFocus: (root) => (
          root.querySelector('[data-entrypoint-focus]') ??
          root.querySelector('[data-focusable]')
        ) as HTMLElement,
      });
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (modalElement) NavigationService.popScope();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <dialog
        ref={modalRef}
        open
        aria-modal="true"
        aria-label="Set repeat schedule"
        data-scope
        className="static m-0 w-full max-w-xl rounded-xl border-0 bg-white p-5 text-left shadow-2xl dark:bg-slate-800"
      >
        <div data-region id="recurrence-modal-region" data-tab-consume>
          <div data-layout="vertical">
            <div data-order="0" className="mb-2 flex justify-end">
              <button
                type="button"
                data-focusable
                data-tab-consume
                data-order="0"
                onClick={onClose}
                aria-label="Close repeat dialog"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <AssistantChatBox
              messages={messages}
              value={state.prompt}
              onValueChange={state.setPrompt}
              onSubmit={state.submitPrompt}
              placeholder=""
              submitLabel="Send"
              ariaLabel="Repeat instruction"
              isBusy={state.isSending || state.isLoadingThread}
              disabled={!props.taskClientId}
              emptyState={emptyState}
              footer={(
                <RecurrenceActions
                  canSave={canSaveLatestResult}
                  handleSave={state.handleSave}
                  saveLabel={saveLabel}
                />
              )}
            />
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default RecurrenceModal;
