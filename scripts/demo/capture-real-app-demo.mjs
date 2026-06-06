#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");

const args = parseArgs(process.argv.slice(2));
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const fps = Number(args.fps || 15);
const cdpPort = Number(args.port || 9344);
const debugUrl = args["debug-url"] || `http://127.0.0.1:${cdpPort}`;
const baseUrl = String(args["base-url"] || "http://127.0.0.1:5173").replace(/\/+$/, "");
const authFile = path.resolve(projectRoot, String(args.auth || "scripts/demo/.demo-auth.json"));
const framesDir = path.resolve(projectRoot, String(args.frames || "scripts/demo/frames"));
const launchChrome = args["connect-only"] !== "1" && args["connect-only"] !== "true";
const chromeProfile = path.resolve(projectRoot, String(args.profile || "scripts/demo/chrome-profile"));

function parseArgs(rawArgs) {
  const parsed = {};
  for (const rawArg of rawArgs) {
    if (!rawArg.startsWith("--")) continue;
    const [key, ...valueParts] = rawArg.slice(2).split("=");
    parsed[key] = valueParts.length > 0 ? valueParts.join("=") : "true";
  }
  return parsed;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: init.signal || AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json();
}

async function waitForCdp(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetchJson(`${debugUrl}/json/version`);
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error(`Chrome did not expose CDP at ${debugUrl}`);
}

function createCdpClient(wsUrl) {
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  const ws = new WebSocket(wsUrl);

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "CDP error"));
      else resolve(message.result);
      return;
    }

    if (message.method && listeners.has(message.method)) {
      for (const listener of listeners.get(message.method)) listener(message.params);
    }
  });

  const opened = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return {
    ready: () => opened,
    call(method, params = {}) {
      const requestId = ++id;
      ws.send(JSON.stringify({ id: requestId, method, params }));
      return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
    },
    once(method) {
      return new Promise((resolve) => {
        const listener = (params) => {
          listeners.set(method, (listeners.get(method) || []).filter((item) => item !== listener));
          resolve(params);
        };
        listeners.set(method, [...(listeners.get(method) || []), listener]);
      });
    },
    close() {
      ws.close();
    },
  };
}

