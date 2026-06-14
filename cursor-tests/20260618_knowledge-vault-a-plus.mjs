/**
 * Knowledge Vault A+ — exhaustive validation (spec 20260618-knowledge-vault-a-plus)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260618_knowledge-vault-a-plus.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  ALPHA,
  LAMBDA,
  OBSERVATION_WEIGHTS,
  PRESUMED_KNOWN_THRESHOLD,
  getCurrentMastery,
  getMasteryLabel,
  hydrateMastery,
  updateMastery,
} from "../src/js/vault/mastery-model.js";
import {
  VAULT_DATA_KEY,
  VAULT_STORAGE_KEY,
  addSource,
  clearVault,
  exportVaultJson,
  getEntriesByTopic,
  getEntryById,
  loadVault,
  saveVault,
  upsertEntry,
} from "../src/js/vault/vault-store.js";
import { buildAllNewMappings, mergeNormalizationResult } from "../src/js/vault/normalization.js";
import {
  addPrerequisiteRelation,
  elevatePrerequisiteRelations,
} from "../src/js/vault/prerequisites.js";
import {
  buildBlockVaultHint,
  buildVaultContextBlock,
  findVaultEntryForConceptId,
  getVaultContextForDoc,
} from "../src/js/vault/prompt-injection.js";
import {
  applyObservations,
  collectObservations,
  filterNewConcepts,
  getDocTopics,
} from "../src/js/vault/session-close.js";
import { parseTopicsFromLlm, buildHierarchyUserPrompt } from "../src/js/normalization/hierarchy.js";
import { resolveModeEntryState } from "../src/js/mode-bootstrap.js";
import { validateDocumentSession } from "../src/js/session-types.js";
import { createSession } from "../src/js/session-store.js";
import {
  PREPACKING_ALREADY_KNOW_ANSWER,
  buildConceptPackPrompt,
  normalizeConceptsToVault,
} from "../src/js/api.js";

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
  // marker for readability in logs
  void title;
}

resetStorage();
clearVault();

// =============================================================================
// T01 — mastery-model (happy / edge / failure)
// =============================================================================
section("T01 mastery-model");

const entry = {
  id: "e1",
  canonicalTitle: "Chain rule",
  aliases: [],
  topic: "calculus",
  masteryBase: 0.8,
  masteryLastUpdated: Date.now() - 8 * 86_400_000,
  lastSeen: Date.now(),
  sources: [],
  prerequisites: [],
  dependents: [],
  observations: [],
};

// happy: 7+ day decay
assertClose(getCurrentMastery(entry), 0.8 * Math.exp(-LAMBDA * 8), "happy: 7+ day decay lowers mastery");

// happy: observation sequence
updateMastery(entry, { type: "mcq_correct", timestamp: Date.now(), docId: "doc1" });
assert(entry.masteryBase > 0, "happy: positive observation increases masteryBase");
assert(entry.observations.length === 1, "happy: observation appended");
assert(entry.observations[0].rawSignal === OBSERVATION_WEIGHTS.mcq_correct, "happy: weight table applied");

// failure: wrong after mastery
const beforeWrong = entry.masteryBase;
updateMastery(entry, { type: "mcq_wrong", timestamp: Date.now(), docId: "doc1" });
assert(entry.masteryBase < beforeWrong, "failure case: wrong answer decreases mastery");

// edge: no decay at same timestamp
const fresh = {
  masteryBase: 0.5,
  masteryDeclarativeBase: 0.5,
  masteryProceduralBase: 0.5,
  masteryLastUpdated: Date.now(),
};
assertClose(getCurrentMastery(fresh), 0.5, "edge: zero elapsed → no decay");

// edge: mastery bands
const bandBase = (m) => ({
  masteryBase: m,
  masteryDeclarativeBase: m,
  masteryProceduralBase: m,
  masteryLastUpdated: Date.now(),
});
assert(getMasteryLabel(bandBase(0.1)) === "unknown", "edge: unknown band");
assert(getMasteryLabel(bandBase(0.4)) === "partial", "edge: partial band");
assert(getMasteryLabel(bandBase(0.65)) === "acquired", "edge: acquired band");
assert(getMasteryLabel(bandBase(0.85)) === "mastered", "edge: mastered band");

// edge: clamp extreme negative
const clampEntry = { ...entry, masteryBase: 0.1, masteryLastUpdated: Date.now(), observations: [] };
updateMastery(clampEntry, { type: "cloze_wrong", timestamp: Date.now(), docId: "d" });
assert(clampEntry.masteryBase >= 0 && clampEntry.masteryBase <= 1, "edge: mastery clamped 0-1");

// happy: hydrateMastery
const hydrated = hydrateMastery({ ...entry, masteryBase: 0.6, masteryLastUpdated: Date.now() });
assert(typeof hydrated.mastery === "number", "happy: hydrateMastery sets runtime mastery");

assert(PRESUMED_KNOWN_THRESHOLD === 0.7, "contract: PRESUMED_KNOWN_THRESHOLD");
assert(ALPHA === 0.3 && LAMBDA === 0.05, "contract: ALPHA/LAMBDA");

// =============================================================================
// T01 — vault-store (happy / edge / failure)
// =============================================================================
section("T01 vault-store");

saveVault({ schemaVersion: 1, entries: [entry], lastUpdated: Date.now() });
const loaded = loadVault();
assert(loaded.entries.length === 1, "happy: loadVault persists entry");
assert(loaded.entries[0].mastery != null, "happy: hydrate mastery on load");

upsertEntry({
  id: "e2",
  canonicalTitle: "Product rule",
  aliases: [],
  topic: "calculus",
  masteryBase: 0,
  masteryLastUpdated: Date.now(),
  lastSeen: Date.now(),
  sources: [],
  prerequisites: [],
  dependents: [],
  observations: [],
});
assert(getEntryById("e2")?.canonicalTitle === "Product rule", "happy: upsertEntry + getEntryById");

addSource("e2", { docId: "doc-x", conceptId: "cx" });
assert(getEntryById("e2")?.sources?.length === 1, "happy: addSource");

// edge: flexible topic match (both directions)
assert(getEntriesByTopic(["calc"]).length >= 1, "edge: topic substring forward");
assert(getEntriesByTopic(["calculus derivatives"]).length >= 1, "edge: topic substring reverse");

// failure: corrupt JSON
localStorage.setItem(VAULT_STORAGE_KEY, "{bad");
assert(loadVault().entries.length === 0, "failure: corrupt JSON → empty vault");
clearVault();

// failure: missing entry
assert(getEntryById("missing-id") === null, "failure: getEntryById null");

// happy: export + clear
saveVault(loaded);
const exported = JSON.parse(exportVaultJson());
assert(exported.schemaVersion === 3, "happy: export JSON shape (schema v3)");
clearVault();
assert(loadVault().entries.length === 0, "happy: clearVault empties");

// =============================================================================
// T04 — normalization (happy / edge / failure)
// =============================================================================
section("T04 normalization");

const vault = loadVault();
vault.entries = [];

const mappings = buildAllNewMappings([{ id: "c1", title: "Derivatives" }, { id: "" }]);
assert(mappings.length === 1 && mappings[0].action === "new", "happy: all-new mappings skip empty ids");

const map = mergeNormalizationResult(
  vault,
  [{ conceptId: "c1", action: "new", vaultEntryId: null }],
  [{ id: "c1", title: "Derivatives" }],
  ["calculus"],
  "doc-a",
);
assert(map.c1, "happy: new entry created");

const aliasVault = loadVault();
aliasVault.entries = [...vault.entries];
const aliasMap = mergeNormalizationResult(
  aliasVault,
  [{ conceptId: "c2", action: "alias", vaultEntryId: map.c1 }],
  [{ id: "c2", title: "Derivation rules" }],
  ["calculus"],
  "doc-b",
);
assert(aliasMap.c2 === map.c1, "happy: alias maps to existing");
assert(
  aliasVault.entries.find((e) => e.id === map.c1)?.aliases?.includes("Derivation rules"),
  "happy: alias string stored",
);

// edge: bad merge target → falls through to new
const badMergeVault = loadVault();
badMergeVault.entries = [];
const badMap = mergeNormalizationResult(
  badMergeVault,
  [{ conceptId: "c9", action: "merge", vaultEntryId: "nonexistent" }],
  [{ id: "c9", title: "Orphan merge" }],
  ["topic"],
  "doc-z",
);
assert(badMap.c9 && badMap.c9 !== "nonexistent", "edge: invalid merge target creates new entry");

// =============================================================================
// T06 — prerequisites (happy / edge / failure)
// =============================================================================
section("T06 prerequisites");

const vault3 = {
  schemaVersion: 1,
  lastUpdated: Date.now(),
  entries: [
    {
      id: "v1",
      canonicalTitle: "A",
      aliases: [],
      topic: "t",
      masteryBase: 0,
      masteryLastUpdated: Date.now(),
      lastSeen: Date.now(),
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
    },
    {
      id: "v2",
      canonicalTitle: "B",
      aliases: [],
      topic: "t",
      masteryBase: 0,
      masteryLastUpdated: Date.now(),
      lastSeen: Date.now(),
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
    },
  ],
};
addPrerequisiteRelation(vault3, "v2", "v1");
assert(vault3.entries.find((e) => e.id === "v2").prerequisites.includes("v1"), "happy: dependent prereq");
assert(vault3.entries.find((e) => e.id === "v1").dependents.includes("v2"), "happy: inverse dependents");

// edge: self-loop ignored
addPrerequisiteRelation(vault3, "v1", "v1");
assert(!vault3.entries.find((e) => e.id === "v1").prerequisites.includes("v1"), "edge: no self prerequisite");

saveVault(vault3);
elevatePrerequisiteRelations(
  { shared: { conceptInventory: [{ id: "c1", prerequisite_ids: ["c0"] }, { id: "c0" }] } },
  { c1: "v2", c0: "v1" },
);
const afterElevate = loadVault();
assert(
  afterElevate.entries.find((e) => e.id === "v2")?.prerequisites?.includes("v1"),
  "happy: elevate from inventory",
);

// =============================================================================
// T05 — prompt injection + api consumer (happy / edge / failure)
// =============================================================================
section("T05 prompt-injection");

saveVault({
  schemaVersion: 1,
  lastUpdated: Date.now(),
  entries: [
    {
      id: "m1",
      canonicalTitle: "Limits",
      aliases: [],
      topic: "calculus",
      masteryBase: 0.85,
      masteryLastUpdated: Date.now(),
      lastSeen: Date.now(),
      sources: [{ docId: "d", conceptId: "lim-1", addedAt: Date.now() }],
      prerequisites: ["m2"],
      dependents: [],
      observations: [],
    },
    {
      id: "m2",
      canonicalTitle: "Epsilon-delta",
      aliases: [],
      topic: "calculus",
      masteryBase: 0.2,
      masteryLastUpdated: Date.now(),
      lastSeen: Date.now(),
      sources: [{ docId: "d", conceptId: "ed-1", addedAt: Date.now() }],
      prerequisites: [],
      dependents: [],
      observations: [],
    },
  ],
});

const ctx = getVaultContextForDoc(["calculus"]);
assert(ctx.length >= 2, "happy: getVaultContextForDoc matches");
const block = buildVaultContextBlock(ctx);
assert(block.includes("GLOBAL KNOWLEDGE CONTEXT"), "happy: vault context block header");
assert(block.includes("Limits"), "happy: mastered in block");
assert(block.includes("Epsilon-delta"), "happy: unstable prereq in block");

// edge: empty vault → no block
clearVault();
assert(buildVaultContextBlock([]) === "", "edge: empty vault → empty block");

// happy: block hint
saveVault({
  schemaVersion: 1,
  lastUpdated: Date.now(),
  entries: [
    {
      id: "h1",
      canonicalTitle: "Integral",
      aliases: [],
      topic: "calc",
      masteryBase: 0.9,
      masteryLastUpdated: Date.now(),
      lastSeen: Date.now(),
      sources: [{ docId: "d", conceptId: "int-1", addedAt: Date.now() }],
      prerequisites: [],
      dependents: [],
      observations: [],
    },
  ],
});
const hintEntries = getVaultContextForDoc(["calc"]);
const hint = buildBlockVaultHint(["int-1"], hintEntries);
assert(hint.includes("Integral"), "happy: buildBlockVaultHint resolves concept");
assert(findVaultEntryForConceptId("int-1", hintEntries)?.id === "h1", "happy: findVaultEntryForConceptId");

const packPrompt = buildConceptPackPrompt(5, "English", "[]", {
  vaultContextBlock: "\n\nGLOBAL KNOWLEDGE CONTEXT (test)",
});
assert(packPrompt.includes("GLOBAL KNOWLEDGE CONTEXT"), "contract: buildConceptPackPrompt appends vault block");

const noVaultPrompt = buildConceptPackPrompt(3, "English", "[]", {});
assert(!noVaultPrompt.includes("GLOBAL KNOWLEDGE CONTEXT"), "edge: no vault block when omitted");

// =============================================================================
// T04 api — normalizeConceptsToVault empty vault (no LLM)
// =============================================================================
section("T04 normalizeConceptsToVault");

const emptyNorm = await normalizeConceptsToVault({
  existingEntries: [],
  newConcepts: [{ id: "n1", title: "Foo" }],
  topic: "math",
});
assert(emptyNorm.length === 1 && emptyNorm[0].action === "new", "happy: empty vault skips LLM");

// =============================================================================
// T07 — docTopics (happy / edge / failure)
// =============================================================================
section("T07 docTopics");

const topics = parseTopicsFromLlm(
  JSON.stringify({ tree: [], topics: ["Calculus", "Derivatives", "Integrals"] }),
);
assert(topics.length === 3, "happy: parseTopicsFromLlm extracts tags");

const deduped = parseTopicsFromLlm(
  JSON.stringify({ tree: [], topics: ["Calc", "calc", "CALC"] }),
);
assert(deduped.length === 1, "edge: topic dedupe case-insensitive");

assert(parseTopicsFromLlm("not json").length === 0, "failure: invalid JSON → []");
assert(parseTopicsFromLlm(JSON.stringify({ tree: [] })).length === 0, "failure: missing topics → []");

const hierarchyPrompt = buildHierarchyUserPrompt("x".repeat(4000));
assert(hierarchyPrompt.includes('"topics"'), "contract: hierarchy LLM prompt requests topics");

const session = await createSession("# Test\n\nBody", { docId: "doc-types-test" });
session.shared.docTopics = ["math", "algebra"];
assert(validateDocumentSession(session).ok, "happy: docTopics validates");
assert(getDocTopics(session).length === 2, "happy: getDocTopics reads shared");

session.shared.docTopics = "not-array";
assert(!validateDocumentSession(session).ok, "failure: docTopics must be array");

// =============================================================================
// T02 — session-close pipeline (happy / edge / failure)
// =============================================================================
section("T02 session-close");

clearVault();
const freshVault = loadVault();

assert(
  filterNewConcepts([{ id: "n1", title: "New" }], freshVault, "doc-new").length === 1,
  "happy: filterNewConcepts unseen",
);

saveVault({
  schemaVersion: 1,
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
  "edge: filterNewConcepts excludes known source",
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
assert(obs.some((o) => o.type === "mcq_correct"), "happy: assessment signal → mcq_correct");
assert(obs.some((o) => o.type === "socratic_partial"), "edge: socratic wrong → socratic_partial");
assert(obs.some((o) => o.type === "assessment_partial"), "happy: pending observation collected");

const vault4 = loadVault();
vault4.entries = [
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
const obsCountBefore = vault4.entries[0].observations.length;
const mappedObs = obs.filter((o) => o.conceptId === "c1");
applyObservations(vault4, mappedObs, { c1: "obs1" });
assert(
  vault4.entries[0].observations.length === obsCountBefore + mappedObs.length,
  "happy: applyObservations updates mapped entry",
);
assert(
  vault4.entries[0].observations.every((o) => !o.conceptId || o.conceptId !== "c2"),
  "failure: unmapped conceptId not written",
);

// =============================================================================
// T08 — assessment constants (contract)
// =============================================================================
section("T08 assessment");
assert(
  PREPACKING_ALREADY_KNOW_ANSWER.includes("already know"),
  "contract: PREPACKING_ALREADY_KNOW_ANSWER exported",
);

// =============================================================================
// Mode-bootstrap regression (resume contract)
// =============================================================================
section("mode-bootstrap regression");

const docResume = {
  schemaVersion: 2,
  docId: "resume-doc",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  shared: {
    rawMarkdown: "# Doc\n\nText.",
    docMeta: { titleInferred: "Doc" },
    conceptInventory: [],
    annotations: [],
    smItems: [],
    docTopics: [],
  },
  modes: {
    rsvp: { studyMode: "rsvp", n_blocks: 2, blocks: [{ title: "B1" }, { title: "B2" }] },
    slow: null,
    cloze: null,
    questions: null,
  },
};
assert(
  resolveModeEntryState(docResume, "rsvp").kind === "resume",
  "regression: n_blocks+blocks titles → resume per contract",
);

// =============================================================================
// Split storage (edge — when payload > 300KB)
// =============================================================================
section("T01 split storage");

clearVault();
const bigEntries = Array.from({ length: 200 }, (_, i) => ({
  id: `big-${i}`,
  canonicalTitle: `Concept number ${i} with extended title for storage pressure testing`,
  aliases: [`alias-${i}`, `alt-${i}`, `syn-${i}`],
  topic: "stress-test-topic-calculus",
  masteryBase: 0.5,
  masteryLastUpdated: Date.now(),
  lastSeen: Date.now(),
  sources: [{ docId: "d", conceptId: `c${i}`, addedAt: Date.now() }],
  prerequisites: i > 0 ? [`big-${i - 1}`] : [],
  dependents: [],
  observations: Array.from({ length: 8 }, (_, j) => ({
    type: "mcq_correct",
    rawSignal: 0.6,
    timestamp: Date.now() - j * 1000,
    docId: "d",
  })),
}));
saveVault({ schemaVersion: 1, entries: bigEntries, lastUpdated: Date.now() });
const splitMeta = localStorage.getItem(VAULT_STORAGE_KEY) || "";
const usesSplit =
  splitMeta.includes("entriesRef") || localStorage.getItem(VAULT_DATA_KEY) != null;
if (usesSplit) {
  const reloaded = loadVault();
  assert(reloaded.entries.length === bigEntries.length, "edge: split storage round-trip");
} else {
  assert(loadVault().entries.length === 200, "edge: inline storage still loads all entries");
}
clearVault();

console.log(`\nKnowledge Vault A+ (exhaustive): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
