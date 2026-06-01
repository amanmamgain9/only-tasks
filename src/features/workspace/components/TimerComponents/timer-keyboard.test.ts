// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationService } from "../../_services/navigationService";

function pressKey(key: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
}

describe("timer keyboard flow", () => {
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

  test("inline timer controls move in the expected arrow-key order", () => {
    const root = document.createElement("div");
    root.setAttribute("data-scope", "");
    root.innerHTML = `
      <section data-region id="timer-region" data-order="1">
        <div data-layout="horizontal">
          <div data-layout="horizontal" data-order="1">
            <div>
              <button id="detail" data-focusable data-order="0">Detail</button>
              <button id="toggle" data-entrypoint-focus data-focusable data-order="1">Toggle</button>
              <button id="skip" data-focusable data-order="2">Skip</button>
              <button id="reset" data-focusable data-order="3">Reset</button>
            </div>
          </div>
          <button id="focus" data-focusable data-order="4">Focus</button>
          <button id="settings" data-focusable data-order="5">Settings</button>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    NavigationService.init(root);
    const toggle = document.getElementById("toggle") as HTMLElement;
    const skip = document.getElementById("skip") as HTMLElement;
    const reset = document.getElementById("reset") as HTMLElement;
    const focus = document.getElementById("focus") as HTMLElement;

    toggle.focus();
    pressKey("ArrowRight");
    expect(document.activeElement).toBe(skip);

    pressKey("ArrowRight");
    expect(document.activeElement).toBe(reset);

    pressKey("ArrowRight");
    expect(document.activeElement).toBe(focus);
  });

  test("focus mode pushes a keyboard scope and restores the prior timer control on close", () => {
    const appRoot = document.createElement("div");
    appRoot.setAttribute("data-scope", "");
    appRoot.innerHTML = `
      <section data-region id="timer-region" data-order="1">
        <div data-layout="horizontal">
          <button id="open-focus" data-focusable data-order="1">Open Focus</button>
        </div>
      </section>
    `;
    document.body.appendChild(appRoot);

    const focusRoot = document.createElement("div");
    focusRoot.setAttribute("data-scope", "");
    focusRoot.innerHTML = `
      <section data-region id="timer-focus-region" data-order="1">
        <div data-layout="horizontal">
          <button id="focus-toggle" data-entrypoint-focus data-focusable data-order="1">Toggle</button>
          <button id="focus-skip" data-focusable data-order="2">Skip</button>
        </div>
      </section>
    `;
    document.body.appendChild(focusRoot);

    NavigationService.init(appRoot);
    const opener = document.getElementById("open-focus") as HTMLElement;
    const focusToggle = document.getElementById("focus-toggle") as HTMLElement;
    const focusSkip = document.getElementById("focus-skip") as HTMLElement;

    opener.focus();
    NavigationService.pushScope(focusRoot, {
      getInitialFocus: (root) => root.querySelector("[data-entrypoint-focus]") as HTMLElement,
    });

    expect(document.activeElement).toBe(focusToggle);

    pressKey("ArrowRight");
    expect(document.activeElement).toBe(focusSkip);

    NavigationService.popScope();
    expect(document.activeElement).toBe(opener);
  });
});
