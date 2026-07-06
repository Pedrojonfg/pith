/**
 * T04 — upsertSmItem routes through session persist (contract)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260706_t04-sm2-retry-path.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sessionStoreSrc = readFileSync(path.join(root, "src/js/session-store.js"), "utf8");

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

assert(sessionStoreSrc.includes("withKeyedRetry"), "session-store imports keyed retry");
assert(
  /async function upsertSessionInStore[\s\S]*withKeyedRetry/.test(sessionStoreSrc),
  "upsertSessionInStore uses withKeyedRetry",
);
assert(
  /export async function upsertSmItem[\s\S]*await saveActiveSession/.test(sessionStoreSrc),
  "upsertSmItem persists via saveActiveSession",
);
assert(
  /export async function saveActiveSession[\s\S]*await upsertSessionInStore/.test(sessionStoreSrc),
  "saveActiveSession calls upsertSessionInStore",
);

console.log(`\n20260706_t04-sm2-retry-path: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
