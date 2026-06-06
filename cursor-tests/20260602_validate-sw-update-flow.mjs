/**
 * Legacy entry — redirects structural checks to sw-update.js module.
 * Prefer: node cursor-tests/20260606_validate-sw-update-flow.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const sw = await readFile(join(root, "sw.js"), "utf8");
const html = await readFile(join(root, "index.html"), "utf8");
const swUpdate = await readFile(join(root, "src/js/sw-update.js"), "utf8");

assert(sw.includes('self.addEventListener("message"'), "sw.js listens for message events");
assert(sw.includes('if (type === "SKIP_WAITING")'), "sw.js accepts SKIP_WAITING command");
assert(sw.includes("if (!self.registration.active)"), "sw.js skipWaiting only on first install");

assert(swUpdate.includes("if (registration.waiting)"), "sw-update.js checks waiting worker presence");
assert(swUpdate.includes('postMessage({ type: "SKIP_WAITING" })'), "update button posts SKIP_WAITING");
assert(swUpdate.includes("window.location.reload()"), "sw-update.js has direct reload fallback");
assert(swUpdate.includes("if (!win.__swRefreshing)"), "controllerchange reload is guarded");

assert(html.includes("initServiceWorkerUpdate"), "index.html bootstraps sw-update module");
assert(!html.includes("localStorage.clear("), "index.html does not clear full localStorage");
assert(!sw.includes("localStorage.clear("), "sw.js does not clear full localStorage");

console.log(`\nValidate SW update flow (legacy): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
