// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { WorkspaceUiBlock } from "@/features/ai/types";
import WorkspaceAgentPanel from "./WorkspaceAgentPanel";
import type { AuthenticatedUser } from "@/server/auth";

vi.mock("../../_services/backendService", () => ({
  getWorkspaceAgentThread: vi.fn(async () => ({
    success: true,
    data: {
      thread: {
        id: 1,
        surface: "workspace",
        entityType: null,
        entityId: null,
        entityClientId: null,
        title: null,
        createdAt: "",
        updatedAt: "",
      },
      messages: [],
      latestAction: null,
      llmConfigured: true,
    },
  })),
  sendWorkspaceAgentMessage: vi.fn(),
}));

vi.mock("../../_services/navigationService", () => ({
  NavigationService: {
    focusBySelector: vi.fn((_target: { selector: string }, _wait?: boolean) => {
      const element = document.querySelector(_target.selector) as HTMLElement | null;
      element?.focus();
    }),
  },
}));

vi.mock("@/features/marketing/components/ThemeToggle", async () => {
  const ReactModule = await import("react");
  return {
    default: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => ReactModule.createElement("button", {
      type: "button",
      "aria-label": "Theme",
      ...props,
    }, "Theme"),
  };
});

type RenderResult = {
  container: HTMLDivElement;
  root: Root;
};

const mountedRoots: RenderResult[] = [];
const viewer = {
  id: 1,
  email: "demo@planmyworkday.dev",
  name: "Plan My Workday Demo",
  image: null,
  profilePicture: null,
  isAdmin: false,
  subscription: {
    id: 1,
    status: "active",
    provider: "manual",
    planKey: "lifetime",
    label: "Lifetime",
    note: null,
    isEntitled: true,
    isTrial: false,
    requiresBillingMigrationReview: false,
    autoRenew: false,
    billingPortalAvailable: true,
  },
} satisfies AuthenticatedUser;

function defaultRenderUiBlock(block: WorkspaceUiBlock) {
  return (
    <div data-testid={`block-${block.type}`}>
      <button type="button" data-entrypoint-focus data-focusable>
        {block.type === "task_tree" ? block.view : block.type}
      </button>
    </div>
  );
}

function renderPanel(
  routeBlocks?: WorkspaceUiBlock[],
  renderUiBlock: (block: WorkspaceUiBlock) => React.ReactNode = defaultRenderUiBlock,
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();

  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/workspace/today"]}>
          <div id="workspace-region">
            <WorkspaceAgentPanel
              projectId={1}
              currentView="today"
              onWorkspaceChanged={() => undefined}
              renderUiBlock={renderUiBlock}
              routeBlocks={routeBlocks}
              viewer={viewer}
            />
          </div>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  const result = { container, root };
  mountedRoots.push(result);
  return result;
}

function renderPanelShell(input: {
  routeBlocks?: WorkspaceUiBlock[];
  currentView?: "today" | "tomorrow" | "this-week";
  renderUiBlock?: (block: WorkspaceUiBlock) => React.ReactNode;
}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient();
  const renderUiBlock = input.renderUiBlock ?? defaultRenderUiBlock;

  const render = (routeBlocks?: WorkspaceUiBlock[], currentView?: "today" | "tomorrow" | "this-week") => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/workspace/today"]}>
            <div id="workspace-region">
              <WorkspaceAgentPanel
                projectId={1}
                currentView={currentView}
                onWorkspaceChanged={() => undefined}
                renderUiBlock={renderUiBlock}
                routeBlocks={routeBlocks}
                viewer={viewer}
              />
            </div>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
  };

  render(input.routeBlocks, input.currentView);

  const result = { container, root };
  mountedRoots.push(result);
  return { ...result, render };
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function nextAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

