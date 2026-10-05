import { deError, deInfo, deLog, deWarn } from "../debug-enrich.js";
/** Generic retry-with-backoff for transient Supabase/network failures. */

export const RETRY_DELAYS_MS = [500, 1500, 4000];

const TRANSIENT_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const NON_RETRY_HTTP_STATUSES = new Set([400, 401, 403, 422]);

/**
 * @param {unknown} err
 * @returns {number|undefined}
 */
function httpStatusFromError(err) {
  if (!err || typeof err !== "object") return undefined;
  const rec = /** @type {Record<string, unknown>} */ (err);
  if (typeof rec.status === "number") return rec.status;
  if (typeof rec.statusCode === "number") return rec.statusCode;
  return undefined;
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTransientError(err) {
  if (err instanceof WriteSupersededError) return false;
  const status = httpStatusFromError(err);
  if (typeof status === "number") {
    if (NON_RETRY_HTTP_STATUSES.has(status)) return false;
    return TRANSIENT_HTTP_STATUSES.has(status);
  }
  if (err instanceof TypeError) return true;
  const msg = String(/** @type {{ message?: string }} */ (err)?.message || err || "");
  if (/failed to fetch/i.test(msg)) return true;
  if (/networkerror/i.test(msg)) return true;
  return false;
}

/**
 * @param {number} ms
 * @returns {number}
 */
export function jitterDelay(ms) {
  const factor = 0.8 + Math.random() * 0.4;
  return Math.round(ms * factor);
}

/**
 * @param {() => Promise<unknown>} fn
 * @param {{ maxAttempts?: number, delays?: number[], onExhausted?: (err: unknown) => void }} [options]
 * @returns {Promise<unknown>}
 */
export async function withRetry(fn, options = {}) {
  const maxRetries = options.maxAttempts ?? 3;
  const delays = options.delays ?? RETRY_DELAYS_MS;
  let lastErr;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await fn();
      if (attempt > 0) {
        deInfo('[net.retry.withRetry] Succeeded after retry:', {
          attempt,
          maxRetries,
        });
      }
      return result;
    } catch (err) {
      lastErr = err;
      const transient = isTransientError(err);
      deLog('[net.retry.withRetry] Attempt failed:', {
        attempt,
        maxRetries,
        transient,
        message: err?.message ?? String(err),
        status: httpStatusFromError(err) ?? null,
      });
      if (!transient || attempt >= maxRetries) break;
      const delay = delays[Math.min(attempt, delays.length - 1)] ?? delays[delays.length - 1];
      const waitMs = jitterDelay(delay);
      deWarn('[net.retry.withRetry] Backing off:', {
        attempt,
        waitMs,
      });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  if (lastErr instanceof WriteSupersededError) throw lastErr;

  if (options.onExhausted) options.onExhausted(lastErr);
  else console.warn("[withRetry] exhausted", lastErr);
  deError('[net.retry.withRetry] Exhausted retries:', {
    maxRetries,
    message: lastErr?.message ?? String(lastErr),
    status: httpStatusFromError(lastErr) ?? null,
  });
  throw lastErr;
}

export class WriteSupersededError extends Error {
  constructor(key) {
    super(`write superseded: ${key}`);
    this.name = "WriteSupersededError";
  }
}

/** @type {Map<string, number>} per-key write counter (for getWriteGeneration) */
const writeGenerations = new Map();

/**
 * Active write owner per key. Object identity — not the numeric generation —
 * is the supersession signal, so a mid-flight map clear cannot make a stale
 * writer look current again when a newer write reclaims the same generation
 * number.
 * @type {Map<string, { gen: number }>}
 */
const writeOwners = new Map();

/**
 * @param {string} key
 * @returns {number}
 */
export function getWriteGeneration(key) {
  return writeGenerations.get(key) || 0;
}

/**
 * @param {string} key
 * @param {() => Promise<unknown>} fn
 * @param {Parameters<typeof withRetry>[1]} [options]
 * @returns {Promise<unknown|undefined>}
 */
export function withKeyedRetry(key, fn, options = {}) {
  const nextGen = getWriteGeneration(key) + 1;
  writeGenerations.set(key, nextGen);
  const myGen = nextGen;
  const owner = { gen: myGen };
  writeOwners.set(key, owner);
  deLog('[net.retry.withKeyedRetry] Start:', { key, generation: myGen });

  return withRetry(async () => {
    if (writeOwners.get(key) !== owner) {
      deInfo('[net.retry.withKeyedRetry] Superseded before write:', {
        key,
        myGen,
        currentGen: writeGenerations.get(key),
      });
      throw new WriteSupersededError(key);
    }
    const result = await fn();
    if (writeOwners.get(key) !== owner) {
      deInfo('[net.retry.withKeyedRetry] Superseded after write:', {
        key,
        myGen,
        currentGen: writeGenerations.get(key),
      });
      throw new WriteSupersededError(key);
    }
    return result;
  }, options).catch((err) => {
    if (err instanceof WriteSupersededError) {
      deLog('[net.retry.withKeyedRetry] Dropping superseded write (silent):', {
        key,
        myGen,
      });
      return undefined;
    }
    deError('[net.retry.withKeyedRetry] Failed:', {
      key,
      myGen,
      message: err?.message ?? String(err),
    });
    throw err;
  });
}

/** @internal test helper */
export function resetKeyedRetryState() {
  writeGenerations.clear();
  writeOwners.clear();
}
