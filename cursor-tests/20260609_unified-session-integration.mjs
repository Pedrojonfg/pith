/**
 * T09 — Unified session integration
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSIONS_BY_MODE_KEY,
  LS_V1_BACKUP_KEY,
} from "../src/js/config.js";
import { detectAndMigrateV1 } from "../src/js/session-migration.js";
import {
  computeDocId,
  createSession,
  getActiveSession,
  getSession,
  getSmItemsDueToday,
  saveActiveSession,
  setActiveSession,
} from "../src/js/session-store.js";
import {
  loadSessionForMode,
} from "../src/js/session.js";
import { epistemicGraphFromShared } from "../src/js/cloze/pipeline.js";
import { buildClozeEpistemicGraph } from "../src/js/graph/build.js";

async function ensureDocumentSessionForUpload(markdown) {
  const text = String(markdown || "");
  const docId = await computeDocId(text);
  let doc = getSession(docId);
  if (!doc) doc = await createSession(text, { docId });
  setActiveSession(docId);
  return doc;
}

function persistModeSliceToDocument(doc, mode, slice) {
  doc.modes[mode] = slice;
  saveActiveSession(doc);
}

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

// Multi-mode upload preserves slices
resetStorage();
const md = "# Integration Paper\n\nTherefore knowledge matters.";
const doc = await ensureDocumentSessionForUpload(md);
const rsvp = { studyMode: "rsvp", n_blocks: 2, blocks: [{ title: "B1", explanation: "x", questions: [] }] };
persistModeSliceToDocument(doc, "rsvp", rsvp);
const doc2 = getSession(doc.docId);
assert(doc2.modes.rsvp?.n_blocks === 2, "multi-mode: rsvp slice saved");

const slow = { studyMode: "slow", slow: { normalizedTextFull: md, phase: "scope" } };
persistModeSliceToDocument(doc2, "slow", slow);
setActiveSession(doc.docId);
assert(loadSessionForMode("rsvp")?.n_blocks === 2, "mode switch: rsvp intact after slow add");

// Re-upload same doc recovers session
resetStorage();
await createSession(md);
const docId = await computeDocId(md);
const again = await ensureDocumentSessionForUpload(md);
assert(again.docId === docId, "re-upload: same docId");

// Migration V1
resetStorage();
localStorage.setItem(
  LS_SESSIONS_BY_MODE_KEY,
  JSON.stringify({
    rsvp: null,
    slow: {
      studyMode: "slow",
      slow: {
        normalizedTextFull: md,
        annotations: [{ id: "a1", type: "★", charStart: 0, charEnd: 5, userText: "hi", createdAt: 1 }],
      },
    },
    cloze: null,
    questions: null,
  }),
);
await detectAndMigrateV1();
assert(getActiveSession()?.shared.annotations.length === 1, "migration: annotations");

// Slow→Cloze skip phase 0 seed
resetStorage();
const d = await createSession(md);
d.shared.conceptInventory = Array.from({ length: 5 }, (_, i) => ({
  canonicalId: `id${i}`,
  label: `C${i}`,
  definition: "",
}));
const { addConceptsToShared, upsertSmItem } = await import("../src/js/session-store.js");
saveActiveSession(d);
const seeded = epistemicGraphFromShared(d.shared);
assert(seeded.nodes.length === 5, "slow→cloze: 5 shared concepts seed graph");

// SM-2 pool
resetStorage();
const smDoc = await createSession("sm pool test");
upsertSmItem(smDoc.docId, {
  id: "sm-cloze",
  sourceMode: "cloze",
  question: "Q",
  answer: "A",
  easeFactor: 2.5,
  interval: 1,
  nextReview: Date.now() - 1000,
  reviewCount: 0,
});
upsertSmItem(smDoc.docId, {
  id: "sm-rsvp",
  sourceMode: "rsvp",
  question: "Q2",
  answer: "A2",
  easeFactor: 2.5,
  interval: 1,
  nextReview: Date.now() - 1000,
  reviewCount: 0,
});
const due = getSmItemsDueToday(smDoc.docId);
assert(due.length === 2 && due.some((x) => x.sourceMode === "cloze"), "SM-2 pool: both modes");

// dedup conceptInventory
resetStorage();
const dedupDoc = await createSession("dedup");
addConceptsToShared(dedupDoc.docId, [{ label: "Foo", detectedBy: "slow" }]);
addConceptsToShared(dedupDoc.docId, [{ label: "foo", detectedBy: "cloze" }]);
assert(getSession(dedupDoc.docId).shared.conceptInventory.length === 1, "dedup conceptInventory");

// Externalization >400KB
resetStorage();
const big = await createSession("x".repeat(450 * 1024));
const stored = getSession(big.docId);
assert(stored.shared.rawMarkdown.length > 400000, "externalize: rehydrated text");

// Graph canonicalId match
const g = buildClozeEpistemicGraph(
  { studyMode: "cloze", cloze: {} },
  { shared: { conceptInventory: [{ canonicalId: "cid1", label: "Term" }] } },
);
assert(
  g.nodes.some((n) => String(n.epistemicId || n.id).includes("cid1")),
  "graph: canonicalId in nodes",
);

console.log(`\nT09 unified-session integration: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
