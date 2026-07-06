/**
 * T01 — withRetry unit tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260706_t01-with-retry.mjs
 */
import {
  RETRY_DELAYS_MS,
  isTransientError,
  jitterDelay,
  withRetry,
  WriteSupersededError,
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

// --- isTransientError ---
assert(isTransientError(new TypeError("Failed to fetch")), "network TypeError is transient");
assert(isTransientError(makeHttpError(503)), "503 is transient");
assert(isTransientError(makeHttpError(429)), "429 is transient");
assert(!isTransientError(makeHttpError(401)), "401 not retried");
assert(!isTransientError(makeHttpError(403)), "403 not retried");
assert(!isTransientError(makeHttpError(400)), "400 not retried");
assert(!isTransientError(makeHttpError(422)), "422 not retried");
assert(!isTransientError(new WriteSupersededError("k")), "superseded not retried");

// --- jitter bounds ---
for (let i = 0; i < 20; i += 1) {
  const j = jitterDelay(1000);
  assert(j >= 800 && j <= 1200, `jitter within ±20% got ${j}`);
}

// --- happy path: no delay on first success ---
const t0 = Date.now();
await withRetry(async () => "ok", { maxAttempts: 0, delays: [5000] });
assert(Date.now() - t0 < 200, "happy path returns immediately");

// --- retries then succeeds ---
let attempts = 0;
const result = await withRetry(
  async () => {
    attempts += 1;
    if (attempts < 3) throw makeHttpError(503);
    return "recovered";
  },
  { maxAttempts: 3, delays: [1, 1, 1] },
);
assert(result === "recovered" && attempts === 3, "retries transient then succeeds");

// --- exhausts after maxAttempts ---
let failCount = 0;
let exhausted = false;
try {
  await withRetry(
    async () => {
      failCount += 1;
      throw makeHttpError(500);
    },
    {
      maxAttempts: 3,
      delays: [1, 1, 1],
      onExhausted: () => {
        exhausted = true;
      },
    },
  );
} catch (err) {
  assert(err.status === 500, "rejects with last error");
}
assert(failCount === 4, "4 total attempts (1 + 3 retries)");
assert(exhausted, "onExhausted called");

// --- non-transient rejects immediately ---
let authAttempts = 0;
try {
  await withRetry(
    async () => {
      authAttempts += 1;
      throw makeHttpError(401);
    },
    { maxAttempts: 3, delays: [1, 1, 1] },
  );
} catch {
  // expected
}
assert(authAttempts === 1, "401 does not retry");

assert(RETRY_DELAYS_MS.length === 3, "default delay schedule length");

console.log(`\n20260706_t01-with-retry: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
