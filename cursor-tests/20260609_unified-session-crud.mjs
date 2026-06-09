/**
 * T01 — DocumentSession CRUD
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-crud.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_ACTIVE_DOC_ID_KEY,
  LS_DOC_SESSIONS_KEY,
  LS_DOC_TEXT_PREFIX,
} from "../src/js/config.js";
import {
  addAnnotationToShared,
  addConceptsToShared,
  computeDocId,
  createSession,
  deleteSession,
  getActiveSession,
  getAllSessions,
  getSession,
  getSmItemsDueToday,
  saveActiveSession,
  setActiveSession,
  upsertSmItem,
  validateDocumentSession,
} from "../src/js/session-store.js";
import { computeCanonicalId } from "../src/js/session-types.js";

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

// Happy path: createSession
const markdown = "# Test Paper\n\nSome philosophical therefore argument.";
const session = await createSession(markdown);
assert(session.schemaVersion === 2, "create: schemaVersion 2");
assert(session.docId && session.docId.length === 12, "create: docId 12 hex");
assert(session.shared.rawMarkdown === markdown, "create: rawMarkdown stored");
assert(session.shared.docMeta.titleInferred.includes("Test Paper"), "create: title inferred");
assert(session.modes.rsvp === null && session.modes.slow === null, "create: empty mode slices");

const v = validateDocumentSession(session);
assert(v.ok, `create: validate ok (${v.errors.join(", ")})`);

// Edge: same markdown → same docId
const docId2 = await computeDocId(markdown);
assert(docId2 === session.docId, "computeDocId: deterministic");

// Failure: invalid session rejected
const bad = { schemaVersion: 1, docId: "" };
const badV = validateDocumentSession(bad);
assert(!badV.ok, "validate: rejects incomplete");

// CRUD round-trip
setActiveSession(session.docId);
assert(getActiveSession()?.docId === session.docId, "setActiveSession + getActiveSession");

session.modes.rsvp = { studyMode: "rsvp", n_blocks: 2, blocks: [] };
saveActiveSession(session);
const loaded = getSession(session.docId);
assert(loaded.modes.rsvp?.n_blocks === 2, "saveActiveSession persists mode slice");

const all = getAllSessions();
assert(all.length === 1 && all[0].docId === session.docId, "getAllSessions");

// Shared helpers
addConceptsToShared(session.docId, [
  { term: "Episteme", definition: "Knowledge", detectedBy: "slow" },
  { label: "episteme", definition: "Longer knowledge definition", detectedBy: "cloze" },
]);
const withConcepts = getSession(session.docId);
assert(withConcepts.shared.conceptInventory.length === 1, "addConceptsToShared dedup");
assert(
  withConcepts.shared.conceptInventory[0].definition.includes("Longer"),
  "addConceptsToShared keeps longer definition",
);

addAnnotationToShared(session.docId, {
  id: "a1",
  type: "★",
  text: "important",
  offset: 10,
});
assert(getSession(session.docId).shared.annotations.length === 1, "addAnnotationToShared");

const tomorrow = Date.now() + 86400000 * 2;
upsertSmItem(session.docId, {
  id: "sm1",
  sourceMode: "cloze",
  question: "Q?",
  answer: "A",
  easeFactor: 2.5,
  interval: 1,
  nextReview: Date.now() - 1000,
  reviewCount: 0,
});
upsertSmItem(session.docId, {
  id: "sm2",
  sourceMode: "rsvp",
  question: "Q2?",
  answer: "A2",
  easeFactor: 2.5,
  interval: 1,
  nextReview: tomorrow,
  reviewCount: 0,
});
const due = getSmItemsDueToday(session.docId);
assert(due.length === 1 && due[0].id === "sm1", "getSmItemsDueToday filters");

// Externalization >400KB
resetStorage();
const bigText = "x".repeat(450 * 1024);
const bigSession = await createSession(bigText);
const rawStored = JSON.parse(localStorage.getItem(LS_DOC_SESSIONS_KEY));
const persisted = rawStored.find((s) => s.docId === bigSession.docId);
assert(!persisted.shared.rawMarkdown, "externalize: rawMarkdown omitted from main payload");
assert(persisted.shared.rawMarkdownRef?.storageKey, "externalize: ref present");
const extKey = `${LS_DOC_TEXT_PREFIX}${bigSession.docId}`;
assert(localStorage.getItem(extKey)?.length === bigText.length, "externalize: text in separate key");
const rehydrated = getSession(bigSession.docId);
assert(rehydrated.shared.rawMarkdown.length === bigText.length, "externalize: rehydrate on read");

// deleteSession cleans external key
deleteSession(bigSession.docId);
assert(!localStorage.getItem(extKey), "deleteSession removes externalized text");
assert(getSession(bigSession.docId) === null, "deleteSession removes session");

// setActiveSession unknown throws
let threw = false;
try {
  setActiveSession("nonexistent");
} catch (e) {
  threw = e.message.includes("not found");
}
assert(threw, "setActiveSession throws for unknown docId");

assert(computeCanonicalId("  The Episteme  ") === computeCanonicalId("episteme"), "canonicalId normalizes");

console.log(`\nT01 unified-session CRUD: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
