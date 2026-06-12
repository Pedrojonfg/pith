/**
 * RSVP Pipeline Levers — T20 closure suite
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260617_pipeline-levers.mjs
 */
import {
  resolveBlockQuestionConfig,
  findDeterministicDuplicateMerges,
  buildQuestionScopeContext,
  ensureSessionPipelineLevers,
  ensureSessionCoverageManifest,
  appendCoverageClaims,
  replaceCoverageForBlock,
} from "../src/js/session.js";
import {
  computeEstimatedConceptTarget,
  isZeroQuestionBlockTitle,
  deriveBlockType,
  extractClaimsFromQuestions,
  initPipelineLevers,
  resolveNextStudyBlockIndex,
} from "../src/js/pipeline-levers.js";
import { renderCoverageManifestForPrompt } from "../src/js/coverage-manifest.js";
import {
  buildConceptInventoryPrompt,
  buildQuestionScopePromptSection,
  buildQuestionsOnlySystemPrompt,
} from "../src/js/api.js";
import { validateBlockFidelity } from "../src/js/fidelity-validation.js";
import {
  hasDelimiterHeadings,
  buildDelimiterHierarchy,
} from "../src/js/normalization/hierarchy.js";
import { state } from "../src/js/session.js";

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

section("T01 Key terms zero questions");
const prevSession = state.activeSession;
state.activeSession = {
  n_test: 2,
  n_socratic: 1,
  blocks: [{ title: "Key terms: Utilitarismo" }, { title: "Development: Singer" }],
};
assert(resolveBlockQuestionConfig(0).n_test === 0, "Key terms n_test=0");
assert(resolveBlockQuestionConfig(0).n_socratic === 0, "Key terms n_socratic=0");
assert(resolveBlockQuestionConfig(1).n_test === 2, "development keeps n_test");
state.activeSession = {
  n_test: 2,
  blocks: [{ title: "Overview: Ethics" }],
};
assert(resolveBlockQuestionConfig(0).n_test === 0, "Overview n_test=0");
state.activeSession = prevSession;

section("T02 dedup threshold strict");
const dedupBlocks = [
  { id: 1, title: "Block A", signature: ["alpha", "beta", "gamma"] },
  { id: 2, title: "Block B", signature: ["alpha", "beta", "delta"] },
];
state.activeSession = { _meta: { source_fidelity_mode: "strict" } };
const mergesStrict = findDeterministicDuplicateMerges([
  { id: 1, title: "A", signature: ["termone", "termtwo", "termthree"] },
  { id: 2, title: "B", signature: ["termone", "termtwo", "termfour"], concept_ids: ["c1"] },
]);
assert(
  mergesStrict.some((m) => m.reason === "concept_signature_overlap" || m.reason === "signature_overlap"),
  "strict merge with 2 shared terms",
);
state.activeSession = { _meta: { source_fidelity_mode: "standard" } };
const mergesNormal = findDeterministicDuplicateMerges([
  { id: 1, title: "A", signature: ["termone", "termtwo", "termthree"] },
  { id: 2, title: "B", signature: ["termone", "termtwo", "termfour"] },
]);
assert(mergesNormal.length === 0, "normal mode needs 3 terms for merge");
state.activeSession = prevSession;

section("T04 inventory density");
assert(computeEstimatedConceptTarget(15000) === 100, "15k words → target 100");
assert(computeEstimatedConceptTarget(5000) === 34, "5k words → target 34");
assert(computeEstimatedConceptTarget(500) === 30, "500 words → floor 30");
const invPrompt = buildConceptInventoryPrompt("English", { wordCount: 15000, estimatedConceptTarget: 100 });
assert(invPrompt.includes("15000"), "inventory prompt includes word count");
assert(invPrompt.includes("100"), "inventory prompt includes target");

section("T03/T09 coverage manifest");
const emptyRender = renderCoverageManifestForPrompt([]);
assert(emptyRender.includes("(none yet)"), "empty manifest renders");
const claims = extractClaimsFromQuestions(1, [
  { type: "test", question: '¿Qué es "utilitarismo"?' },
]);
assert(claims.length >= 1, "extract claims from question");
let manifest = [];
manifest = appendCoverageClaims(manifest, claims);
assert(manifest.length >= 1, "manifest append");
manifest = replaceCoverageForBlock(manifest, 1, [{ blockId: 1, claimType: "definition", keyTerms: ["x"], questionAsked: "q" }]);
assert(manifest.filter((c) => c.blockId === 1).length === 1, "replace block claims");

section("T05 question scope");
const blockIndexArr = [
  { id: 1, title: "Overview: Course", signature: [] },
  { id: 2, title: "Key terms: Ethics", signature: ["deontology", "utilitarianism"] },
  { id: 3, title: "Singer argument", signature: ["pond"], module: "Ethics" },
];
const scope = buildQuestionScopeContext(2, blockIndexArr, [], []);
assert(scope.block_type === "development", "development block type");
assert(scope.precedingKeyTermsSignature.length >= 1, "preceding key terms signature");
const scopePrompt = buildQuestionScopePromptSection(scope, 2);
assert(scopePrompt.includes("FORBIDDEN"), "scope prompt has FORBIDDEN");

section("T10 delimiters");
const plain = "❖ Utilitarismo\nText\n➔ Singer\nMore";
assert(hasDelimiterHeadings(plain), "detect delimiter headings");
const tree = buildDelimiterHierarchy(plain);
assert(tree.length >= 1, "delimiter hierarchy roots");

section("T14 linear skip");
const seqBlocks = [
  { id: 1, title: "Overview: X", study_sequence: true },
  { id: 2, title: "Key terms: M", study_sequence: false },
  { id: 3, title: "Dev block", study_sequence: true },
];
assert(resolveNextStudyBlockIndex(0, seqBlocks, 3) === 2, "skip key terms from 0→2");

section("T19 pipeline levers defaults");
const strictLevers = initPipelineLevers(true);
assert(strictLevers.dedupSignatureOverlapThreshold === 2, "strict dedup default 2");
assert(strictLevers.claimCoverageMin === 0.6, "strict claim coverage 0.6");

section("T08 claim coverage");
const val = validateBlockFidelity({
  blockTitle: "Test",
  chunk: "The categorical imperative requires universalizable maxims for moral agents in Kantian ethics.",
  explanation: "Kant argues agents must act only on maxims they can will as universal law.",
  extractedClaims: [
    { text: "universalizable maxims", terms: ["universalizable"] },
    { text: "completely unrelated quantum foam dynamics", terms: ["quantum"] },
  ],
  strictMode: true,
});
assert(val.claimCoverageRatio < 1, "partial claim coverage computed");
assert(val.chunk_coverage >= 0, "chunk_coverage present");

section("T06 already questioned in prompt");
const qPrompt = buildQuestionsOnlySystemPrompt({
  language: "English",
  n_test: 2,
  n_socratic: 0,
  blockIndex: 2,
  questionScope: {
    block_type: "development",
    allowed: ["application"],
    forbidden: ["definition"],
    alreadyQuestionedTerms: ["utilitarianism", "deontology"],
    precedingKeyTermsSignature: [],
  },
});
assert(qPrompt.includes("utilitarianism"), "already questioned terms in prompt");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
