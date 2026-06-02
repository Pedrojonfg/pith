/**
 * Validate SW update UX for non-technical users.
 * Run:
 * node --import ./cursor-tests/register.mjs cursor-tests/20260602_validate-sw-update-flow.mjs
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

// Happy path: new SW can be activated immediately by the UI action.
assert(sw.includes('self.addEventListener("message"'), "sw.js listens for message events");
assert(sw.includes('if (type === "SKIP_WAITING")'), "sw.js accepts SKIP_WAITING command");
assert(sw.includes("self.skipWaiting();"), "sw.js triggers immediate activation");

// Edge case: update flow handles existing waiting worker and fallback reload.
assert(html.includes("if (reg.waiting)"), "index.html checks waiting worker presence");
assert(html.includes("reg.waiting.postMessage({ type: \"SKIP_WAITING\" });"), "update button posts SKIP_WAITING");
assert(html.includes("reloadFromUpdate();"), "index.html has direct reload fallback");

// Failure case: avoid accidental key wipe during update path.
assert(!html.includes("localStorage.clear("), "index.html does not clear full localStorage");
assert(!sw.includes("localStorage.clear("), "sw.js does not clear full localStorage");
assert(!html.includes('removeItem("ds_api_key")'), "index.html does not remove DeepSeek key");
assert(!sw.includes('removeItem("ds_api_key")'), "sw.js does not remove DeepSeek key");

// Regression guard: prevent infinite reload loops on controller change.
assert(html.includes("if (!window.__swRefreshing)"), "controllerchange reload is guarded");

console.log(`\nValidate SW update flow: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
