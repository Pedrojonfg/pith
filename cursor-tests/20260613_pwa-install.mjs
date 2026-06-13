/**
 * PWA install prompt capture + fallback UX validation.
 * Run: node cursor-tests/20260613_pwa-install.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  getInstallHelpMessage,
  readStashedInstallPrompt,
  showInstallHelpToast,
} from "../src/js/pwa-install.js";
import { SW_VERSION } from "../src/js/sw-update.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const mainJs = readFileSync(join(root, "src/js/main.js"), "utf8");
const swJs = readFileSync(join(root, "sw.js"), "utf8");
const cursorrules = readFileSync(join(root, ".cursorrules"), "utf8");

let passed = 0;
function check(cond, msg) {
  assert(cond, msg);
  passed += 1;
}

// --- Happy path: early capture + consumer wiring ---

check(
  html.includes("__pithDeferredInstallPrompt"),
  "happy: index.html captures beforeinstallprompt before module load",
);
check(
  html.includes('e.preventDefault()') && html.includes("beforeinstallprompt"),
  "happy: inline script prevents default and stashes event",
);
check(
  mainJs.includes("showInstallHelpToast"),
  "happy: main.js shows visible install fallback",
);
check(
  mainJs.includes("readStashedInstallPrompt"),
  "happy: main.js reads stashed install prompt on boot",
);
check(
  mainJs.includes("installPromptUsed"),
  "happy: main.js tracks one-shot prompt() usage",
);

const fakeEvent = { prompt: () => Promise.resolve(), userChoice: Promise.resolve({ outcome: "accepted" }) };
const fakeWindow = { __pithDeferredInstallPrompt: fakeEvent };
const prompt = readStashedInstallPrompt(fakeWindow);
check(prompt === fakeEvent, "happy: readStashedInstallPrompt returns stashed event");
check(fakeWindow.__pithDeferredInstallPrompt === null, "happy: stash cleared after read");

check(
  getInstallHelpMessage({ userAgent: "Mozilla/5.0 Chrome/120" }).includes("Install app"),
  "happy: default Chrome help mentions Install app",
);
check(
  getInstallHelpMessage({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }).includes(
    "Add to Home Screen",
  ),
  "happy: iOS help mentions Add to Home Screen",
);

// --- Edge cases ---

check(readStashedInstallPrompt({}) === null, "edge: empty stash returns null");
check(readStashedInstallPrompt(undefined) === null, "edge: missing window returns null");
check(
  getInstallHelpMessage({ userAgent: "Mozilla/5.0 OPR/110 Chrome/120" }).includes("cannot install PWAs"),
  "happy: Opera desktop gets explicit unsupported message",
);
check(
  getInstallHelpMessage({ userAgent: "Mozilla/5.0 (Linux; Android 14) OPR/80" }).includes("Home screen"),
  "happy: Opera Android gets Add to Home screen guidance",
);
check(
  getInstallHelpMessage({ userAgent: "" }).includes("browser menu"),
  "edge: empty userAgent still returns generic guidance",
);
check(
  getInstallHelpMessage({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    platform: "MacIntel",
    maxTouchPoints: 5,
  }).includes("Add to Home Screen"),
  "edge: iPad on MacIntel detected as iOS",
);

// --- Failure cases: must not silently fail ---

check(
  !mainJs.includes('console.info(\n          "Install prompt not available'),
  "failure: removed silent console-only fallback on install click",
);
check(
  getInstallHelpMessage({ userAgent: "Mozilla/5.0 Firefox/120" }).includes("limited PWA support"),
  "failure: Firefox gets explicit limited-support message",
);
check(
  mainJs.includes('outcome === "dismissed"'),
  "failure: dismissed native prompt triggers visible help",
);
check(
  mainJs.includes("installPromptEvent = null"),
  "failure: prompt state cleared after use to avoid dead clicks",
);

// --- Contract: index.html → pwa-install.js → main.js ---

check(
  html.includes(`main.js?v=${SW_VERSION}`),
  "contract: index.html main.js version matches SW_VERSION",
);
check(swJs.includes("/src/js/pwa-install.js"), "contract: sw.js caches pwa-install.js");
check(
  cursorrules.includes("beforeinstallprompt") && cursorrules.includes("showInstallHelpToast"),
  "contract: .cursorrules documents PWA install UX rules",
);

// --- Behavioral: showInstallHelpToast ---

function makeToastDom() {
  const byId = new Map();
  const bodyChildren = [];
  const doc = {
    body: {
      appendChild(node) {
        bodyChildren.push(node);
        if (node.id) byId.set(node.id, node);
      },
    },
    getElementById(id) {
      return byId.get(id) ?? null;
    },
    createElement(tag) {
      const el = {
        tag,
        id: "",
        textContent: "",
        dataset: {},
        style: {},
        children: [],
        appendChild(child) {
          el.children.push(child);
        },
        setAttribute() {},
        addEventListener() {},
        remove() {
          const idx = bodyChildren.indexOf(el);
          if (idx >= 0) bodyChildren.splice(idx, 1);
          if (el.id) byId.delete(el.id);
        },
        get isConnected() {
          return bodyChildren.includes(el);
        },
        querySelector(sel) {
          if (sel === "[data-pwa-install-help-text]") {
            return el.children.find((c) => c.dataset?.pwaInstallHelpText === "true") ?? null;
          }
          return null;
        },
        replaceChildren(...nodes) {
          el.children = nodes;
        },
      };
      return el;
    },
    createTextNode(text) {
      return { text };
    },
  };
  const timeouts = [];
  const win = {
    setTimeout(fn, ms) {
      timeouts.push({ fn, ms });
      return timeouts.length;
    },
  };
  return { doc, win, bodyChildren, timeouts };
}

{
  const { doc, win, bodyChildren } = makeToastDom();
  const toast = showInstallHelpToast(doc, win, "Test install help");
  check(toast?.id === "pwa-install-help-toast", "happy: toast created with expected id");
  check(bodyChildren.length === 1, "happy: toast appended to body");
  check(toast.children.some((c) => c.textContent === "OK"), "happy: toast has dismiss button");
}

{
  const { doc, win } = makeToastDom();
  showInstallHelpToast(doc, win, "First message");
  const second = showInstallHelpToast(doc, win, "Updated message");
  check(second !== null, "edge: second call reuses existing toast");
  const label = second.querySelector("[data-pwa-install-help-text]");
  check(label?.children?.[0]?.text === "Updated message", "edge: existing toast text updates");
}

// --- Mutation guards (manual mutation-check stubs) ---

check(
  readStashedInstallPrompt({ __pithDeferredInstallPrompt: null }) === null,
  "mutation: null stash not treated as valid prompt",
);
check(
  !getInstallHelpMessage({ userAgent: "Mozilla/5.0 Firefox/120" }).includes("Add to Home Screen"),
  "mutation: Firefox path must not return iOS instructions",
);
check(
  getInstallHelpMessage({ userAgent: "Mozilla/5.0 (iPhone)" }).includes("Share"),
  "mutation: iOS path must mention Share button",
);

console.log(`\n20260613_pwa-install: ${passed} passed, 0 failed`);
