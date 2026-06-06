/**
 * T15 — migration + anti-spoiler slice
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t15-slow-qa.mjs
 */
import { LS_ACTIVE_SESSION_KEY, LS_SESSIONS_BY_MODE_KEY } from "../src/js/config.js";
import { migrateLegacyActiveSession, loadSessionsByMode } from "../src/js/session.js";
import { buildIAContext } from "../src/js/slow/ai-context.js";

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

localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify({ studyMode: "rsvp", n_blocks: 1 }));
migrateLegacyActiveSession();
assert(loadSessionsByMode().rsvp?.n_blocks === 1, "T15: migration idempotent");

const scopeText = "ABCDEFGHIJ";
const slow = {
  normalizedTextFull: scopeText,
  readingScope: { charStart: 0, charEnd: scopeText.length, label: "full" },
  maxReadCharEnd: 4,
};
const ctx = buildIAContext(slow);
assert(ctx === "ABCD", "T15: anti-spoiler slice excludes unread tail");
assert(!ctx.includes("E"), "T15: unread char E not in IA context");

console.log(`\n20260528_t15-slow-qa: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
