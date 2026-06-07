/**
 * T01 — sessionsByMode.cloze slot
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260529_t01-cloze-sessions.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  emptySessionsByMode,
  loadSessionForMode,
  loadSessionsByMode,
  migrateLegacyActiveSession,
  normalizeStudyMode,
  storeSessionForMode,
  storeSessionsByMode,
} from "../src/js/session.js";

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

resetStorage();

assert(normalizeStudyMode("rsvp") === "rsvp", "T01: rsvp unchanged");
assert(normalizeStudyMode("slow") === "slow", "T01: slow unchanged");
assert(normalizeStudyMode("cloze") === "cloze", "T01: cloze recognized");
assert(normalizeStudyMode("CLOZE") === "rsvp", "T01: case-sensitive cloze");
assert(normalizeStudyMode("") === "rsvp", "T01: empty defaults to rsvp");

const empty = emptySessionsByMode();
assert(empty.rsvp === null && empty.slow === null && empty.cloze === null, "T01: empty has three slots");

const rsvpSession = { studyMode: "rsvp", blocks: [{ id: "b1" }] };
const slowSession = { studyMode: "slow", slow: { phase: "scope" } };
const clozeSession = { studyMode: "cloze", cloze: { pipelineStatus: "normalized" } };

storeSessionsByMode({ rsvp: rsvpSession, slow: slowSession, cloze: clozeSession });
const loaded = loadSessionsByMode();
assert(loaded.rsvp?.studyMode === "rsvp", "T01: rsvp round-trip");
assert(loaded.slow?.studyMode === "slow", "T01: slow round-trip");
assert(loaded.cloze?.studyMode === "cloze", "T01: cloze round-trip");
assert(loaded.cloze?.cloze?.pipelineStatus === "normalized", "T01: cloze payload preserved");

assert(loadSessionForMode("cloze")?.studyMode === "cloze", "T01: loadSessionForMode cloze");
assert(loadSessionForMode("rsvp")?.blocks?.length === 1, "T01: loadSessionForMode rsvp");

storeSessionForMode("cloze", { studyMode: "cloze", cloze: { pipelineStatus: "ready" } });
assert(loadSessionForMode("cloze")?.cloze?.pipelineStatus === "ready", "T01: storeSessionForMode cloze");
assert(loadSessionForMode("rsvp")?.blocks?.length === 1, "T01: storeSessionForMode does not touch rsvp");

resetStorage();
localStorage.setItem("sessions_by_mode", JSON.stringify({ rsvp: rsvpSession, slow: null }));
migrateLegacyActiveSession();
const migrated = loadSessionsByMode();
assert(migrated.rsvp?.studyMode === "rsvp", "T01: migration keeps rsvp");
assert(migrated.cloze === null, "T01: missing cloze migrates to null");

console.log(`\nT01 cloze sessions: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