afterEach(() => {
  window.localStorage.clear();
  for (const { root, container } of mountedRoots.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("WorkspaceAgentPanel artifacts", () => {
  test("does not render an artifact by default when no route artifact is provided", () => {
    const { container } = renderPanel();

    expect(container.querySelector("[data-artifact-key]")).toBeNull();
    expect(container.textContent).toContain("Ready when you are.");
  });

  test("activates route-owned artifacts on direct route render", () => {
    const { container } = renderPanel([
      { type: "daily_targets", id: "route-targets" },
      { type: "task_tree", id: "route-today", view: "today" },
    ]);

    expect(container.querySelector("[data-artifact-key='task_tree:today']")).not.toBeNull();
    expect(container.textContent).toContain("Today");
    expect(container.querySelector("[data-testid='block-task_tree']")).not.toBeNull();
  });

  test("clears a route-owned active artifact when the route no longer provides one", () => {
    const { container, render } = renderPanelShell({
      currentView: "today",
      routeBlocks: [
        { type: "daily_targets", id: "route-targets" },
        { type: "task_tree", id: "route-today", view: "today" },
      ],
    });

    expect(container.querySelector("[data-artifact-key='task_tree:today']")).not.toBeNull();

    render([], undefined);

    expect(container.querySelector("[data-artifact-key='task_tree:today']")).toBeNull();
    expect(container.textContent).toContain("Ready when you are.");
  });

  test("closing an active artifact returns focus to the chat composer", () => {
    const { container } = renderPanel([{ type: "timer", id: "route-timer", mode: "compact" }]);
    const close = container.querySelector("button[aria-label='Close artifact']") as HTMLButtonElement;

    click(close);

    expect(container.querySelector("[data-artifact-key='timer:workspace']")).toBeNull();
    expect(document.activeElement).toBe(container.querySelector("textarea[data-entrypoint-focus]"));
  });

  test("opening an artifact focuses native controls in artifact content before chrome controls", async () => {
    const { container } = renderPanel(undefined, (block) => (
      <div data-testid={`block-${block.type}`}>
        <button type="button">Native {block.type} action</button>
      </div>
    ));
    const timer = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Timer") as HTMLButtonElement;

    click(timer);
    await nextAnimationFrame();

    expect(container.querySelector("[data-artifact-key='timer:workspace']")).not.toBeNull();
    expect(document.activeElement?.textContent).toBe("Native timer action");
  });

  test("opening Today from the quick controls renders the task tree without Daily Targets", () => {
    const { container } = renderPanel();
    const today = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Today") as HTMLButtonElement;

    click(today);

    expect(container.querySelector("[data-artifact-key='task_tree:today']")).not.toBeNull();
    expect(container.querySelector("[data-testid='block-task_tree']")).not.toBeNull();
    expect(container.querySelector("[data-testid='block-daily_targets']")).toBeNull();
  });

  test("keeps the default direct artifact layer focused on Today and Timer", () => {
    const { container } = renderPanel();

    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Today")).toBe(true);
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Timer")).toBe(true);
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Review")).toBe(false);
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Stats")).toBe(false);
    expect(container.textContent).not.toContain("Show this week's tasks");
    expect(container.textContent).not.toContain("Open day review");
    expect(container.textContent).not.toContain("Show stats");
  });

  test("expands an active artifact and returns it to chat size without unmounting its native content", () => {
    const { container } = renderPanel([{ type: "timer", id: "route-timer", mode: "compact" }]);
    const artifact = container.querySelector("[data-artifact-key='timer:workspace']") as HTMLElement;
    const expand = container.querySelector("button[aria-label='Expand artifact']") as HTMLButtonElement;

    click(expand);

    expect(artifact.getAttribute("data-artifact-expanded")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(container.querySelector("[data-testid='block-timer']")).not.toBeNull();

    const shrink = container.querySelector("button[aria-label='Return artifact to chat size']") as HTMLButtonElement;
    click(shrink);

    expect(artifact.getAttribute("data-artifact-expanded")).toBe("false");
    expect(document.body.style.overflow).toBe("");
    expect(container.querySelector("[data-testid='block-timer']")).not.toBeNull();
  });
});
