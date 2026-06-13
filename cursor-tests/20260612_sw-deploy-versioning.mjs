/**
 * PWA deploy versioning — sync SW_VERSION, index.html ?v=, CACHE_NAME bump.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260612_sw-deploy-versioning.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SW_VERSION,
  getServiceWorkerUrl,
  initServiceWorkerUpdate,
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

const [html, sw, swUpdate, cursorrules] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "sw.js"), "utf8"),
  readFile(join(root, "src/js/sw-update.js"), "utf8"),
  readFile(join(root, ".cursorrules"), "utf8"),
]);

// --- Happy path: version sync ---

assert(SW_VERSION.length > 0, "happy: SW_VERSION is exported and non-empty");
assert(
  getServiceWorkerUrl() === `/sw.js?v=${SW_VERSION}`,
  "happy: getServiceWorkerUrl embeds SW_VERSION",
);
assert(
  html.includes(`sw-update.js?v=${SW_VERSION}`),
  "happy: index.html sw-update import matches SW_VERSION",
);
assert(
  html.includes(`main.js?v=${SW_VERSION}`),
  "happy: index.html main.js import matches SW_VERSION",
);
const cacheMatch = sw.match(/const CACHE_NAME = "(pith-v\d+)"/);
assert(cacheMatch, "happy: CACHE_NAME present in sw.js");
assert(
  sw.includes(`const CACHE_NAME = "${cacheMatch[1]}"`),
  `happy: CACHE_NAME is ${cacheMatch[1]}`,
);
assert(sw.includes("/src/js/pwa-install.js"), "happy: pwa-install.js listed in STATIC_ASSETS");

// --- Edge: stale mismatched ?v= would fail (guard against regression) ---

assert(
  !html.includes("sw-update.js?v=20260607_1"),
  "edge: stale sw-update.js cache-bust removed from index.html",
);
assert(
  !html.includes('main.js?v=20260611_2') || SW_VERSION === "20260611_2",
  "edge: main.js ?v= not left behind SW_VERSION",
);

// --- Failure cases: forbidden update flows ---

assert(!html.includes("localStorage.clear("), "failure-guard: index.html never clears localStorage");
assert(!sw.includes("localStorage.clear("), "failure-guard: sw.js never clears localStorage");
assert(!html.includes('removeItem("ds_api_key")'), "failure-guard: API key not removed on update");

// --- Contract: index.html consumer ---

assert(html.includes("initServiceWorkerUpdate"), "contract: index.html bootstraps SW update init");
assert(html.includes('window.addEventListener("load"'), "contract: init runs after load");

// --- Contract: .cursorrules documents mandatory bump ---

assert(cursorrules.includes("SW_VERSION"), "contract: .cursorrules documents SW_VERSION rule");
assert(cursorrules.includes("CACHE_NAME"), "contract: .cursorrules documents CACHE_NAME rule");

// --- Behavioral: visibilitychange triggers update when tab visible ---

function createVisibilityEnv(visibilityState = "visible") {
  let updateCalls = 0;
  const registration = {
    waiting: null,
    installing: null,
    addEventListener() {},
    update: () => {
      updateCalls += 1;
      return Promise.resolve();
    },
  };
  const doc = {
    visibilityState,
    addEventListener(type, fn) {
      if (type === "visibilitychange") doc._onVisible = fn;
    },
    removeEventListener(type, fn) {
      if (type === "visibilitychange" && doc._onVisible === fn) doc._onVisible = null;
    },
  };
  const win = {
    __swRefreshing: false,
    setTimeout(fn) {
      fn();
    },
    setInterval: () => 1,
    clearInterval: () => {},
    location: { reload: () => {} },
  };
  const navigator = {
    serviceWorker: {
      controller: {},
      register() {
        return Promise.resolve(registration);
      },
      addEventListener() {},
    },
  };
  return { doc, win, navigator, getUpdateCalls: () => updateCalls };
}

{
  const env = createVisibilityEnv("visible");
  await initServiceWorkerUpdate({
    navigator: env.navigator,
    window: env.win,
    document: env.doc,
    pollIntervalMs: 999999,
  });
  env.doc._onVisible?.();
  assert(env.getUpdateCalls() >= 2, "happy: visibilitychange visible calls registration.update()");
}

{
  const env = createVisibilityEnv("hidden");
  const before = env.getUpdateCalls();
  await initServiceWorkerUpdate({
    navigator: env.navigator,
    window: env.win,
    document: env.doc,
    pollIntervalMs: 999999,
  });
  const callsAfterInit = env.getUpdateCalls();
  env.doc._onVisible?.();
  assert(
    env.getUpdateCalls() === callsAfterInit,
    "edge: visibilitychange hidden does not call registration.update()",
  );
}

// --- Structural: faster poll + toast z-index ---

assert(swUpdate.includes("5 * 60 * 1000"), "happy: poll interval is 5 minutes");
assert(swUpdate.includes('zIndex = "4000"'), "happy: update toast above modal layer");

console.log(`\n20260612_sw-deploy-versioning: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
