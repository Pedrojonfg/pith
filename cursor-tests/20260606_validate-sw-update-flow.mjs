/**
 * Validate PWA service worker update flow (structural + behavioral).
 * Run:
 *   node --import ./cursor-tests/register.mjs cursor-tests/20260606_validate-sw-update-flow.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getServiceWorkerUrl,
  initServiceWorkerUpdate,
  shouldNotifyUpdate,
  shouldSkipWaitingOnInstall,
  showUpdateToast,
  SW_VERSION,
} from "../src/js/sw-update.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

// --- Pure logic: shouldNotifyUpdate ---

assert(
  shouldNotifyUpdate("installed", true) === true,
  "shouldNotifyUpdate when installed with active controller",
);
assert(
  shouldNotifyUpdate("installed", false) === false,
  "shouldNotifyUpdate false on first install (no controller)",
);
assert(
  shouldNotifyUpdate("installing", true) === false,
  "shouldNotifyUpdate false while worker is still installing",
);

// --- Pure logic: shouldSkipWaitingOnInstall ---

assert(
  shouldSkipWaitingOnInstall(false) === true,
  "shouldSkipWaitingOnInstall true when no active worker",
);
assert(
  shouldSkipWaitingOnInstall(true) === false,
  "shouldSkipWaitingOnInstall false when an active worker exists",
);
assert(
  shouldSkipWaitingOnInstall(null) === true,
  "shouldSkipWaitingOnInstall true when active worker is null",
);

assert(
  getServiceWorkerUrl() === `/sw.js?v=${SW_VERSION}`,
  "getServiceWorkerUrl includes version query for cache busting",
);

function createMockDocument() {
  const nodes = new Map();

  const makeEl = (tag) => ({
    tagName: tag.toUpperCase(),
    id: "",
    type: "",
    textContent: "",
    style: {},
    children: [],
    listeners: {},
    appendChild(child) {
      this.children.push(child);
      if (child.id) nodes.set(child.id, child);
      return child;
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    click() {
      this.listeners.click?.();
    },
  });

  return {
    nodes,
    body: {
      children: [],
      appendChild(child) {
        this.children.push(child);
        if (child.id) nodes.set(child.id, child);
      },
    },
    getElementById(id) {
      return nodes.get(id) ?? null;
    },
    createElement(tag) {
      return makeEl(tag);
    },
  };
}

// --- showUpdateToast DOM behavior ---

{
  const doc = createMockDocument();
  const toast = showUpdateToast(doc, { location: { reload: () => {} } }, { waiting: { postMessage: () => {} } });
  assert(toast?.id === "sw-update-toast", "showUpdateToast creates sw-update-toast element");
  assert(doc.body.children.length === 1, "showUpdateToast appends toast to body");
}

{
  const doc = createMockDocument();
  showUpdateToast(doc, { location: { reload: () => {} } }, { waiting: null });
  const second = showUpdateToast(doc, { location: { reload: () => {} } }, { waiting: null });
  assert(second === null, "showUpdateToast does not create duplicate toasts");
}

{
  const doc = createMockDocument();
  let posted = null;
  showUpdateToast(
    doc,
    { location: { reload: () => {} } },
    { waiting: { postMessage: (msg) => { posted = msg; } } },
  );
  const toast = doc.body.children[0];
  const btn = toast.children.find((c) => c.tagName === "BUTTON");
  btn.click();
  assert(posted?.type === "SKIP_WAITING", "update button posts SKIP_WAITING to waiting worker");
}

class MockWorker {
  constructor(state = "installing") {
    this.state = state;
    this._listeners = {};
  }

  addEventListener(type, fn) {
    this._listeners[type] = fn;
  }

  setState(next) {
    this.state = next;
    this._listeners.statechange?.();
  }
}

function createTestEnv({ waiting = null, controller = {} } = {}) {
  const updatefoundHandlers = [];
  const controllerchangeHandlers = [];
  const registration = {
    scope: "/",
    waiting,
    installing: null,
    addEventListener(type, fn) {
      if (type === "updatefound") updatefoundHandlers.push(fn);
    },
    update: () => Promise.resolve(),
    triggerUpdateFound(worker) {
      this.installing = worker;
      for (const fn of updatefoundHandlers) fn();
    },
  };

  const navigator = {
    serviceWorker: {
      controller,
      register(url) {
        navigator._registeredUrl = url;
        return Promise.resolve(registration);
      },
      addEventListener(type, fn) {
        if (type === "controllerchange") controllerchangeHandlers.push(fn);
      },
      triggerControllerChange() {
        for (const fn of controllerchangeHandlers) fn();
      },
    },
  };

  const doc = createMockDocument();
  const win = {
    __swRefreshing: false,
    setTimeout(fn) {
      fn();
    },
    setInterval: () => 1,
    clearInterval: () => {},
    location: { reload: () => { win._reloaded = true; } },
  };

  return { navigator, registration, doc, win };
}

// Happy path: registers SW and shows toast for waiting worker.
{
  const env = createTestEnv({ waiting: { postMessage: () => {} }, controller: {} });
  const result = await initServiceWorkerUpdate({
    navigator: env.navigator,
    window: env.win,
    document: env.doc,
    pollIntervalMs: 999999,
  });
  assert(result.registered === true, "initServiceWorkerUpdate registers successfully");
  assert(env.navigator._registeredUrl === getServiceWorkerUrl(), "init registers versioned sw.js URL");
  assert(env.doc.getElementById("sw-update-toast") !== null, "init shows toast when waiting worker exists");
}

// Edge: updatefound + installed notifies user.
{
  const env = createTestEnv({ controller: {} });
  await initServiceWorkerUpdate({
    navigator: env.navigator,
    window: env.win,
    document: env.doc,
    pollIntervalMs: 999999,
  });
  const worker = new MockWorker("installing");
  env.registration.triggerUpdateFound(worker);
  worker.setState("installed");
  assert(env.doc.getElementById("sw-update-toast") !== null, "init shows toast after updatefound installed state");
}

// Failure: controllerchange reload is guarded against loops.
{
  const env = createTestEnv({ controller: {} });
  await initServiceWorkerUpdate({
    navigator: env.navigator,
    window: env.win,
    document: env.doc,
    pollIntervalMs: 999999,
  });
  env.navigator.serviceWorker.triggerControllerChange();
  env.navigator.serviceWorker.triggerControllerChange();
  assert(env.win._reloaded === true, "controllerchange triggers reload");
  assert(env.win.__swRefreshing === true, "controllerchange sets refresh guard");
}

// Failure: unsupported environment returns gracefully.
{
  const result = await initServiceWorkerUpdate({ navigator: {} });
  assert(result.registered === false, "init returns registered:false when SW unsupported");
  assert(result.reason === "unsupported", "init reports unsupported reason");
}

// --- Structural checks on sw.js and index.html ---

const sw = await readFile(join(root, "sw.js"), "utf8");
const html = await readFile(join(root, "index.html"), "utf8");

assert(sw.includes('if (type === "SKIP_WAITING")'), "sw.js accepts SKIP_WAITING command");
assert(sw.includes("if (!self.registration.active)"), "sw.js only skipWaiting on first install");
assert(!sw.match(/self\.skipWaiting\(\);\s*\n\}\);/), "sw.js does not unconditionally skipWaiting in install");

assert(html.includes("initServiceWorkerUpdate"), "index.html bootstraps sw-update module");
assert(html.includes("sw-update.js"), "index.html imports sw-update.js");
assert(!html.includes("Nueva version disponible."), "index.html no longer inlines old toast markup");

assert(!html.includes("localStorage.clear("), "index.html does not clear full localStorage");
assert(!sw.includes("localStorage.clear("), "sw.js does not clear full localStorage");
assert(!html.includes('removeItem("ds_api_key")'), "index.html does not remove DeepSeek key");

console.log(`\nValidate SW update flow: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