async function getOrCreateTarget() {
  const targets = await fetchJson(`${debugUrl}/json/list`);
  const existing = targets.find((target) => target.type === "page" && target.url.startsWith(baseUrl));
  if (existing?.webSocketDebuggerUrl) return existing;
  return fetchJson(`${debugUrl}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result.result?.value;
}

function jsString(value) {
  return JSON.stringify(value);
}

async function waitForExpression(cdp, expression, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(cdp, expression).catch(() => false);
    if (value) return value;
    await sleep(200);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function getRect(cdp, expression) {
  const value = await evaluate(cdp, `
    (() => {
      const element = (${expression});
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    })()
  `);
  if (!value) throw new Error(`Element not found for ${expression}`);
  return value;
}

function selectorExpression(selector, index = 0) {
  return `document.querySelectorAll(${jsString(selector)})[${index}]`;
}

function textExpression(selector, text) {
  return `Array.from(document.querySelectorAll(${jsString(selector)})).find((element) => (element.textContent || "").trim().includes(${jsString(text)}))`;
}

function taskTextareaExpression(text) {
  return `Array.from(document.querySelectorAll('textarea[aria-label="Task title"]')).find((element) => element.value.includes(${jsString(text)}))`;
}

function blankTaskTextareaExpression() {
  return `Array.from(document.querySelectorAll('textarea[aria-label="Task title"]')).find((element) => element.value.trim() === "")`;
}

async function injectCursor(cdp) {
  await evaluate(cdp, `
    (() => {
      const existing = document.getElementById("pmwd-demo-cursor");
      if (existing) existing.remove();
      const cursor = document.createElement("div");
      cursor.id = "pmwd-demo-cursor";
      cursor.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        "z-index:2147483647",
        "width:32px",
        "height:32px",
        "pointer-events:none",
        "transform:translate(80px,80px)",
        "filter:drop-shadow(0 8px 12px rgba(15,23,42,.26))"
      ].join(";");
      cursor.innerHTML = \`
        <svg viewBox="0 0 32 32" style="width:32px;height:32px;fill:white;stroke:#111827;stroke-width:2.4">
          <path d="M6 4L25 17.5L16.4 18.8L12 28L6 4Z"></path>
        </svg>
        <span style="position:absolute;left:-7px;top:-7px;width:36px;height:36px;border-radius:999px;border:2px solid rgba(37,99,235,.7);opacity:0;transform:scale(.5)"></span>
      \`;
      document.body.appendChild(cursor);
      window.__pmwdDemoCursor = {
        x: 80,
        y: 80,
        set(x, y, click = false) {
          this.x = x;
          this.y = y;
          cursor.style.transform = \`translate(\${x}px,\${y}px)\`;
          const ping = cursor.querySelector("span");
          if (click) {
            ping.animate([
              { opacity: 0.6, transform: "scale(.55)" },
              { opacity: 0, transform: "scale(2.25)" }
            ], { duration: 360, easing: "ease-out" });
          }
        }
      };
    })()
  `);
}

let frameIndex = 0;
async function captureFrame(cdp) {
  frameIndex += 1;
  const result = await cdp.call("Page.captureScreenshot", {
    format: "jpeg",
    quality: 88,
    fromSurface: true,
  });
  await writeFile(
    path.join(framesDir, `frame_${String(frameIndex).padStart(5, "0")}.jpg`),
    Buffer.from(result.data, "base64"),
  );
}

async function setCursor(cdp, x, y, click = false) {
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await evaluate(cdp, `window.__pmwdDemoCursor?.set(${Math.round(x)}, ${Math.round(y)}, ${click ? "true" : "false"})`);
}

async function hold(cdp, seconds) {
  const frames = Math.max(1, Math.round(seconds * fps));
  for (let i = 0; i < frames; i += 1) {
    await captureFrame(cdp);
    await sleep(35);
  }
}

async function moveTo(cdp, x, y, seconds = 0.85) {
  const current = await evaluate(cdp, `window.__pmwdDemoCursor ? { x: window.__pmwdDemoCursor.x, y: window.__pmwdDemoCursor.y } : { x: 80, y: 80 }`);
  const frames = Math.max(2, Math.round(seconds * fps));
  for (let i = 1; i <= frames; i += 1) {
    const t = i / frames;
    const eased = 1 - Math.pow(1 - t, 3);
    const nextX = current.x + (x - current.x) * eased;
    const nextY = current.y + (y - current.y) * eased;
    await setCursor(cdp, nextX, nextY);
    await captureFrame(cdp);
    await sleep(25);
  }
}

async function clickAt(cdp, x, y) {
  await setCursor(cdp, x, y, true);
  await cdp.call("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await captureFrame(cdp);
  await sleep(80);
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await captureFrame(cdp);
}

async function clickElement(cdp, expression, seconds = 0.85) {
  const rect = await getRect(cdp, expression);
  await moveTo(cdp, rect.x, rect.y, seconds);
  await clickAt(cdp, rect.x, rect.y);
  return rect;
}

async function typeText(cdp, text) {
  for (const char of text) {
    await cdp.call("Input.insertText", { text: char });
    await captureFrame(cdp);
    await sleep(35);
  }
}

const keyDefinitions = {
  Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", windowsVirtualKeyCode: 38 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 },
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
};

async function pressKey(cdp, key) {
  const definition = keyDefinitions[key];
  if (!definition) throw new Error(`Unsupported demo key: ${key}`);

  await cdp.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    ...definition,
    nativeVirtualKeyCode: definition.windowsVirtualKeyCode,
  });
  await captureFrame(cdp);
  await sleep(90);
  await cdp.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    ...definition,
    nativeVirtualKeyCode: definition.windowsVirtualKeyCode,
  });
  await captureFrame(cdp);
}

async function showKeyboardFlow(cdp) {
  for (const key of ["ArrowDown", "ArrowRight", "ArrowLeft", "Tab", "Enter"]) {
    await pressKey(cdp, key);
    await hold(cdp, 0.28);
  }
}

