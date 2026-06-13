/**
 * Post A+ T14 — integration tests + A+ regression
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_knowledge-vault-post-a-plus.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  BKT_OBSERVATION_THRESHOLD,
  DEFAULT_BKT_PARAMS,
  bktMastery,
  getCurrentMastery,
  maybeEnableBkt,
  updateMastery,
} from "../src/js/vault/mastery-model.js";
import {
  importFromCsv,
  importStructuredRows,
  parseCsvText,
} from "../src/js/vault/import.js";
import {
  detectMisconceptionsForEntry,
  getActiveMisconceptions,
} from "../src/js/vault/misconceptions.js";
import { computeImportanceScore } from "../src/js/vault/prerequisite-graph.js";
import {
  applyObservations,
  collectObservations,
  filterNewConcepts,
} from "../src/js/vault/session-close.js";
import { buildVaultGraph } from "../src/js/vault/vault-graph.js";
import {
  addManualEntry,
  clearVault,
  deleteEntry,
  loadVault,
  mergeEntries,
  saveVault,
  setPrerequisites,
  upsertEntry,
  updateEntryTitle,
} from "../src/js/vault/vault-store.js";

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

function assertClose(actual, expected, msg, eps = 0.02) {
  assert(Math.abs(actual - expected) <= eps, `${msg} (expected ~${expected}, got ${actual})`);
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

function getEntry(id) {
  return loadVault().entries.find((e) => e.id === id);
}

function seedWrongObservations(entryId, wrongAnswer, count) {
  const vault = loadVault();
  const entry = vault.entries.find((e) => e.id === entryId);
  if (!entry) return;
  for (let i = 0; i < count; i += 1) {
    updateMastery(entry, {
      type: "mcq_wrong",
      timestamp: Date.now() - i * 1000,
      docId: "doc1",
      wrongAnswer,
    });
  }
  saveVault(vault);
}

resetStorage();
clearVault();

// =============================================================================
// merge / delete / prereq invariants (T01)
// =============================================================================
section("merge/delete/prereq invariants");

const alpha = addManualEntry({ canonicalTitle: "Alpha", topic: "math", masteryBase: 0.6 });
const beta = addManualEntry({ canonicalTitle: "Beta", topic: "math", masteryBase: 0.5 });
setPrerequisites(beta.id, [alpha.id]);
assert(getEntry(beta.id).prerequisites.includes(alpha.id), "prereq: dependent stores prerequisite");
assert(getEntry(alpha.id).dependents.includes(beta.id), "prereq: inverse dependents link");

upsertEntry({
  id: "gamma-id",
  canonicalTitle: "Gamma",
  topic: "math",
  masteryBase: 0.4,
  observations: [{ type: "mcq_wrong", rawSignal: -0.2, timestamp: Date.now() }],
  sources: [{ docId: "d1", conceptId: "gamma-id" }],
});
const merged = mergeEntries(alpha.id, "gamma-id");
assert(merged?.aliases?.includes("Gamma"), "merge: survivor gains alias");
assert(!loadVault().entries.some((e) => e.id === "gamma-id"), "merge: merged entry removed");
assert(
  loadVault().entries.every((e) => !e.prerequisites.includes("gamma-id")),
  "merge: prerequisite refs rewired",
);

deleteEntry(beta.id);
assert(!loadVault().entries.some((e) => e.id === beta.id), "delete: entry removed");
assert(
  !loadVault().entries.some((e) => (e.prerequisites || []).includes(beta.id)),
  "delete: inverse prereq links cleaned",
);
assert(mergeEntries(alpha.id, alpha.id) === null, "merge: self-merge rejected");
assert(updateEntryTitle(alpha.id, "") === null, "edit: empty title rejected");

// =============================================================================
// import partial success (T04)
// =============================================================================
section("import partial success");

clearVault();
const partialCsv = `canonicalTitle,topic,mastery,prerequisites
"Alpha","math",0.7,""
"","math",0.5,""
"Gamma","math",0.8,""`;
const partial = await importFromCsv({ name: "partial.csv", content: partialCsv });
assert(partial.added === 2 && partial.merged === 0, "partial: two valid rows imported");
assert(
  partial.errors.some((e) => e.includes("Row 3") && e.includes("canonicalTitle")),
  "partial: invalid row reported",
);
assert(loadVault().entries.length === 2, "partial: vault retains successful rows");
assert(loadVault().importHistory.length >= 1, "partial: import history recorded");

// =============================================================================
// misconception threshold (T05)
// =============================================================================
section("misconception threshold");

clearVault();
const photo = addManualEntry({ canonicalTitle: "Photosynthesis", topic: "biology" });
seedWrongObservations(photo.id, "Respiration only", 3);
const vaultPhoto = loadVault();
const entryPhoto = vaultPhoto.entries.find((e) => e.id === photo.id);
const misc = await detectMisconceptionsForEntry(entryPhoto, { useLlm: false });
saveVault(vaultPhoto);
assert(misc?.description && misc.confidence >= 0.6, "misconception: ≥3 same wrongAnswer creates misconception");

const mitosis = addManualEntry({ canonicalTitle: "Mitosis", topic: "biology" });
seedWrongObservations(mitosis.id, "Same mistake", 2);
const none = await detectMisconceptionsForEntry(getEntry(mitosis.id), { useLlm: false });
assert(none === null, "misconception: <3 wrong obs creates none");
assert(getActiveMisconceptions(getEntry(photo.id)).length === 1, "misconception: one active on threshold met");

// =============================================================================
// co-prerequisite cycle (T09)
// =============================================================================
section("co-prerequisite cycle");

clearVault();
const x = addManualEntry({ canonicalTitle: "X", topic: "logic" });
const y = addManualEntry({ canonicalTitle: "Y", topic: "logic" });
setPrerequisites(y.id, [x.id]);
setPrerequisites(x.id, [y.id]);
assert(
  (getEntry(x.id).coPrerequisites || []).includes(y.id)
    && (getEntry(y.id).coPrerequisites || []).includes(x.id),
  "co-prereq: mutual coPrerequisites after reverse edge",
);
assert(
  getEntry(x.id).prerequisites.length === 0 && getEntry(y.id).prerequisites.length === 0,
  "co-prereq: one-way edges removed after conversion",
);

const n1 = addManualEntry({ canonicalTitle: "N1", topic: "chain" });
const n2 = addManualEntry({ canonicalTitle: "N2", topic: "chain" });
const n3 = addManualEntry({ canonicalTitle: "N3", topic: "chain" });
setPrerequisites(n2.id, [n1.id]);
setPrerequisites(n3.id, [n2.id]);
setPrerequisites(n1.id, [n3.id]);
assert(
  (getEntry(n1.id).coPrerequisites || []).includes(n3.id),
  "co-prereq: 3-node cycle closing pair becomes co-prerequisite",
);
assert(getEntry(n2.id).prerequisites.includes(n1.id), "co-prereq: unrelated chain edges preserved");

// =============================================================================
// importance ordering (T11)
// =============================================================================
section("importance ordering");

clearVault();
const hub = addManualEntry({ canonicalTitle: "Hub", topic: "math", masteryBase: 0.5 });
const leaf = addManualEntry({ canonicalTitle: "Leaf", topic: "math", masteryBase: 0.5 });
setPrerequisites(leaf.id, [hub.id]);
const hubEntry = getEntry(hub.id);
const leafEntry = getEntry(leaf.id);
assert(
  hubEntry.importanceScore > leafEntry.importanceScore,
  "importance: hub scores higher than leaf with same mastery",
);
assert(
  computeImportanceScore(hubEntry, loadVault()) === hubEntry.importanceScore,
  "importance: computeImportanceScore matches stored cache",
);

// =============================================================================
// BKT gate (T08)
// =============================================================================
section("BKT gate");

assert(BKT_OBSERVATION_THRESHOLD === 15, "BKT: threshold is 15");

const sparse = {
  id: "sparse",
  canonicalTitle: "Sparse",
  masteryBase: 0.5,
  masteryDeclarativeBase: 0.5,
  masteryProceduralBase: 0.5,
  masteryLastUpdated: Date.now(),
  masteryDeclarativeLastUpdated: Date.now(),
  masteryProceduralLastUpdated: Date.now(),
  observations: Array.from({ length: 14 }, (_, i) => ({
    type: "mcq_correct",
    rawSignal: 0.6,
    timestamp: Date.now() + i,
    docId: "d1",
    taskKind: "declarative",
  })),
};
maybeEnableBkt(sparse);
assert(sparse.useBkt !== true, "BKT: 14 obs does not enable");

const dense = { ...sparse, observations: [...sparse.observations, { type: "mcq_correct", rawSignal: 0.6, timestamp: Date.now(), docId: "d1" }] };
maybeEnableBkt(dense);
assert(dense.useBkt === true, "BKT: 15 obs enables");
assert(dense.bktParams?.pL0 === DEFAULT_BKT_PARAMS.pL0, "BKT: default params seeded");

const bktEntry = {
  useBkt: true,
  bktParams: { ...DEFAULT_BKT_PARAMS },
  observations: [{ type: "mcq_correct", rawSignal: 0.6, timestamp: Date.now() }],
};
assertClose(getCurrentMastery(bktEntry), bktMastery(bktEntry, bktEntry.observations), "BKT: useBkt routes to bktMastery");

// =============================================================================
// A+ session-close regression
// =============================================================================
section("A+ session-close regression");

clearVault();
const freshVault = loadVault();
assert(
  filterNewConcepts([{ id: "n1", title: "New" }], freshVault, "doc-new").length === 1,
  "session-close: filterNewConcepts unseen concept",
);

saveVault({
  schemaVersion: 2,
  lastUpdated: Date.now(),
  entries: [
    {
      id: "known",
      canonicalTitle: "K",
      aliases: [],
      topic: "t",
      masteryBase: 0,
      masteryLastUpdated: Date.now(),
      lastSeen: Date.now(),
      sources: [{ docId: "doc-known", conceptId: "k1", addedAt: Date.now() }],
      prerequisites: [],
      dependents: [],
      observations: [],
    },
  ],
});
assert(
  filterNewConcepts([{ id: "k1", title: "K" }], loadVault(), "doc-known").length === 0,
  "session-close: filterNewConcepts excludes known source",
);

const obs = collectObservations(
  {
    docId: "doc1",
    shared: {
      assessmentSignals: [{ canonicalId: "c1", lastResult: "correct", lastAt: Date.now() }],
      _vaultPendingObservations: [
        { conceptId: "c1", type: "assessment_partial", timestamp: Date.now(), docId: "doc1" },
      ],
    },
    modes: {
      rsvp: {
        blocks: [
          {
            title: "B1",
            concept_ids: ["c2"],
            questions: [{ type: "socratic", concept_id: "c2", question: "Q?" }],
          },
        ],
        _responses: {
          blocks: {
            0: {
              questions: {
                0: { user_answer: "partial", is_correct: false, answered_at: Date.now() },
              },
            },
          },
        },
      },
      slow: null,
      cloze: null,
      questions: null,
    },
  },
  "rsvp",
  "doc1",
);
assert(obs.some((o) => o.type === "mcq_correct"), "session-close: assessment signal → mcq_correct");
assert(obs.some((o) => o.type === "socratic_partial"), "session-close: socratic wrong → socratic_partial");
assert(obs.some((o) => o.type === "assessment_partial"), "session-close: pending observation collected");

const vaultObs = loadVault();
vaultObs.entries = [
  {
    id: "obs1",
    canonicalTitle: "C",
    aliases: [],
    topic: "t",
    masteryBase: 0.2,
    masteryLastUpdated: Date.now(),
    lastSeen: Date.now(),
    sources: [],
    prerequisites: [],
    dependents: [],
    observations: [],
  },
];
const mappedObs = obs.filter((o) => o.conceptId === "c1");
const beforeCount = vaultObs.entries[0].observations.length;
applyObservations(vaultObs, mappedObs, { c1: "obs1" });
assert(
  vaultObs.entries[0].observations.length === beforeCount + mappedObs.length,
  "session-close: applyObservations updates mapped entry",
);

// vault-graph loadVault integration (T12 regression)
clearVault();
const ga = addManualEntry({ canonicalTitle: "GraphA", topic: "math", masteryBase: 0.3 });
const gb = addManualEntry({ canonicalTitle: "GraphB", topic: "math", masteryBase: 0.7 });
setPrerequisites(gb.id, [ga.id]);
const graph = buildVaultGraph(loadVault());
assert(graph.nodes.length === 2, "vault-graph: buildVaultGraph uses loadVault data");
assert(graph.edges.some((e) => e.type === "prerequisite"), "vault-graph: prerequisite edge emitted");

// structured import smoke (parse path)
const rows = parseCsvText(`canonicalTitle,topic,mastery,prerequisites
"Smoke","test",0.7,""`).rows;
const smoke = importStructuredRows(rows);
assert(smoke.added === 1, "import: structured rows still work post-integration");

console.log(`\nPost A+ T14 integration: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
