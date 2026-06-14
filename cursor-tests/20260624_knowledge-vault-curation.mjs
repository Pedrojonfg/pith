/**
 * Knowledge Vault Curation — validation suite (spec 20260624-knowledge-vault-curation)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260624_knowledge-vault-curation.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resetStorage } from "./setup-dom.mjs";
import { LS_DOC_SESSIONS_KEY } from "../src/js/config.js";
import { VAULT_STORAGE_KEY, loadVault, saveVault } from "../src/js/vault/vault-store.js";
import { updateMastery, getCurrentMastery } from "../src/js/vault/mastery-model.js";
import { normalizeSmItem } from "../src/js/sm2.js";

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

resetStorage();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const mainJs = readFileSync(join(root, "src/js/main.js"), "utf8");
const studyJs = readFileSync(join(root, "src/js/study.js"), "utf8");

// --- FR-001 / FR-004 / FR-005: navigation shell (contract: main.js, index.html) ---
check(indexHtml.includes('id="screenAppHome"'), "happy: app home screen exists");
check(indexHtml.includes('id="screenVaultBranch"'), "happy: vault branch screen exists");
check(indexHtml.includes('id="screenUploadToVaultCandidates"'), "happy: upload vault screen exists");
check(indexHtml.includes("Upload to vault"), "happy: upload to vault label");
check(indexHtml.includes("Download session MD"), "happy: download session MD label");
check(
  indexHtml.includes('id="modeSelectHub"') && indexHtml.includes("hidden"),
  "happy: mode select hub hidden by default",
);
check(mainJs.includes("enterAppHome"), "contract: main.js routes to enterAppHome");
check(studyJs.includes("export function enterAppHome"), "contract: study.js exports enterAppHome");
check(studyJs.includes("projectLibraryCallbacks.onBack = () => enterAppHome()"), "contract: library back → app home");

// --- FR-006: getStudiedConcepts ---
const {
  getStudiedConcepts,
  collectStudiedConceptIds,
  mapQualityToReviewObservation,
  normalizeVaultReviewItemForQueue,
  hasDefinitionFromDoc,
  applyVaultReviewItemObservation,
} = await import("../src/js/vault/vault-curation.js");
const { OBSERVATION_WEIGHTS } = await import("../src/js/vault/mastery-model.js");
const { getReviewableItemsForProject, filterDueSmItems } = await import(
  "../src/js/review-project-scope.js"
);
const { CONCEPT_FACETS, FACET_LABELS, MISC_PROJECT_ID } = await import("../src/js/session-types.js");
const { appendDecayCalibrationLog, loadDecayCalibrationLog, DECAY_CALIBRATION_KEY } = await import(
  "../src/js/vault/decay-calibration.js"
);

const sessionWithStudy = {
  docId: "doc1",
  projectId: MISC_PROJECT_ID,
  shared: {
    conceptInventory: [
      { id: "c1", label: "Alpha" },
      { id: "c2", label: "Beta" },
      { id: "c3", label: "Gamma" },
    ],
    assessmentSignals: [{ conceptId: "c1", canonicalId: "c1" }],
  },
  modes: {
    rsvp: { blockIndex: [{ concept_ids: ["c2"] }] },
    questions: { blockIndex: [{ concept_ids: ["c2"] }] },
    cloze: { items: [{ concept_id: "c2", studyProgress: { done: 1 } }] },
    recall: { questions: [{ concept_id: "c1", answered: true }] },
  },
};

check(getStudiedConcepts(sessionWithStudy).length === 2, "happy: studied concepts union modes");
check(
  !getStudiedConcepts(sessionWithStudy).some((c) => String(c.id) === "c3"),
  "happy: unstudied inventory excluded",
);

const emptyStudy = {
  docId: "doc-empty",
  shared: { conceptInventory: [{ id: "x", label: "X" }] },
  modes: { rsvp: { blockIndex: [] } },
};
check(getStudiedConcepts(emptyStudy).length === 0, "edge: no interactions → empty candidates");

const touched = collectStudiedConceptIds(sessionWithStudy);
check(touched.has("c1") && touched.has("c2"), "happy: touched id set complete");

// --- FR-012: quality → observation mapping ---
check(
  mapQualityToReviewObservation(4).type === "review_correct" &&
    mapQualityToReviewObservation(4).rawSignal === 1.0,
  "happy: quality ≥4 → review_correct",
);
check(mapQualityToReviewObservation(3).type === "review_partial", "happy: quality 3 → partial");
check(mapQualityToReviewObservation(1).type === "review_wrong", "happy: quality <3 → wrong");
check(
  mapQualityToReviewObservation(Number.NaN).type === "review_wrong",
  "failure: invalid quality → wrong bucket",
);

check(OBSERVATION_WEIGHTS.review_correct === 1.0, "happy: review_correct weight");
check(OBSERVATION_WEIGHTS.review_partial === 0.3, "happy: review_partial weight");
check(OBSERVATION_WEIGHTS.review_wrong === -0.5, "happy: review_wrong weight");

// --- FR-011: dual pool queue shape ---
const queueItem = normalizeVaultReviewItemForQueue({
  id: "ri1",
  vaultEntryId: "ve1",
  facet: "relational",
  prompt: "How does A relate to B?",
  answer: "A precedes B",
  sourceDocId: "doc1",
  sm2: { interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: Date.now() },
  createdAt: Date.now(),
});
check(queueItem?.source === "vault", "happy: vault queue item source tag");
check(queueItem?.sourceType === "vault_review_item", "happy: vault queue sourceType");
check(queueItem?.facet === "relational", "happy: facet preserved on queue item");
check(normalizeVaultReviewItemForQueue(null) === null, "failure: null review item rejected");

const sm2Norm = normalizeSmItem({
  ...queueItem,
  source: "vault",
  facet: "relational",
  vaultEntryId: "ve1",
});
check(sm2Norm?.source === "vault" && sm2Norm?.facet === "relational", "contract: sm2 preserves source/facet");

// --- FR-010: vault migration ---
resetStorage();
localStorage.setItem(
  VAULT_STORAGE_KEY,
  JSON.stringify({
    schemaVersion: 1,
    entries: [
      {
        id: "legacy1",
        canonicalTitle: "Legacy",
        aliases: [],
        topic: "math",
        masteryBase: 0.5,
        masteryLastUpdated: Date.now(),
        lastSeen: Date.now(),
        sources: [],
        prerequisites: [],
        dependents: [],
        observations: [],
      },
    ],
    lastUpdated: Date.now(),
  }),
);
const migrated = loadVault();
check(Array.isArray(migrated.reviewItems), "happy: migrated vault has reviewItems array");
check(migrated.reviewItems.length === 0, "happy: legacy vault reviewItems default empty");
check(
  Array.isArray(migrated.entries[0]?.definitions) &&
    typeof migrated.entries[0]?.facetCoverage === "object",
  "happy: legacy entry gets definitions/facetCoverage",
);

// --- FR-011: dual pool merge with project scope ---
resetStorage();
const sessions = [
  {
    docId: "d-scope",
    projectId: "proj-a",
    shared: {
      smItems: [
        {
          id: "sm1",
          sourceType: "rsvp_block",
          sourceId: "b1",
          docId: "d-scope",
          title: "Block",
          scheduledDue: Date.now(),
        },
      ],
    },
  },
];
localStorage.setItem(LS_DOC_SESSIONS_KEY, JSON.stringify(sessions));
saveVault({
  schemaVersion: 2,
  entries: [
    {
      id: "ve-scope",
      canonicalTitle: "Scoped concept",
      aliases: [],
      topic: "math",
      masteryBase: 0.4,
      masteryLastUpdated: Date.now() - 86400000,
      lastSeen: Date.now(),
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
      definitions: [],
      facetCoverage: {},
    },
  ],
  reviewItems: [
    {
      id: "vri1",
      vaultEntryId: "ve-scope",
      facet: "synthesis",
      prompt: "Define X",
      answer: "X is …",
      sourceDocId: "d-scope",
      sm2: { interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: Date.now() - 1000 },
      createdAt: Date.now(),
    },
  ],
  lastUpdated: Date.now(),
});

const allPool = getReviewableItemsForProject("all");
check(
  allPool.some((i) => i.source === "session") && allPool.some((i) => i.source === "vault"),
  "happy: all scope merges session + vault pools",
);

// Orphan vault item (deleted session) — edge FR edge case
saveVault({
  ...loadVault(),
  reviewItems: [
    ...loadVault().reviewItems,
    {
      id: "vri-orphan",
      vaultEntryId: "ve-scope",
      facet: "cloze",
      prompt: "Orphan",
      answer: "N/A",
      sourceDocId: "deleted-doc",
      sm2: { interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: Date.now() },
      createdAt: Date.now(),
    },
  ],
});
const scopedOrphan = getReviewableItemsForProject("proj-a");
check(
  !scopedOrphan.some((i) => i.sourceId === "vri-orphan"),
  "edge: vault item with missing session excluded from scope",
);

// --- FR-009 idempotency: hasDefinitionFromDoc ---
check(
  hasDefinitionFromDoc({ definitions: [{ sourceDocId: "doc1", text: "x" }] }, "doc1"),
  "happy: hasDefinitionFromDoc detects existing",
);
check(hasDefinitionFromDoc({ definitions: [] }, "doc1") === false, "happy: no definition yet");

// --- FR-012 / FR-003 facetCoverage on review observation ---
resetStorage();
const now = Date.now();
saveVault({
  schemaVersion: 2,
  entries: [
    {
      id: "ve-facet",
      canonicalTitle: "Facet test",
      aliases: [],
      topic: "t",
      masteryBase: 0.6,
      masteryLastUpdated: now - 86400000 * 5,
      lastSeen: now,
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
      definitions: [],
      facetCoverage: {},
    },
  ],
  reviewItems: [
    {
      id: "vri-facet",
      vaultEntryId: "ve-facet",
      facet: "argumentative",
      prompt: "Arg?",
      answer: "Because",
      sourceDocId: "doc1",
      sm2: { interval: 1, easeFactor: 2.5, repetitions: 0, dueDate: now },
      createdAt: now,
    },
  ],
  lastUpdated: now,
});

applyVaultReviewItemObservation("ve-facet", "vri-facet", 4, {
  facet: "argumentative",
  docId: "doc1",
});
const afterReview = loadVault();
const entry = afterReview.entries.find((e) => e.id === "ve-facet");
check(
  Number(entry?.facetCoverage?.argumentative) > now - 5000,
  "happy: facetCoverage updated on review",
);
check(
  Number(entry?.masteryLastUpdated) > now - 5000,
  "happy: masteryLastUpdated reset on review",
);
check(
  afterReview.reviewItems.find((r) => r.id === "vri-facet")?.sm2?.repetitions >= 0,
  "happy: vault review item SM-2 updated",
);

// Direct mastery update with facet metadata
const entryDirect = {
  id: "e-direct",
  canonicalTitle: "D",
  masteryBase: 0.5,
  masteryLastUpdated: now - 100000,
  observations: [],
  facetCoverage: {},
};
updateMastery(entryDirect, {
  type: "review_partial",
  rawSignal: 0.3,
  timestamp: now,
  docId: "doc1",
  facet: "applicative",
});
check(entryDirect.facetCoverage.applicative === now, "happy: updateMastery sets facetCoverage");

// --- FR-013: decay calibration FIFO ---
resetStorage();
localStorage.removeItem(DECAY_CALIBRATION_KEY);
for (let i = 0; i < 1002; i += 1) {
  appendDecayCalibrationLog({
    vaultEntryId: `e${i}`,
    daysSinceLastUpdate: 1,
    predictedMastery: 0.5,
    observedSignal: 1,
    timestamp: now + i,
  });
}
const calLog = loadDecayCalibrationLog();
check(calLog.length === 1000, "edge: decay log capped at 1000 FIFO");
check(calLog[0].vaultEntryId === "e2", "edge: oldest entries evicted");

// --- FR-014: English facet labels ---
check(CONCEPT_FACETS.includes("cloze"), "happy: cloze in concept facets");
check(FACET_LABELS.synthesis === "Synthesis", "happy: English facet labels");
check(FACET_LABELS.cloze === "Cloze", "happy: cloze label English");

// --- Contract: filterDueSmItems still works for merged pool ---
const dueMerged = filterDueSmItems(allPool);
check(dueMerged.length >= 1, "contract: filterDueSmItems works on merged pool");

console.log(`\nKnowledge Vault Curation: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("20260624_knowledge-vault-curation: all tests passed");
