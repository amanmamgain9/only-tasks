import React, { memo, useCallback, useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";

export type AssistantChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: React.ReactNode;
  tone?: "default" | "success" | "warning";
};

export type AssistantChatBoxProps = {
  messages: AssistantChatMessage[];
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  suggestions?: string[];
  onSuggestionSelect?: (value: string) => void;
  placeholder?: string;
  submitLabel?: string;
  ariaLabel?: string;
  isBusy?: boolean;
  disabled?: boolean;
  order?: string | number;
  emptyState?: React.ReactNode;
  footer?: React.ReactNode;
};

function getAssistantBubbleTone(tone: AssistantChatMessage["tone"]) {
  if (tone === "success") {
    return "rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-3 text-slate-900 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-slate-100";
  }
  if (tone === "warning") {
    return "rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  }
  return "px-1 py-1 text-slate-700 dark:text-slate-200";
}

function AssistantChatBoxComponent({
  messages,
  value,
  onValueChange,
  onSubmit,
  suggestions = [],
  onSuggestionSelect,
  placeholder = "Ask the assistant",
  submitLabel = "Send",
  ariaLabel = "Assistant prompt",
  isBusy = false,
  disabled = false,
  order = "1",
  emptyState,
  footer,
}: AssistantChatBoxProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canSubmit = value.trim().length > 0 && !isBusy && !disabled;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submitCurrentValue = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isBusy || disabled) return;
    onSubmit(trimmed);
  }, [disabled, isBusy, onSubmit, value]);

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitCurrentValue();
  }, [submitCurrentValue]);

  const handleComposerKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitCurrentValue();
  }, [submitCurrentValue]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    if (isBusy || disabled) return;
    onValueChange(suggestion);
    if (onSuggestionSelect) onSuggestionSelect(suggestion);
  }, [disabled, isBusy, onSuggestionSelect, onValueChange]);

  return (
    <div
      data-layout="vertical"
      data-order={order.toString()}
      className="space-y-3"
    >
      <div data-order="0" className={hasMessages ? "max-h-72 overflow-y-auto px-1 py-1" : "px-2 py-8"}>
        {hasMessages ? (
          <div className="space-y-3">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] text-sm leading-6 ${
                      isUser
                        ? "rounded-xl border border-slate-950 bg-slate-950 px-3.5 py-2.5 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950"
                        : getAssistantBubbleTone(message.tone)
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center text-center text-xl font-medium text-slate-950 dark:text-slate-100">
            {emptyState}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {suggestions.length > 0 ? (
        <div data-order="1" data-layout="horizontal" className="flex flex-wrap gap-2 px-1">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              data-focusable
              data-tab-consume
              data-order={index.toString()}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={disabled || isBusy}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <form
        data-order="2"
        data-layout="horizontal"
        onSubmit={handleSubmit}
        className={`flex items-end border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 ${
          hasMessages ? "rounded-2xl" : "rounded-full"
        }`}
      >
        <textarea
          data-entrypoint-focus
          data-focusable
          data-tab-consume
          data-order="0"
          rows={1}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          disabled={disabled}
          className={`max-h-32 flex-1 resize-none border-0 bg-transparent px-3 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500 ${
            hasMessages ? "min-h-14 py-2" : "min-h-10 py-2"
          }`}
        />
        <button
          type="submit"
          data-focusable
          data-tab-consume
          data-order="1"
          aria-label={submitLabel}
          disabled={!canSubmit}
          className="ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
        >
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>

      {footer ? (
        <div data-order="3" data-layout="vertical" className="px-1">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export const AssistantChatBox = memo(AssistantChatBoxComponent);
