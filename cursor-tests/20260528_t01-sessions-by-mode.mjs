/**
 * T01 — sessionsByMode + legacy migration
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t01-sessions-by-mode.mjs
 */
import {
  LS_ACTIVE_SESSION_KEY,
  LS_SESSIONS_BY_MODE_KEY,
} from "../src/js/config.js";
import {
  emptySessionsByMode,
  loadActiveSession,
  loadSessionForMode,
  loadSessionsByMode,
  migrateLegacyActiveSession,
  storeActiveSession,
  storeSessionForMode,
} from "../src/js/session.js";
import { state } from "../src/js/session.js";

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

function resetStorage() {
  localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
  localStorage.removeItem(LS_ACTIVE_SESSION_KEY);
  state.studyMode = null;
}

// --- Happy: migrate legacy active_session to rsvp slot ---
resetStorage();
const legacyRsvp = { n_blocks: 3, blocks_list_text: "1. Intro", studyMode: "rsvp" };
localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify(legacyRsvp));
migrateLegacyActiveSession();
const afterMigrate = loadSessionsByMode();
assert(afterMigrate.rsvp?.n_blocks === 3, "T01: legacy migrates to rsvp slot");
assert(afterMigrate.slow === null, "T01: slow slot null after migration");
assert(loadSessionForMode("rsvp")?.n_blocks === 3, "T01: loadSessionForMode rsvp works post-migrate");

// --- Happy: store slow does not touch rsvp ---
resetStorage();
storeSessionForMode("rsvp", { studyMode: "rsvp", n_blocks: 2, label: "rsvp-only" });
storeSessionForMode("slow", { studyMode: "slow", slow: { phase: "scope" }, label: "slow-only" });
const dual = loadSessionsByMode();
assert(dual.rsvp?.label === "rsvp-only", "T01: rsvp slot preserved when slow saved");
assert(dual.slow?.slow?.phase === "scope", "T01: slow slot stores slow session");
assert(dual.rsvp?.slow == null, "T01: rsvp slot has no slow sub-object pollution");

// --- Edge: storeActiveSession defaults studyMode to rsvp ---
resetStorage();
state.studyMode = null;
storeActiveSession({ n_blocks: 1, blocks_list_text: "1. A" });
assert(loadSessionForMode("rsvp")?.n_blocks === 1, "T01: storeActiveSession defaults to rsvp");
assert(loadSessionForMode("slow") === null, "T01: slow untouched by rsvp store");

// --- Edge: storeActiveSession uses session.studyMode ---
resetStorage();
storeActiveSession({ studyMode: "slow", slow: { phase: "phase1" } });
assert(loadSessionForMode("slow")?.slow?.phase === "phase1", "T01: storeActiveSession writes slow slot");
assert(loadSessionForMode("rsvp") === null, "T01: rsvp null when only slow stored");

// --- Failure: corrupt legacy does not crash ---
resetStorage();
localStorage.setItem(LS_ACTIVE_SESSION_KEY, "{not-json");
migrateLegacyActiveSession();
assert(loadSessionsByMode().rsvp === null, "T01: corrupt legacy leaves empty rsvp");

// --- emptySessionsByMode shape ---
const empty = emptySessionsByMode();
assert(empty.rsvp === null && empty.slow === null, "T01: emptySessionsByMode shape");

// --- loadActiveSession respects state.studyMode ---
resetStorage();
storeSessionForMode("rsvp", { studyMode: "rsvp", tag: "r" });
storeSessionForMode("slow", { studyMode: "slow", tag: "s" });
state.studyMode = "slow";
assert(loadActiveSession()?.tag === "s", "T01: loadActiveSession uses state.studyMode slow");
state.studyMode = "rsvp";
assert(loadActiveSession()?.tag === "r", "T01: loadActiveSession uses state.studyMode rsvp");

console.log(`\n20260528_t01-sessions-by-mode: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
