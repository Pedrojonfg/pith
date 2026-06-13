/**
 * Post A+ T07 — declarative/procedural mastery dimensions
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t07.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  DECLARATIVE_WEIGHT,
  OBSERVATION_WEIGHTS,
  PROCEDURAL_WEIGHT,
  getCurrentMastery,
  getDimensionMastery,
  resolveTaskKind,
  updateMastery,
  updateMasteryDimension,
} from "../src/js/vault/mastery-model.js";
import { applyObservations, collectObservations } from "../src/js/vault/session-close.js";

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

function makeEntry(overrides = {}) {
  const now = Date.now();
  return {
    id: "e1",
    canonicalTitle: "Concept",
    aliases: [],
    topic: "math",
    masteryBase: 0.5,
    masteryLastUpdated: now,
    masteryDeclarativeBase: 0.5,
    masteryProceduralBase: 0.5,
    masteryDeclarativeLastUpdated: now,
    masteryProceduralLastUpdated: now,
    lastSeen: now,
    sources: [],
    prerequisites: [],
    dependents: [],
    observations: [],
    ...overrides,
  };
}

resetStorage();

// --- resolveTaskKind (happy / edge) ---

assert(resolveTaskKind({ type: "mcq_correct" }) === "declarative", "happy: mcq → declarative");
assert(resolveTaskKind({ type: "socratic_passed" }) === "procedural", "happy: socratic → procedural");
assert(resolveTaskKind({ type: "cloze_wrong" }) === "declarative", "happy: cloze → declarative");
assert(
  resolveTaskKind({ type: "mcq_correct", questionKind: "application" }) === "procedural",
  "happy: application MCQ → procedural",
);
assert(resolveTaskKind({ type: "mcq_wrong", taskKind: "procedural" }) === "procedural", "edge: explicit taskKind wins");

// --- updateMasteryDimension (happy) ---

const declarativeOnly = makeEntry({ masteryProceduralBase: undefined, masteryProceduralLastUpdated: undefined });
const procBefore = Number(declarativeOnly.masteryBase) || 0.5;
updateMasteryDimension(declarativeOnly, "declarative", 0.6, Date.now());
assert(
  declarativeOnly.masteryDeclarativeBase > 0.5,
  "happy: declarative dimension increases on positive signal",
);
assertClose(
  declarativeOnly.masteryProceduralBase,
  procBefore,
  "happy: procedural base unchanged by declarative-only signal",
);

const dual = makeEntry();
const beforeProc = dual.masteryProceduralBase;
updateMasteryDimension(dual, "declarative", OBSERVATION_WEIGHTS.mcq_correct, Date.now());
assert(dual.masteryDeclarativeBase > 0.5, "happy: declarative update on dual entry");
assertClose(dual.masteryProceduralBase, beforeProc, "happy: procedural unchanged by declarative update");

// --- updateMastery routes dimensions (happy) ---

const routed = makeEntry({ masteryDeclarativeBase: 0.3, masteryProceduralBase: 0.7 });
updateMastery(routed, { type: "mcq_correct", timestamp: Date.now(), docId: "d1" });
assert(
  routed.masteryDeclarativeBase > 0.3,
  "happy: definition MCQ updates declarative mastery",
);
assertClose(routed.masteryProceduralBase, 0.7, "happy: procedural stays flat on declarative MCQ");

const applied = makeEntry({ masteryDeclarativeBase: 0.8, masteryProceduralBase: 0.2 });
updateMastery(applied, { type: "socratic_passed", timestamp: Date.now(), docId: "d1" });
assert(applied.masteryProceduralBase > 0.2, "happy: socratic updates procedural mastery");
assertClose(applied.masteryDeclarativeBase, 0.8, "happy: declarative stays flat on socratic");

assert(
  routed.observations.at(-1)?.taskKind === "declarative",
  "happy: observation stores taskKind",
);
assert(
  applied.observations.at(-1)?.taskKind === "procedural",
  "happy: socratic observation tagged procedural",
);

// --- getCurrentMastery weighted blend (happy / edge) ---

const weighted = makeEntry({
  masteryDeclarativeBase: 0.8,
  masteryProceduralBase: 0.2,
  masteryDeclarativeLastUpdated: Date.now(),
  masteryProceduralLastUpdated: Date.now(),
});
const expectedWeighted = DECLARATIVE_WEIGHT * 0.8 + PROCEDURAL_WEIGHT * 0.2;
assertClose(getCurrentMastery(weighted), expectedWeighted, "happy: weighted 0.4 declarative + 0.6 procedural");
assertClose(
  getDimensionMastery(weighted, "declarative"),
  0.8,
  "happy: getDimensionMastery declarative",
);
assertClose(
  getDimensionMastery(weighted, "procedural"),
  0.2,
  "happy: getDimensionMastery procedural",
);

const legacy = {
  masteryBase: 0.65,
  masteryLastUpdated: Date.now(),
};
assertClose(getCurrentMastery(legacy), 0.65, "edge: legacy entry without dimensions uses masteryBase");

// --- session-close routing (happy) ---

const obs = collectObservations(
  {
    docId: "doc1",
    shared: {
      assessmentSignals: [{ canonicalId: "c1", lastResult: "correct", lastAt: Date.now() }],
    },
    modes: {
      rsvp: {
        blocks: [
          {
            title: "B1",
            concept_ids: ["c2"],
            questions: [
              { type: "test", concept_id: "c2", question: "Define X?" },
              { type: "socratic", concept_id: "c3", question: "Apply X?" },
            ],
          },
        ],
        _responses: {
          blocks: {
            0: {
              questions: {
                0: { user_answer: "a", correct_answer: "a", answered_at: Date.now() },
                1: { user_answer: "solution", is_correct: true, answered_at: Date.now() },
              },
            },
          },
        },
      },
    },
  },
  "rsvp",
  "doc1",
);

const mcqObs = obs.find((o) => o.conceptId === "c2");
const socObs = obs.find((o) => o.conceptId === "c3");
assert(mcqObs?.taskKind === "declarative", "happy: collectObservations tags MCQ declarative");
assert(socObs?.taskKind === "procedural", "happy: collectObservations tags socratic procedural");

const vault = { entries: [makeEntry({ id: "v1" })] };
vault.entries[0].masteryDeclarativeBase = 0.4;
vault.entries[0].masteryProceduralBase = 0.4;
applyObservations(
  vault,
  [
    { conceptId: "c2", type: "mcq_correct", timestamp: Date.now(), docId: "doc1", taskKind: "declarative" },
    {
      conceptId: "c2",
      type: "socratic_passed",
      timestamp: Date.now(),
      docId: "doc1",
      taskKind: "procedural",
    },
  ],
  { c2: "v1" },
);
assert(
  vault.entries[0].masteryDeclarativeBase > 0.4,
  "happy: applyObservations moves declarative dimension",
);
assert(
  vault.entries[0].masteryProceduralBase > 0.4,
  "happy: applyObservations moves procedural dimension",
);
assertClose(
  getCurrentMastery(vault.entries[0]),
  DECLARATIVE_WEIGHT * vault.entries[0].masteryDeclarativeBase +
    PROCEDURAL_WEIGHT * vault.entries[0].masteryProceduralBase,
  "happy: combined mastery reflects weighted blend after applyObservations",
);

// --- failure: invalid entry ---

assert(getCurrentMastery(null) === 0, "failure: null entry → 0 mastery");

console.log(`\n20260619_kv-post-t07: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
