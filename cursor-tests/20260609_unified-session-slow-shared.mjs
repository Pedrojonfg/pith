/**
 * T05 — Slow Mode dual-write to DocumentSession.shared
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-slow-shared.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getActiveSession,
  getSession,
  saveActiveSession,
  setActiveSession,
} from "../src/js/session-store.js";
import { addAnnotation } from "../src/js/slow/annotations.js";
import { syncPhase0ConceptsToShared } from "../src/js/slow/phase0.js";

/** Mirrors study.js syncSlowDocHierarchyToShared (study.js not importable in Node). */
function syncSlowDocHierarchyToShared(slowSession) {
  const doc = getActiveSession();
  if (!doc) return;
  doc.shared.docHierarchy = slowSession?.docHierarchy ?? null;
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

function makeSlowSession() {
  return {
    studyMode: "slow",
    slow: {
      normalizedTextFull: "Hello world. This is a test document for annotations.",
      readingScope: { charStart: 0, charEnd: 50 },
      annotations: [],
    },
  };
}

resetStorage();

// --- Annotations: happy path dual-write ---

const markdown = "# Slow Paper\n\nEpisteme and knowledge claims.";
const doc = await createSession(markdown);
setActiveSession(doc.docId);

const slowSession = makeSlowSession();
const ann = addAnnotation(slowSession, {
  type: "≈",
  charStart: 5,
  charEnd: 10,
  userText: "paraphrase note",
});

assert(ann?.id, "annotation: slow entry created");
assert(slowSession.slow.annotations.length === 1, "annotation: pushed to slow slice");

const afterAnn = getSession(doc.docId);
assert(afterAnn.shared.annotations.length === 1, "annotation: shared.annotations length 1");
const sharedAnn = afterAnn.shared.annotations[0];
assert(sharedAnn.type === "≈", "annotation: type mapped");
assert(sharedAnn.text === "paraphrase note", "annotation: text from userText");
assert(sharedAnn.offset === 5, "annotation: offset from charStart");
assert(sharedAnn.id === ann.id, "annotation: id preserved");
assert(Number.isFinite(sharedAnn.createdAt), "annotation: createdAt set");

// --- Annotations: edge — no active DocumentSession (slow-only) ---

resetStorage();
const orphanSlow = makeSlowSession();
const orphanAnn = addAnnotation(orphanSlow, {
  type: "?",
  charStart: 1,
  charEnd: 4,
  userText: "orphan",
});
assert(orphanAnn?.id, "annotation edge: slow works without doc session");
assert(orphanSlow.slow.annotations.length === 1, "annotation edge: slow slice intact");

// --- Annotations: edge — update same id in shared ---

const doc2 = await createSession("# Doc2\n\nText.");
setActiveSession(doc2.docId);
const slow2 = makeSlowSession();
const first = addAnnotation(slow2, {
  type: "→",
  charStart: 0,
  charEnd: 3,
  userText: "first",
});
// Simulate update by re-adding with same id (addAnnotationToShared upserts)
import { addAnnotationToShared } from "../src/js/session-store.js";
addAnnotationToShared(doc2.docId, {
  id: first.id,
  type: "→",
  text: "updated text",
  offset: 0,
  createdAt: first.createdAt,
});
const updated = getSession(doc2.docId);
assert(updated.shared.annotations.length === 1, "annotation edge: upsert keeps single entry");
assert(updated.shared.annotations[0].text === "updated text", "annotation edge: upsert updates text");

// --- Phase 0 concepts: happy path ---

resetStorage();
const doc3 = await createSession("# Concepts\n\nPhilosophy text.");
setActiveSession(doc3.docId);

syncPhase0ConceptsToShared({
  conceptsToFind: [
    { term: "Episteme", authorUsage: "Knowledge in the strict sense" },
    { term: "Doxa", authorUsage: "Opinion or belief" },
    { term: "Techne", authorUsage: "Craft knowledge" },
  ],
});

const withConcepts = getSession(doc3.docId);
assert(withConcepts.shared.conceptInventory.length === 3, "phase0: three concepts in shared");
const labels = withConcepts.shared.conceptInventory.map((c) => c.label).sort();
assert(
  labels.join(",") === "Doxa,Episteme,Techne",
  `phase0: labels mapped (${labels.join(",")})`,
);
assert(
  withConcepts.shared.conceptInventory.every((c) =>
    String(c.detectedBy).includes("slow"),
  ),
  "phase0: detectedBy slow",
);

// --- Phase 0 concepts: edge — dedup merge on second sync ---

syncPhase0ConceptsToShared({
  conceptsToFind: [
    { term: "episteme", authorUsage: "Longer expanded definition of episteme" },
    { term: "Nous", authorUsage: "Intellect" },
  ],
});
const merged = getSession(doc3.docId);
assert(merged.shared.conceptInventory.length === 4, "phase0 edge: dedup keeps 4 unique concepts");
const episteme = merged.shared.conceptInventory.find((c) => c.label === "Episteme");
assert(
  episteme?.definition?.includes("Longer expanded"),
  "phase0 edge: longer definition wins on merge",
);

// --- Phase 0 concepts: edge — empty / null ---

syncPhase0ConceptsToShared(null);
syncPhase0ConceptsToShared({ conceptsToFind: [] });
syncPhase0ConceptsToShared({ conceptsToFind: [{ term: "  ", authorUsage: "x" }] });
const stillFour = getSession(doc3.docId);
assert(stillFour.shared.conceptInventory.length === 4, "phase0 edge: empty sync is no-op");

// --- Phase 0 concepts: failure — no active session ---

resetStorage();
let threw = false;
try {
  syncPhase0ConceptsToShared({
    conceptsToFind: [{ term: "Ghost", authorUsage: "Should not persist" }],
  });
} catch {
  threw = true;
}
assert(!threw, "phase0 failure: no throw without active session");
assert(getActiveSession() === null, "phase0 failure: no active session");

// --- docHierarchy: happy path ---

resetStorage();
const doc4 = await createSession("# Hierarchy\n\n## Section\n\nBody.");
setActiveSession(doc4.docId);

const hierarchy = {
  tree: [{ id: "s1", title: "Section", level: 2, charStart: 0, charEnd: 20, children: [] }],
  source: "headings",
};
const slowWithHierarchy = { docHierarchy: hierarchy };
syncSlowDocHierarchyToShared(slowWithHierarchy);

const withHierarchy = getSession(doc4.docId);
assert(withHierarchy.shared.docHierarchy?.tree?.length === 1, "hierarchy: tree synced to shared");
assert(withHierarchy.shared.docHierarchy.tree[0].title === "Section", "hierarchy: title preserved");

// --- docHierarchy: edge — null clears shared ---

syncSlowDocHierarchyToShared({ docHierarchy: null });
const cleared = getSession(doc4.docId);
assert(cleared.shared.docHierarchy === null, "hierarchy edge: null synced");

// --- docHierarchy: edge — no active session ---

resetStorage();
let hierarchyThrew = false;
try {
  syncSlowDocHierarchyToShared({ docHierarchy: hierarchy });
} catch {
  hierarchyThrew = true;
}
assert(!hierarchyThrew, "hierarchy edge: no throw without active session");

console.log(`\n20260609_unified-session-slow-shared: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
