/**
 * T06 — keyed supersession (R7)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260706_t06-keyed-supersession.mjs
 */
import {
  resetKeyedRetryState,
  withKeyedRetry,
} from "../src/js/net/retry.js";

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

function makeHttpError(status) {
  const err = new Error(`http ${status}`);
  err.status = status;
  return err;
}

resetKeyedRetryState();

// Older write superseded by newer — stale retry must not win
let firstAttempts = 0;
let secondValue = null;

const first = withKeyedRetry("session:doc1", async () => {
  firstAttempts += 1;
  if (firstAttempts === 1) throw makeHttpError(503);
  return "stale";
}, { maxAttempts: 3, delays: [30, 30, 30] });

const second = withKeyedRetry("session:doc1", async () => {
  secondValue = "fresh";
  return "fresh";
}, { maxAttempts: 0, delays: [1] });

const [r1, r2] = await Promise.all([first, second]);
assert(r2 === "fresh", "newer write succeeds");
assert(secondValue === "fresh", "newer value recorded");
assert(r1 === undefined, "superseded first write resolves undefined");
assert(firstAttempts <= 2, "stale write stops retrying after supersession");

// Independent keys do not interfere
resetKeyedRetryState();
const a = await withKeyedRetry("session:a", async () => "a");
const b = await withKeyedRetry("session:b", async () => "b");
assert(a === "a" && b === "b", "independent keys");

console.log(`\n20260706_t06-keyed-supersession: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