async function main() {
  const auth = JSON.parse(await readFile(authFile, "utf8"));

  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(chromeProfile, { recursive: true });

  let chrome = null;
  if (launchChrome) {
    chrome = spawn("google-chrome", [
      `--remote-debugging-port=${cdpPort}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${chromeProfile}`,
      `--window-size=${width},${height}`,
      "--force-device-scale-factor=1",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "about:blank",
    ], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  }

  try {
    await waitForCdp();
    const target = await getOrCreateTarget();
    const cdp = createCdpClient(target.webSocketDebuggerUrl);
    await cdp.ready();

    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Network.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: width,
      screenHeight: height,
    });

    await cdp.call("Network.setCookie", {
      url: baseUrl,
      name: "only_tasks_session",
      value: auth.token,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.parse(auth.expiresAt) / 1000),
    });

    const loadEvent = cdp.once("Page.loadEventFired");
    await cdp.call("Page.navigate", { url: `${baseUrl}/app/workspace/all-tasks` });
    await loadEvent.catch(() => undefined);
    await waitForExpression(cdp, `Boolean(${taskTextareaExpression("Record homepage walkthrough")})`, 25000);
    await evaluate(cdp, `document.documentElement.classList.remove("dark")`);
    await injectCursor(cdp);
    await hold(cdp, 2.0);

    await waitForExpression(cdp, `Boolean(${blankTaskTextareaExpression()})`);
    await hold(cdp, 0.8);

    await clickElement(cdp, blankTaskTextareaExpression(), 0.9);
    await typeText(cdp, "Send demo link to homepage");
    await hold(cdp, 1.2);

    await clickElement(cdp, taskTextareaExpression("Record homepage walkthrough"), 0.9);
    await evaluate(cdp, `
      (() => {
        const textarea = ${taskTextareaExpression("Record homepage walkthrough")};
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
      })()
    `);
    await hold(cdp, 0.5);
    await evaluate(cdp, `
      (() => {
        const indicator = document.getElementById("keyboard-flow-indicator");
        if (!indicator) return;
        if (!indicator.dataset.demoSuppressKeys) {
          indicator.dataset.demoSuppressKeys = "true";
          indicator.addEventListener("keydown", (event) => {
            if (["ArrowDown", "ArrowRight", "ArrowLeft", "Tab", "Enter"].includes(event.key)) {
              event.preventDefault();
            }
          }, { capture: true });
        }
        indicator.focus({ preventScroll: true });
      })()
    `);
    await showKeyboardFlow(cdp);
    await hold(cdp, 0.6);

    await clickElement(cdp, textExpression("a", "Today"), 1.0);
    await waitForExpression(cdp, `document.body.textContent.includes("Tasks due for today")`);
    await hold(cdp, 2.0);

    await clickElement(cdp, textExpression("a", "All Tasks"), 1.0);
    await waitForExpression(cdp, `Boolean(${taskTextareaExpression("Record homepage walkthrough")})`);
    await hold(cdp, 1.0);

    await clickElement(cdp, 'document.querySelector("button[aria-label=\\"Start timer\\"]")', 0.9);
    await waitForExpression(cdp, `Boolean(document.querySelector('button[aria-label="Pause timer"]'))`, 7000);
    await hold(cdp, 1.8);

    await clickElement(cdp, 'Array.from(document.querySelectorAll("button[aria-label=\\"Open focus mode\\"]")).at(-1)', 0.9);
    await waitForExpression(cdp, `Boolean(document.querySelector("#timer-focus-region"))`, 7000);
    if (await evaluate(cdp, `Boolean(document.querySelector('#timer-focus-region button[aria-label="Start timer"]'))`)) {
      await clickElement(cdp, 'document.querySelector("#timer-focus-region button[aria-label=\\"Start timer\\"]")', 0.65);
      await waitForExpression(cdp, `Boolean(document.querySelector('#timer-focus-region button[aria-label="Pause timer"]'))`, 7000);
    }
    await hold(cdp, 3.0);

    await clickElement(cdp, 'document.querySelector("button[aria-label=\\"Close focus mode\\"]")', 0.75);
    await hold(cdp, 1.0);

    cdp.close();
  } finally {
    if (chrome) {
      chrome.kill("SIGTERM");
      await sleep(300);
      if (!chrome.killed) chrome.kill("SIGKILL");
    }
  }

  console.log(JSON.stringify({
    baseUrl,
    framesDir: path.relative(projectRoot, framesDir),
    frames: frameIndex,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
