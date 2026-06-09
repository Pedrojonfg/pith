/**
 * T02 — V1 → V2 migration
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-migration.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSIONS_BY_MODE_KEY,
  LS_V1_BACKUP_KEY,
  LS_DOC_SESSIONS_KEY,
} from "../src/js/config.js";
import { detectAndMigrateV1 } from "../src/js/session-migration.js";
import { getActiveSession, getAllSessions } from "../src/js/session-store.js";

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

// Empty V1 → no-op
resetStorage();
await detectAndMigrateV1();
assert(getAllSessions().length === 0, "empty V1: no sessions created");
assert(localStorage.getItem(LS_V1_BACKUP_KEY) === null, "empty V1: no backup");

// slow-only V1 → v2 with annotations + slow slice
resetStorage();
const slowV1 = {
  studyMode: "slow",
  slow: {
    normalizedTextFull: "# Legacy Paper\n\nTherefore we argue.",
    annotations: [
      { id: "ann1", type: "★", charStart: 5, charEnd: 10, userText: "note", createdAt: 1 },
    ],
    phase0: {
      conceptsToFind: [{ term: "Argument", authorUsage: "Core claim" }],
    },
    graphEnrichedUnlocked: false,
  },
};
localStorage.setItem(
  LS_SESSIONS_BY_MODE_KEY,
  JSON.stringify({ rsvp: null, slow: slowV1, cloze: null, questions: null }),
);
await detectAndMigrateV1();

const sessions = getAllSessions();
assert(sessions.length === 1, "slow-only: one DocumentSession");
const doc = sessions[0];
assert(doc.schemaVersion === 2, "slow-only: schemaVersion 2");
assert(doc.modes.slow?.studyMode === "slow", "slow-only: slow slice intact");
assert(doc.shared.annotations.length === 1, "slow-only: annotations in shared");
assert(doc.shared.conceptInventory.length === 1, "slow-only: concepts in shared");
assert(localStorage.getItem(LS_V1_BACKUP_KEY), "slow-only: backup written");
assert(!localStorage.getItem(LS_SESSIONS_BY_MODE_KEY), "slow-only: V1 key removed");
assert(getActiveSession()?.docId === doc.docId, "slow-only: active doc set");

// Idempotent second run
const before = JSON.stringify(getAllSessions());
await detectAndMigrateV1();
assert(JSON.stringify(getAllSessions()) === before, "idempotent: second run unchanged");

// Corrupt JSON → no crash, V1 preserved if migration fails validation
resetStorage();
localStorage.setItem(LS_SESSIONS_BY_MODE_KEY, "{not json");
let crashed = false;
try {
  await detectAndMigrateV1();
} catch {
  crashed = true;
}
assert(!crashed, "corrupt JSON: no throw");
assert(localStorage.getItem(LS_SESSIONS_BY_MODE_KEY) === "{not json", "corrupt: V1 kept");

// Multi-slot V1 → single DocumentSession
resetStorage();
const rsvp = { studyMode: "rsvp", n_blocks: 2, blocks: [{ title: "B1" }] };
const slow = {
  studyMode: "slow",
  slow: { normalizedTextFull: "Shared text for all modes." },
};
localStorage.setItem(
  LS_SESSIONS_BY_MODE_KEY,
  JSON.stringify({ rsvp, slow, cloze: null, questions: null }),
);
await detectAndMigrateV1();
assert(getAllSessions().length === 1, "multi-slot: single doc");
const multi = getAllSessions()[0];
assert(multi.modes.rsvp?.n_blocks === 2, "multi-slot: rsvp preserved");
assert(multi.modes.slow?.studyMode === "slow", "multi-slot: slow preserved");
assert(multi.shared.rawMarkdown.includes("Shared text"), "multi-slot: markdown from slow");

console.log(`\nT02 unified-session migration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
