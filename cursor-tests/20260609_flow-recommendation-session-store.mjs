/**
 * T05 — session-store modeRecommendation + updateRecommendation
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-session-store.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getSession,
  updateRecommendation,
  validateDocumentSession,
} from "../src/js/session-store.js";

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

const sampleRecommendation = {
  computedAt: Date.now(),
  method: "deterministic",
  analysis: {
    genre: "essay",
    argumentativeDensity: 3,
    conceptualLoad: 2,
    estimatedReadTimeMin: 5,
    genreLabel: "Ensayo",
  },
  primaryFlow: [
    {
      id: "step_slow_1",
      mode: "slow",
      label: "Lectura profunda",
      description: "Lee con atención",
      estimatedTimeMin: 10,
      optional: false,
      completedAt: null,
      skippedAt: null,
    },
  ],
  quickFlow: [
    {
      id: "step_rsvp_1",
      mode: "rsvp",
      label: "RSVP",
      description: "Lectura rápida",
      estimatedTimeMin: 3,
      optional: false,
      completedAt: null,
      skippedAt: null,
    },
  ],
  reasoning: "Texto argumentativo; conviene slow primero.",
  currentStepIndex: 0,
  completedSteps: [],
  userOverride: false,
};

resetStorage();

// createSession defaults modeRecommendation to null
const session = await createSession("# Flow test\n\nTherefore an argument.");
assert(session.shared.modeRecommendation === null, "createSession: modeRecommendation null");

const createV = validateDocumentSession(session);
assert(createV.ok, `createSession validates (${createV.errors.join(", ")})`);

// validateDocumentSession: optional null / absent
const noRec = { ...session, shared: { ...session.shared } };
delete noRec.shared.modeRecommendation;
assert(validateDocumentSession(noRec).ok, "validate: absent modeRecommendation ok");

const nullRec = { ...session, shared: { ...session.shared, modeRecommendation: null } };
assert(validateDocumentSession(nullRec).ok, "validate: null modeRecommendation ok");

// validateDocumentSession: valid recommendation
const withRec = { ...session, shared: { ...session.shared, modeRecommendation: sampleRecommendation } };
assert(validateDocumentSession(withRec).ok, "validate: valid modeRecommendation ok");

// validateDocumentSession: rejects invalid shapes
const badString = { ...session, shared: { ...session.shared, modeRecommendation: "bad" } };
assert(!validateDocumentSession(badString).ok, "validate: rejects non-object");

const badNoFlow = { ...session, shared: { ...session.shared, modeRecommendation: { method: "x" } } };
assert(!validateDocumentSession(badNoFlow).ok, "validate: rejects missing primaryFlow");

const badFlowType = {
  ...session,
  shared: { ...session.shared, modeRecommendation: { primaryFlow: "not-array" } },
};
assert(!validateDocumentSession(badFlowType).ok, "validate: rejects non-array primaryFlow");

// updateRecommendation persists and rehydrates
updateRecommendation(session.docId, sampleRecommendation);
const loaded = getSession(session.docId);
assert(loaded.shared.modeRecommendation?.primaryFlow?.length === 1, "updateRecommendation: persists");
assert(
  loaded.shared.modeRecommendation.primaryFlow[0].mode === "slow",
  "updateRecommendation: primaryFlow content",
);
assert(loaded.shared.rawMarkdown === session.shared.rawMarkdown, "updateRecommendation: rehydrates markdown");

// updateRecommendation unknown docId throws
let threw = false;
try {
  updateRecommendation("nonexistent", sampleRecommendation);
} catch (e) {
  threw = e.message.includes("not found");
}
assert(threw, "updateRecommendation throws for unknown docId");

// saveActiveSession rejects invalid recommendation via validation
let saveThrew = false;
try {
  updateRecommendation(session.docId, { method: "bad" });
} catch (e) {
  saveThrew = e.message.includes("invalid session");
}
assert(saveThrew, "updateRecommendation rejects invalid recommendation");

console.log(`\nT05 flow-recommendation session-store: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
