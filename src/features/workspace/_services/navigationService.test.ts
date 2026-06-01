// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationService } from "./navigationService";

function createScope(html: string) {
  const root = document.createElement("div");
  root.setAttribute("data-scope", "");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function createModalScope() {
  return createScope(`
    <section data-region id="modal-region">
      <div data-layout="vertical">
        <button id="modal-button" data-focusable data-entrypoint-focus>Modal</button>
      </div>
    </section>
  `);
}

describe("NavigationService scope restoration", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    document.body.innerHTML = "";
    NavigationService.cleanup();
  });

  afterEach(() => {
    NavigationService.cleanup();
    logSpy.mockRestore();
    document.body.innerHTML = "";
  });

  test("popScope can prefer an explicit fallback over the previous focused element", () => {
    const appRoot = createScope(`
      <section data-region id="workspace-region">
        <div data-layout="vertical">
          <div data-layout="horizontal" data-node-id="deleted">
            <button id="deleted-title" data-focusable data-entrypoint-focus>Deleted</button>
          </div>
          <div data-layout="horizontal" data-node-id="next">
            <button id="next-title" data-focusable data-entrypoint-focus>Next</button>
          </div>
        </div>
      </section>
    `);
    const modalRoot = createModalScope();
    const previous = document.getElementById("deleted-title") as HTMLElement;
    const next = document.getElementById("next-title") as HTMLElement;

    NavigationService.init(appRoot);
    previous.focus();
    NavigationService.pushScope(modalRoot, {
      getInitialFocus: (root) => root.querySelector("[data-entrypoint-focus]") as HTMLElement,
    });

    NavigationService.popScope({
      restorePrevious: false,
      fallbackSelectors: [{ regionId: "workspace-region", selector: '[data-node-id="next"] [data-entrypoint-focus]' }],
    });

    expect(document.activeElement).toBe(next);
  });

  test("popScope can defer fallback focus until the restored scope mutates", async () => {
    const appRoot = createScope(`
      <section data-region id="workspace-region">
        <div id="rows" data-layout="vertical"></div>
      </section>
    `);
    const modalRoot = createModalScope();

    NavigationService.init(appRoot);
    NavigationService.pushScope(modalRoot, {
      getInitialFocus: (root) => root.querySelector("[data-entrypoint-focus]") as HTMLElement,
    });

    NavigationService.popScope({
      restorePrevious: false,
      waitForMutation: true,
      fallbackSelectors: [{ regionId: "workspace-region", selector: '[data-node-id="next"] [data-entrypoint-focus]' }],
    });

    const row = document.createElement("div");
    row.setAttribute("data-layout", "horizontal");
    row.setAttribute("data-node-id", "next");
    row.innerHTML = '<button id="next-title" data-focusable data-entrypoint-focus>Next</button>';
    document.getElementById("rows")?.appendChild(row);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(document.getElementById("next-title"));
  });
});
