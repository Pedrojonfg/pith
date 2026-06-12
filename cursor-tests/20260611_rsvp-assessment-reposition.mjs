/**
 * RSVP Assessment Reposition — T01–T09 integration tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-assessment-reposition.mjs
 */
import {
  ASSESSMENT_FLAGS,
  isPrePackingAssessmentEnabled,
} from "../src/js/config/flags.js";
import {
  normalizeAssessmentItems,
  normalizeKnowledgeProfile,
  PREPACKING_DONT_KNOW_ANSWER,
} from "../src/js/api.js";
import {
  getKnowledgeProfile,
  setKnowledgeProfile,
  setAssessmentSkipped,
  setPackingIgnoredProfile,
  validatePackInvariants,
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

function section(name) {
  console.log(`\n── ${name} ──`);
}

const sampleInventory = [
  { id: "c1", label: "Thesis", type: "THESIS" },
  { id: "c2", label: "Argument", type: "ARGUMENT" },
  { id: "c3", label: "Term", type: "TERM" },
];

// ── T01: flags ──
section("T01 feature flags");
assert(isPrePackingAssessmentEnabled() === true, "isPrePackingAssessmentEnabled default true");
assert(ASSESSMENT_FLAGS.ASSESSMENT_BEFORE_PACKING === true, "ASSESSMENT_BEFORE_PACKING default");
assert(ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX === 7, "ASSESSMENT_ITEMS_MAX");
assert(ASSESSMENT_FLAGS.ASSESSMENT_MASTERY_THRESHOLD === 0.85, "ASSESSMENT_MASTERY_THRESHOLD");
assert(ASSESSMENT_FLAGS.ASSESSMENT_PARALLEL_PACKING === true, "ASSESSMENT_PARALLEL_PACKING");

// ── T02: session meta ──
section("T02 session meta CRUD");
{
  const session = { _meta: { session_id: "s1" } };
  assert(getKnowledgeProfile(session) === null, "getKnowledgeProfile empty");

  const profile = {
    assessed_at: "2026-06-11T00:00:00.000Z",
    coverage: 50,
    items: [{ concept_id: "c1", mastery: "partial", confidence: 0.6 }],
  };
  setKnowledgeProfile(session, profile);
  assert(getKnowledgeProfile(session)?.items?.length === 1, "setKnowledgeProfile persists");
  assert(session._meta.assessment_skipped === false, "default assessment_skipped false");

  setAssessmentSkipped(session, true);
  assert(session._meta.assessment_skipped === true, "setAssessmentSkipped true");
  assert(getKnowledgeProfile(session) === null, "skip clears knowledge_profile");
  assert(!("knowledge_profile" in session._meta), "skip deletes knowledge_profile key");
  assert(session._meta.packing_ignored_profile === false, "skip clears packing_ignored");

  setKnowledgeProfile(session, profile);
  setPackingIgnoredProfile(session, true);
  assert(session._meta.packing_ignored_profile === true, "packing_ignored_profile true");
  assert(getKnowledgeProfile(session)?.items?.length === 1, "ignore keeps profile");
  assert(session._meta.assessment_skipped === false, "ignore clears assessment_skipped");

  const legacy = { blocks: [] };
  setKnowledgeProfile(legacy, profile);
  assert(legacy._meta?.knowledge_profile?.coverage === 50, "backward compat creates _meta");
}

// ── T03: normalizers ──
section("T03 normalizeAssessmentItems");
{
  const items = normalizeAssessmentItems([
    {
      item_id: "q1",
      concept_id: "c1",
      question: "What is X?",
      type: "mcq",
      options: ["A", "B", "C"],
      correct: "A",
    },
  ]);
  assert(items.length === 1 && items[0].type === "mcq", "happy path mcq item");
  assert(items[0].item_id === "q1", "item_id preserved");

  try {
    normalizeAssessmentItems([]);
    assert(false, "empty array should throw");
  } catch (e) {
    assert(String(e.message).includes("empty"), "failure: empty items");
  }

  try {
    normalizeAssessmentItems([{ item_id: "x", question: "?", type: "open", options: ["a", "b"] }]);
    assert(false, "non-mcq should throw");
  } catch (e) {
    assert(String(e.message).includes("mcq"), "failure: wrong type");
  }

  try {
    normalizeAssessmentItems([{ item_id: "x", question: "?", type: "mcq", options: ["only"] }]);
    assert(false, "single option should throw");
  } catch (e) {
    assert(String(e.message).includes("2 options"), "failure: too few options");
  }

  const wrapped = normalizeAssessmentItems({
    items: [
      {
        id: "q2",
        concept_id: "c2",
        question: "Edge?",
        type: "mcq",
        options: ["Yes", "No"],
        answer: "Yes",
      },
    ],
  });
  assert(wrapped[0].item_id === "q2" && wrapped[0].correct === "Yes", "wrapped + id alias");

  const edgeItem = normalizeAssessmentItems([
    {
      item_id: "e1",
      edge: { from: "c1", to: "c2" },
      question: "Relation?",
      type: "mcq",
      options: ["A", "B"],
      correct: "A",
    },
  ]);
  assert(edgeItem[0].edge?.from === "c1", "edge item parsed");
}

section("T03 normalizeKnowledgeProfile");
{
  const raw = {
    items: [
      { concept_id: "c1", mastery: "full", confidence: 0.95 },
      { concept_id: "c2", mastery: "partial", confidence: 0.55 },
    ],
  };
  const quizItems = [
    { item_id: "q1", concept_id: "c1" },
    { item_id: "q2", concept_id: "c2" },
  ];
  const profile = normalizeKnowledgeProfile(raw, {
    inventory: sampleInventory,
    items: quizItems,
    responses: [{ item_id: "q1", answer: PREPACKING_DONT_KNOW_ANSWER }],
  });
  assert(profile?.assessed_at, "assessed_at set in normalizer");
  assert(typeof profile.coverage === "number", "coverage computed");
  assert(profile.coverage === 67, "coverage 2/3 concepts in quiz");
  const c1 = profile.items.find((i) => i.concept_id === "c1");
  assert(c1?.mastery === "none" && c1.confidence <= 0.2, "dont-know → none low confidence");

  assert(normalizeKnowledgeProfile(null) === null, "null raw → null");
  assert(normalizeKnowledgeProfile({ items: [] }) === null, "empty items → null");

  try {
    normalizeKnowledgeProfile({ items: [{ mastery: "full" }] });
    assert(false, "missing concept_id should throw");
  } catch (e) {
    assert(String(e.message).includes("concept_id"), "invalid profile item");
  }

  const badMastery = normalizeKnowledgeProfile({
    items: [{ concept_id: "c9", mastery: "expert", confidence: 2 }],
  });
  assert(badMastery.items[0].mastery === "none", "edge: invalid mastery coerced");
  assert(badMastery.items[0].confidence <= 1, "edge: confidence clamped");
}

// ── T04: pack invariants ──
section("T04 pack invariants");
{
  const inventory = [...sampleInventory];
  const blockIndex = [{ id: 1, title: "Overview: T", summary: "S", chunk: "" }];
  const ok = validatePackInvariants({
    conceptInventory: inventory,
    blockIndex,
    requested_n: 8,
    knowledgeProfile: null,
    splitRunMeta: {
      concept_inventory: inventory,
      profile_applied: false,
    },
  });
  assert(ok.ok, "pack without profile invariants ok");

  const withProfile = validatePackInvariants({
    conceptInventory: inventory,
    blockIndex,
    requested_n: 8,
    knowledgeProfile: { items: [{ concept_id: "c1", mastery: "full", confidence: 0.9 }] },
    splitRunMeta: {
      concept_inventory: inventory,
      profile_applied: true,
    },
  });
  assert(withProfile.ok, "pack with profile invariants ok");

  const tooMany = validatePackInvariants({
    conceptInventory: inventory,
    blockIndex: new Array(10).fill(null).map((_, i) => ({ id: i + 1 })),
    requested_n: 8,
    splitRunMeta: { concept_inventory: inventory, profile_applied: false },
  });
  assert(!tooMany.ok, "failure: blockIndex > requested_n");

  const invChanged = validatePackInvariants({
    conceptInventory: inventory,
    blockIndex,
    requested_n: 8,
    splitRunMeta: { concept_inventory: inventory.slice(0, 1), profile_applied: false },
  });
  assert(!invChanged.ok, "failure: inventory length changed in meta");

  const wrongFlag = validatePackInvariants({
    conceptInventory: inventory,
    blockIndex,
    requested_n: 8,
    knowledgeProfile: { items: [] },
    splitRunMeta: { concept_inventory: inventory, profile_applied: false },
  });
  assert(!wrongFlag.ok, "failure: profile_applied mismatch");
}

// ── T05/T08: orchestration smoke ──
section("T05/T08 flag gate smoke");
assert(typeof isPrePackingAssessmentEnabled === "function", "flag helper exported");
assert(PREPACKING_DONT_KNOW_ANSWER === "I don't know", "dont-know UI constant");

console.log(`\n${"=".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
