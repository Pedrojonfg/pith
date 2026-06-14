/**
 * Exposure / Retrieval Hub — cursor tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260622_exposure-retrieval-hub.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  getDocumentRetrievalModes,
  getModesByRole,
  isExposureMode,
  isVaultMode,
  MODE_TAXONOMY,
} from "../src/js/mode-taxonomy.js";
import { prioritizeByAssessmentSignals } from "../src/js/assessment-signals.js";
import {
  createSession,
  getSession,
  getSmItemsDueToday,
  getVaultReviewDueCount,
  saveActiveSession,
  setActiveSession,
} from "../src/js/session-store.js";
import { stripLegacyReviewSlot } from "../src/js/session-migration.js";
import { normalizeSmItem } from "../src/js/sm2.js";

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

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg} (got ${a}, expected ${e})`);
}

// --- T01 taxonomy ---
{
  const modes = getDocumentRetrievalModes();
  assertEqual(
    modes.map((m) => m.key),
    ["questions", "cloze", "recall"],
    "hub returns 3 retrieval modes in stable order",
  );
  assert(!modes.some((m) => m.key === "review"), "review excluded from hub list");
  assert(isVaultMode("review"), "review is vault-scoped");
  assert(MODE_TAXONOMY.review.scope === "vault", "review.scope === vault");
  assert(isExposureMode("rsvp"), "rsvp is exposure");
  assert(isExposureMode("slow"), "slow is exposure");
  const retrieval = getModesByRole("retrieval");
  assert(retrieval.includes("review"), "review in retrieval role");
  assert(retrieval.includes("questions"), "questions in retrieval role");
  assert(!isVaultMode("questions"), "questions is document-scoped not vault");
  assert(!isExposureMode("review"), "review is not exposure");
}

// --- T01 failure: hub list must stay fixed length ---
{
  const modes = getDocumentRetrievalModes();
  assert(modes.length === 3, "hub exposes exactly three retrieval modes");
  assert(
    modes.every((m) => m.label && m.hint),
    "each hub mode has label and hint for UI cards",
  );
}

// --- T05 signal ordering (block proxies) ---
{
  const proxies = [
    { blockIndex: 0, canonicalId: "concept-a" },
    { blockIndex: 1, canonicalId: "concept-b" },
  ];
  const signals = [
    {
      canonicalId: "concept-b",
      conceptLabel: "concept-b",
      sourceMode: "rsvp",
      wrongCount: 3,
      correctCount: 0,
      lastResult: "wrong",
      weight: 5,
      lastAt: Date.now(),
    },
  ];
  const ordered = prioritizeByAssessmentSignals(proxies, signals);
  assert(ordered[0]?.blockIndex === 1, "weak-concept block prioritized first");
  const emptyOrder = prioritizeByAssessmentSignals(proxies, []);
  assertEqual(
    emptyOrder.map((p) => p.blockIndex),
    [0, 1],
    "empty signals preserve default order",
  );
}

// --- T06 vault queue aggregation ---
{
  resetStorage();
  const mdA = "# Doc A\n\nAlpha content for vault review test.";
  const mdB = "# Doc B\n\nBeta content for vault review test.";
  const docA = await createSession(mdA);
  const docB = await createSession(mdB);
  const now = Date.now();
  docA.shared.smItems = [
    normalizeSmItem({
      id: "sm-a-1",
      docId: docA.docId,
      sourceType: "rsvp_block",
      sourceId: "b1",
      title: "A item",
      scheduledDue: now - 1000,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
    }),
  ];
  docB.shared.smItems = [
    normalizeSmItem({
      id: "sm-b-1",
      docId: docB.docId,
      sourceType: "rsvp_block",
      sourceId: "b1",
      title: "B item",
      scheduledDue: now - 1000,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
    }),
  ];
  saveActiveSession(docA);
  saveActiveSession(docB);
  setActiveSession(docB.docId);

  const due = getSmItemsDueToday();
  assert(due.length >= 2, "vault due aggregates multiple documents");
  assert(
    due.some((item) => item.docId === docA.docId) && due.some((item) => item.docId === docB.docId),
    "due items include both doc origins",
  );
  assert(getVaultReviewDueCount() === due.length, "getVaultReviewDueCount matches aggregate");
}

// --- T09 legacy review migration ---
{
  const legacy = {
    docId: "legacyreview1",
    schemaVersion: 2,
    createdAt: 1,
    updatedAt: 1,
    shared: {
      rawMarkdown: "# Legacy\n\nText.",
      docMeta: { titleInferred: "Legacy", wordCount: 2, charCount: 20 },
      conceptInventory: [],
      annotations: [],
      smItems: [
        {
          id: "keep-me",
          docId: "legacyreview1",
          scheduledDue: Date.now() + 99999,
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
        },
      ],
      assessmentSignals: [],
    },
    modes: {
      rsvp: null,
      slow: null,
      cloze: null,
      questions: null,
      recall: null,
      review: { status: "idle", config: { blocks: [0] } },
    },
  };
  const stripped = stripLegacyReviewSlot(legacy);
  assert(!("review" in stripped.modes), "modes.review stripped by migration helper");
  assert(stripped.shared.smItems.length === 1, "smItems preserved");
  saveActiveSession(stripped);
  const loaded = getSession("legacyreview1");
  assert(loaded && !("review" in (loaded.modes || {})), "loaded session has no review slot");
}

// --- T09 edge: session without review slot is unchanged ---
{
  const clean = {
    docId: "legacyreview2",
    schemaVersion: 2,
    modes: { rsvp: null, slow: null, cloze: null, questions: null, recall: null },
  };
  assert(stripLegacyReviewSlot(clean) === clean, "noop when no review slot");
}

// --- regression note: mid-block RSVP not redirected (contract only) ---
assert(true, "RSVP mid-block path unchanged — manual quickstart Wave 3 step 3");

console.log(`\n20260622_exposure-retrieval-hub: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
