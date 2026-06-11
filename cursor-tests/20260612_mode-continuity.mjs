/**
 * Mode Continuity — cursor tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260612_mode-continuity.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  computeAssessmentWeight,
  extractSignalsFromBlockSession,
  mergeAssessmentSignals,
  prioritizeByAssessmentSignals,
} from "../src/js/assessment-signals.js";
import {
  addConceptsToShared,
  createSession,
  getAssessmentSignals,
  getSession,
  saveActiveSession,
  setActiveSession,
  setUploadMeta,
  syncAssessmentSignalsToShared,
} from "../src/js/session-store.js";
import { validateDocumentSession } from "../src/js/session-types.js";
import {
  buildModeSliceFromShared,
  resolveModeEntryState,
} from "../src/js/mode-bootstrap.js";
import { applyAssessmentPrioritizedOrder } from "../src/js/cloze/study.js";
import { applyModeEntry, syncFlowExitState } from "../src/js/study.js";

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
  assert(a === e, `${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

// --- T01 assessment signals ---

assertEqual(
  computeAssessmentWeight(2, 0, "wrong"),
  3,
  "weight: 2 wrong, last wrong → +1 bonus",
);
assertEqual(
  computeAssessmentWeight(1, 3, "correct"),
  0,
  "weight: correct streak reduces to max(0, …)",
);
assertEqual(
  computeAssessmentWeight(1, 1, "wrong"),
  1.5,
  "weight: balanced counts, last wrong",
);

const sliceWithConceptId = {
  blocks: [
    {
      title: "Block A",
      concept_ids: ["c_alpha", "c_beta"],
      questions: [{ question: "What is alpha?" }, { question: "What is beta?" }],
    },
  ],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: {
            user_answer: "B",
            correct_answer: "A",
            answered_at: "2026-06-11T10:00:00.000Z",
          },
          1: {
            user_answer: "C",
            correct_answer: "C",
            is_correct: true,
            answered_at: "2026-06-11T10:01:00.000Z",
          },
        },
      },
    },
  },
};

const extracted = extractSignalsFromBlockSession(sliceWithConceptId, "rsvp");
assert(extracted.length === 2, "extract: two answered questions");
const wrongSig = extracted.find((s) => s.canonicalId === "c_alpha");
const rightSig = extracted.find((s) => s.canonicalId === "c_beta");
assert(wrongSig && wrongSig.wrongCount === 1 && wrongSig.lastResult === "wrong", "extract: concept_ids[qi] wrong");
assert(rightSig && rightSig.correctCount === 1 && rightSig.lastResult === "correct", "extract: is_correct honored");

const sliceSkipEmpty = {
  blocks: [{ title: "Only title", questions: [{ question: "Q?" }] }],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "  ", correct_answer: "A" },
        },
      },
    },
  },
};
assertEqual(extractSignalsFromBlockSession(sliceSkipEmpty, "questions"), [], "extract: skip empty user_answer");

const sliceTitleFallback = {
  blocks: [{ title: "Photosynthesis", questions: [{ question: "Stem?" }] }],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "x", correct_answer: "y", answered_at: 100 },
        },
      },
    },
  },
};
const titleSignals = extractSignalsFromBlockSession(sliceTitleFallback, "rsvp");
assert(titleSignals.length === 1, "extract: title fallback one signal");
assert(titleSignals[0].canonicalId === "Photosynthesis", "extract: uses block.title as canonicalId");

const sliceSynthetic = {
  blocks: [{ questions: [{ question: "Long question stem for synthetic mapping test" }] }],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "a", correct_answer: "b", answered_at: 200 },
        },
      },
    },
  },
};
const synthetic = extractSignalsFromBlockSession(sliceSynthetic, "rsvp")[0];
assert(synthetic.canonicalId === "block_0_q_0", "extract: synthetic canonicalId");
assert(synthetic.conceptLabel.length > 0, "extract: synthetic conceptLabel from stem");

const sliceCaseInsensitive = {
  blocks: [{ title: "T", questions: [{ question: "Q" }] }],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "  Answer  ", correct_answer: "answer", answered_at: 1 },
        },
      },
    },
  },
};
assert(
  extractSignalsFromBlockSession(sliceCaseInsensitive, "rsvp")[0].lastResult === "correct",
  "extract: case-insensitive trim compare",
);

const merged = mergeAssessmentSignals(
  [
    {
      canonicalId: "c1",
      conceptLabel: "Concept 1",
      blockIndex: 0,
      sourceMode: "rsvp",
      wrongCount: 1,
      correctCount: 0,
      lastResult: "wrong",
      lastAt: 100,
      weight: 2,
    },
  ],
  [
    {
      canonicalId: "c1",
      conceptLabel: "Concept 1",
      blockIndex: 1,
      sourceMode: "questions",
      wrongCount: 0,
      correctCount: 1,
      lastResult: "correct",
      lastAt: 200,
      weight: 0,
    },
  ],
);
assert(merged.length === 1, "merge: single canonicalId");
assert(merged[0].wrongCount === 1 && merged[0].correctCount === 1, "merge: increments counts");
assert(merged[0].lastResult === "correct" && merged[0].lastAt === 200, "merge: latest lastAt wins");
assertEqual(merged[0].weight, computeAssessmentWeight(1, 1, "correct"), "merge: recomputes weight");

const existingForImmutability = [
  {
    canonicalId: "c1",
    conceptLabel: "C1",
    wrongCount: 1,
    correctCount: 0,
    lastResult: "wrong",
    lastAt: 1,
    weight: 2,
    sourceMode: "rsvp",
    blockIndex: 0,
  },
];
const incomingLabel = [
  {
    conceptLabel: "Laguna B",
    canonicalId: "",
    wrongCount: 1,
    correctCount: 0,
    lastResult: "wrong",
    lastAt: 2,
    weight: 2,
    sourceMode: "questions",
    blockIndex: 2,
  },
];
const mergedLabels = mergeAssessmentSignals(existingForImmutability, incomingLabel);
assert(existingForImmutability[0].wrongCount === 1, "merge: does not mutate existing array entries");
assert(mergedLabels.length === 2, "merge: conceptLabel fallback key keeps separate entry");

const items = [
  { id: "i0", canonicalId: "weak_low" },
  { id: "i1", canonicalId: "strong" },
  { id: "i2", canonicalId: "weak_high" },
  { id: "i3", canonicalId: "neutral" },
  { id: "i4", canonicalId: "weak_mid" },
];
const signalSet = [
  {
    canonicalId: "weak_high",
    conceptLabel: "High",
    wrongCount: 3,
    correctCount: 0,
    lastResult: "wrong",
    lastAt: 1,
    weight: 4,
    sourceMode: "rsvp",
    blockIndex: 0,
  },
  {
    canonicalId: "weak_mid",
    conceptLabel: "Mid",
    wrongCount: 2,
    correctCount: 1,
    lastResult: "wrong",
    lastAt: 2,
    weight: 2.5,
    sourceMode: "rsvp",
    blockIndex: 0,
  },
  {
    canonicalId: "weak_low",
    conceptLabel: "Low",
    wrongCount: 1,
    correctCount: 0,
    lastResult: "wrong",
    lastAt: 3,
    weight: 2,
    sourceMode: "rsvp",
    blockIndex: 0,
  },
  {
    canonicalId: "strong",
    conceptLabel: "Strong",
    wrongCount: 0,
    correctCount: 2,
    lastResult: "correct",
    lastAt: 4,
    weight: 0,
    sourceMode: "rsvp",
    blockIndex: 0,
  },
];

const noSignals = prioritizeByAssessmentSignals(items, []);
assertEqual(
  noSignals.map((it) => it.id),
  items.map((it) => it.id),
  "prioritize: no signals preserves order",
);

const prioritized = prioritizeByAssessmentSignals(items, signalSet, { targetWeakRatio: 0.6 });
const prioritizedIds = prioritized.map((it) => it.id);
assert(prioritizedIds[0] === "i2", "prioritize: highest weight weak first");
assert(prioritizedIds[1] === "i4", "prioritize: second weight weak");
assert(prioritizedIds[2] === "i0", "prioritize: third weak fills 60% front (3 of 5)");
const weakInFirstThree = prioritizedIds.slice(0, 3).filter((id) => id.startsWith("i") && id !== "i1" && id !== "i3").length;
assert(weakInFirstThree === 3, "prioritize: ≥60% weak in front segment when enough weak exist");

// --- T02 session store ---

resetStorage();

const t02Markdown = "# Continuity Doc\n\nShared material for bootstrap.";
const t02Session = await createSession(t02Markdown);
assert(t02Session.shared.uploadMeta === null, "T02 createSession: uploadMeta null default");
assert(
  Array.isArray(t02Session.shared.assessmentSignals) &&
    t02Session.shared.assessmentSignals.length === 0,
  "T02 createSession: assessmentSignals empty default",
);
const t02Valid = validateDocumentSession(t02Session);
assert(t02Valid.ok, `T02 createSession validates (${t02Valid.errors.join(", ")})`);

setUploadMeta(t02Session.docId, {
  fileName: "paper.pdf",
  originalFormat: "pdf",
  uploadedAt: "2026-06-11T12:00:00.000Z",
});
const withMeta = getSession(t02Session.docId);
assert(withMeta.shared.uploadMeta?.fileName === "paper.pdf", "T02 setUploadMeta: persists fileName");
assert(
  withMeta.shared.uploadMeta?.originalFormat === "pdf",
  "T02 setUploadMeta: persists originalFormat",
);

const rsvpSliceForSync = {
  blocks: [
    {
      title: "Block A",
      concepts: ["entropy"],
      questions: [{ question: "What is entropy?" }],
    },
  ],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "wrong", correct_answer: "disorder", answered_at: 100 },
        },
      },
    },
  },
};
syncAssessmentSignalsToShared(t02Session.docId, rsvpSliceForSync, "rsvp");
const signalsAfter = getAssessmentSignals(t02Session.docId);
assert(signalsAfter.length === 1, "T02 sync: extracts one wrong signal");
assert(signalsAfter[0].wrongCount === 1, "T02 sync: wrongCount recorded");
assert(signalsAfter[0].sourceMode === "rsvp", "T02 sync: sourceMode rsvp");

rsvpSliceForSync._responses.blocks[0].questions[0] = {
  user_answer: "disorder",
  correct_answer: "disorder",
  answered_at: 200,
};
syncAssessmentSignalsToShared(t02Session.docId, rsvpSliceForSync, "rsvp");
const mergedSignals = getAssessmentSignals(t02Session.docId);
assert(mergedSignals.length === 1, "T02 sync: merges by canonicalId");
assert(mergedSignals[0].correctCount >= 1, "T02 sync: correct answer increments count");

let syncThrew = false;
try {
  syncAssessmentSignalsToShared("missing-doc", {}, "rsvp");
} catch {
  syncThrew = true;
}
assert(syncThrew, "T02 sync: throws when session not found");

// --- T03 mode bootstrap ---

const docBootstrap = {
  docId: "abc123",
  schemaVersion: 2,
  createdAt: 1,
  updatedAt: 1,
  shared: {
    rawMarkdown: t02Markdown,
    docMeta: { titleInferred: "Continuity Doc" },
    docHierarchy: { sections: [] },
    conceptInventory: [],
    annotations: [],
    smItems: [],
    modeRecommendation: null,
    uploadMeta: withMeta.shared.uploadMeta,
    assessmentSignals: [],
  },
  modes: { rsvp: null, slow: null, cloze: null, questions: null },
};

assert(
  resolveModeEntryState(null, "rsvp").kind === "upload_required",
  "T03 resolve: null doc → upload_required",
);
assert(
  resolveModeEntryState(docBootstrap, "rsvp").kind === "bootstrap",
  "T03 resolve: material, no slice → bootstrap",
);

docBootstrap.modes.rsvp = {
  studyMode: "rsvp",
  n_blocks: 2,
  blocks: [{ title: "B1" }, { title: "B2" }],
};
assert(
  resolveModeEntryState(docBootstrap, "rsvp").kind === "resume",
  "T03 resolve: resumable RSVP → resume",
);

docBootstrap.modes.rsvp = { studyMode: "rsvp", n_blocks: 0, blocks: [] };
assert(
  resolveModeEntryState(docBootstrap, "rsvp").kind === "bootstrap",
  "T03 resolve: empty RSVP slice → bootstrap",
);

docBootstrap.modes.slow = { studyMode: "slow", slow: { phase: "reading" } };
assert(
  resolveModeEntryState(docBootstrap, "slow").kind === "resume",
  "T03 resolve: slow with phase → resume",
);

const rsvpShell = buildModeSliceFromShared(docBootstrap, "rsvp");
assert(rsvpShell.studyMode === "rsvp", "T03 build: RSVP shell studyMode");
assert(rsvpShell.n_blocks === 0, "T03 build: RSVP shell no blocks yet");
assert(
  rsvpShell.materialMeta?.fileName === "paper.pdf",
  "T03 build: materialMeta from uploadMeta",
);

const slowSlice = buildModeSliceFromShared(docBootstrap, "slow");
assert(
  slowSlice.slow?.normalizedTextFull?.includes("Shared material"),
  "T03 build: slow uses shared rawMarkdown",
);
assert(slowSlice.docHierarchy?.sections != null, "T03 build: slow copies docHierarchy");

const clozeSlice = buildModeSliceFromShared(docBootstrap, "cloze");
assert(
  clozeSlice.cloze?.normalizedText?.includes("Shared material"),
  "T03 build: cloze uses shared rawMarkdown",
);
assert(clozeSlice.cloze?.pipelineStatus === "normalized", "T03 build: cloze normalized status");

const noMaterialDoc = {
  ...docBootstrap,
  shared: { ...docBootstrap.shared, rawMarkdown: "", rawMarkdownRef: null },
};
delete noMaterialDoc.shared.rawMarkdown;
assert(
  resolveModeEntryState(noMaterialDoc, "cloze").kind === "upload_required",
  "T03 resolve: no rawMarkdown → upload_required",
);

// --- T04 applyModeEntry (study.js wiring) ---

resetStorage();

const t04Markdown = "# Wired Doc\n\nMaterial for continuity entry.";
const t04Doc = await createSession(t04Markdown);
setActiveSession(t04Doc.docId);
setUploadMeta(t04Doc.docId, {
  fileName: "wired.pdf",
  originalFormat: "pdf",
  uploadedAt: "2026-06-11T15:00:00.000Z",
});
const t04Loaded = getSession(t04Doc.docId);

const uploadRequired = applyModeEntry(null, "rsvp");
assert(uploadRequired.action === "upload_required", "T04 applyModeEntry: null doc → upload_required");

const bootstrapEntry = applyModeEntry(t04Loaded, "rsvp", { language: "English" });
assert(bootstrapEntry.action === "bootstrap", "T04 applyModeEntry: bootstrap when material, no slice");
assert(bootstrapEntry.slice?.studyMode === "rsvp", "T04 applyModeEntry: RSVP shell studyMode");
assert(bootstrapEntry.slice?.n_blocks === 0, "T04 applyModeEntry: RSVP shell empty blocks");

const persisted = getSession(t04Doc.docId);
assert(persisted.modes.rsvp != null, "T04 applyModeEntry: persists bootstrap slice to doc");

persisted.modes.rsvp = {
  studyMode: "rsvp",
  n_blocks: 3,
  blocks: [{ title: "A" }, { title: "B" }, { title: "C" }],
};
saveActiveSession(persisted);

const resumeEntry = applyModeEntry(getSession(t04Doc.docId), "rsvp");
assert(resumeEntry.action === "resume", "T04 applyModeEntry: resume when resumable slice");
assert(resumeEntry.slice?.n_blocks === 3, "T04 applyModeEntry: resume returns existing slice");

const freshAfterRsvp = getSession(t04Doc.docId);
const clozeBootstrap = applyModeEntry(freshAfterRsvp, "cloze");
assert(clozeBootstrap.action === "bootstrap", "T04 applyModeEntry: cloze bootstrap when no cloze slice");
assert(
  clozeBootstrap.slice?.cloze?.normalizedText?.includes("Material for continuity"),
  "T04 applyModeEntry: cloze slice uses shared markdown",
);

// --- T05 RSVP/Questions shared sync ---

resetStorage();

const t05Doc = await createSession("# Inventory Doc\n\nEntropy and heat.");
setActiveSession(t05Doc.docId);
addConceptsToShared(t05Doc.docId, [
  { term: "entropy", definition: "Measure of disorder", detectedBy: "rsvp" },
]);
const t05WithInv = getSession(t05Doc.docId);
assert(t05WithInv.shared.conceptInventory.length === 1, "T05: concept inventory in shared");
const detected = t05WithInv.shared.conceptInventory[0].detectedBy;
assert(
  Array.isArray(detected) ? detected.includes("rsvp") : detected === "rsvp",
  "T05: detectedBy includes rsvp",
);

const t05Slice = {
  blocks: [{ title: "entropy", concepts: ["entropy"], questions: [{ question: "What is entropy?" }] }],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: { user_answer: "heat", correct_answer: "disorder", answered_at: 100 },
        },
      },
    },
  },
};
syncAssessmentSignalsToShared(t05Doc.docId, t05Slice, "rsvp");
const t05Signals = getAssessmentSignals(t05Doc.docId);
assert(t05Signals.length === 1, "T05: signal after wrong RSVP answer");
assert(t05Signals[0].wrongCount >= 1, "T05: wrongCount recorded");

let t05NoThrow = true;
try {
  syncAssessmentSignalsToShared(t05Doc.docId, { blocks: [{ title: "x" }], n_blocks: 1 }, "rsvp");
} catch {
  t05NoThrow = false;
}
assert(t05NoThrow, "T05: sync tolerates slice without _responses");

// --- T06 Cloze study order prioritization ---

function mkClozeItem(id, nodeId) {
  return {
    id,
    item_type: "NODE-DEF",
    node_id: nodeId,
    blank_text: nodeId,
    sentence_original: `The concept is ${nodeId}.`,
    sentence_with_blank: "The concept is _____.",
    qa_status: "valid",
    options: [
      { text: "a", is_correct: true },
      { text: "b", is_correct: false },
      { text: "c", is_correct: false },
      { text: "d", is_correct: false },
    ],
  };
}

const clozeSession = {
  studyMode: "cloze",
  cloze: {
    items: [
      mkClozeItem("i0", "strong"),
      mkClozeItem("i1", "weak_high"),
      mkClozeItem("i2", "neutral"),
      mkClozeItem("i3", "weak_mid"),
      mkClozeItem("i4", "weak_low"),
    ],
    studyOrder: null,
  },
};
const clozeDoc = {
  shared: {
    assessmentSignals: [
      {
        canonicalId: "weak_high",
        conceptLabel: "weak_high",
        wrongCount: 4,
        correctCount: 0,
        lastResult: "wrong",
        lastAt: 1,
        weight: 5,
        sourceMode: "rsvp",
        blockIndex: 0,
      },
      {
        canonicalId: "weak_mid",
        conceptLabel: "weak_mid",
        wrongCount: 2,
        correctCount: 0,
        lastResult: "wrong",
        lastAt: 2,
        weight: 3,
        sourceMode: "rsvp",
        blockIndex: 0,
      },
      {
        canonicalId: "weak_low",
        conceptLabel: "weak_low",
        wrongCount: 1,
        correctCount: 0,
        lastResult: "wrong",
        lastAt: 3,
        weight: 2,
        sourceMode: "rsvp",
        blockIndex: 0,
      },
    ],
  },
};

applyAssessmentPrioritizedOrder(clozeSession, clozeDoc);
const studyOrder = clozeSession.cloze.studyOrder || [];
assert(studyOrder.length === 5, "T06: studyOrder length matches items");
const weakIds = new Set(["i1", "i3", "i4"]);
const weakInFront = studyOrder.slice(0, 3).filter((id) => weakIds.has(id)).length;
assert(weakInFront >= 3, "T06: ≥60% weak concepts in first 3 of 5 items");

const noSignalSession = {
  cloze: { items: clozeSession.cloze.items.slice(), studyOrder: null },
};
applyAssessmentPrioritizedOrder(noSignalSession, { shared: { assessmentSignals: [] } });
assert(
  Array.isArray(noSignalSession.cloze.studyOrder) &&
    noSignalSession.cloze.studyOrder.length === 5,
  "T06: no signals still yields studyOrder",
);

// --- T07 flow exit hook smoke ---

resetStorage();
const t07Doc = await createSession("# Flow exit\n\nText.");
setActiveSession(t07Doc.docId);
let t07ExitOk = true;
try {
  syncFlowExitState();
} catch {
  t07ExitOk = false;
}
assert(t07ExitOk, "T07: syncFlowExitState does not throw without active responses");

// --- T08 integration smoke ---

const t08Doc = await createSession("# Smoke\n\nBootstrap material.");
const t08Resolve = resolveModeEntryState(t08Doc, "rsvp");
assert(t08Resolve.kind === "bootstrap", "T08 smoke: resolve bootstrap with doc mock");
const t08Slice = buildModeSliceFromShared(t08Doc, "rsvp");
assert(t08Slice.materialMeta != null, "T08 smoke: bootstrap slice has materialMeta");

console.log(`\n20260612_mode-continuity: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
