// @vitest-environment happy-dom

import React, { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AssistantChatBox, type AssistantChatMessage } from "./AssistantChatBox";

type RenderResult = {
  container: HTMLDivElement;
  root: Root;
};

const messages: AssistantChatMessage[] = [
  { id: "assistant-1", role: "assistant", content: "Tell me the repeat pattern." },
  { id: "user-1", role: "user", content: "Every weekday" },
];

const mountedRoots: RenderResult[] = [];

function render(ui: React.ReactElement): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  const result = { container, root };
  mountedRoots.push(result);
  return result;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function pressComposerKey(textarea: HTMLTextAreaElement, key: string, shiftKey = false) {
  act(() => {
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function ControlledChat({
  onSubmit,
  onSuggestionSelect,
}: {
  onSubmit: (value: string) => void;
  onSuggestionSelect?: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return React.createElement(AssistantChatBox, {
    messages,
    value,
    onValueChange: setValue,
    onSubmit,
    suggestions: ["Every weekday", "Every Monday"],
    onSuggestionSelect,
    placeholder: "Ask for a schedule",
  });
}

afterEach(() => {
  for (const { root, container } of mountedRoots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  document.body.innerHTML = "";
});

describe("AssistantChatBox", () => {
  test("renders assistant and user messages with prompt suggestions", () => {
    const onSubmit = vi.fn();
    const { container } = render(React.createElement(ControlledChat, { onSubmit }));

    expect(container.textContent).toContain("Tell me the repeat pattern.");
    expect(container.textContent).toContain("Every weekday");
    expect(container.querySelector("textarea")?.placeholder).toBe("Ask for a schedule");
  });

  test("renders a centered empty state before the first user message", () => {
    const onSubmit = vi.fn();
    const { container } = render(React.createElement(AssistantChatBox, {
      messages: [],
      value: "",
      onValueChange: () => undefined,
      onSubmit,
      emptyState: "Ready when you are.",
      placeholder: "",
    }));

    expect(container.textContent).toContain("Ready when you are.");
    expect(container.querySelector("textarea")?.placeholder).toBe("");
    expect(container.querySelector('[data-order="0"]')?.className).toContain("py-8");
  });

  test("uses chat history layout after messages exist", () => {
    const onSubmit = vi.fn();
    const { container } = render(React.createElement(AssistantChatBox, {
      messages,
      value: "",
      onValueChange: () => undefined,
      onSubmit,
      emptyState: "Ready when you are.",
    }));

    expect(container.textContent).not.toContain("Ready when you are.");
    expect(container.querySelector('[data-order="0"]')?.className).toContain("overflow-y-auto");
  });

  test("submits the trimmed composer value on Enter", () => {
    const onSubmit = vi.fn();
    const { container } = render(React.createElement(ControlledChat, { onSubmit }));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "  Every 2 weeks on Friday  ");
    pressComposerKey(textarea, "Enter");

    expect(onSubmit).toHaveBeenCalledWith("Every 2 weeks on Friday");
  });

  test("does not submit when Shift+Enter is used in the composer", () => {
    const onSubmit = vi.fn();
    const { container } = render(React.createElement(ControlledChat, { onSubmit }));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

    setTextareaValue(textarea, "Every weekday");
    pressComposerKey(textarea, "Enter", true);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("selecting a suggestion updates the composer and calls the suggestion hook", () => {
    const onSubmit = vi.fn();
    const onSuggestionSelect = vi.fn();
    const { container } = render(React.createElement(ControlledChat, { onSubmit, onSuggestionSelect }));
    const suggestion = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Every Monday") as HTMLButtonElement;

    click(suggestion);

    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Every Monday");
    expect(onSuggestionSelect).toHaveBeenCalledWith("Every Monday");
  });

  test("blocks empty composer submissions", () => {
    const onSubmit = vi.fn();
    const { container } = render(React.createElement(ControlledChat, { onSubmit }));
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submit.disabled).toBe(true);
    click(submit);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("exposes stable keyboard layout metadata for modal scopes", () => {
    const onSubmit = vi.fn();
    const footer = React.createElement("button", { type: "button", "data-focusable": true }, "Save");
    const { container } = render(React.createElement(AssistantChatBox, {
      messages,
      value: "Every weekday",
      onValueChange: () => undefined,
      onSubmit,
      suggestions: ["Every weekday"],
      footer,
    }));

    expect(container.querySelector('[data-layout="vertical"][data-order="1"]')).not.toBeNull();
    expect(container.querySelector('[data-layout="horizontal"][data-order="1"]')).not.toBeNull();
    expect(container.querySelector('form[data-layout="horizontal"][data-order="2"]')).not.toBeNull();
    expect(container.querySelector('textarea[data-entrypoint-focus][data-focusable]')).not.toBeNull();
    expect(container.querySelector('[data-layout="vertical"][data-order="3"]')?.textContent).toContain("Save");
  });
});
