/**
 * Export format v3 — validation
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t03-export-format-v3.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "../src/js/config.js";
import {
  appendGraphSections,
  buildMarkdown,
  formatAssessmentGapsExportSection,
} from "../src/js/export.js";
import {
  buildExportFrontmatter,
  extractTopTensions,
  formatGraphEdgeMarkdown,
  inferErrorType,
  isTestResponseIncorrect,
} from "../src/js/export-format.js";
import { buildSlowEnrichedGraphFromInputs } from "../src/js/graph/build.js";

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

resetStorage();
globalThis.window = globalThis.window || {};
globalThis.window.guideHistory = [];

// ─── Frontmatter (happy / edge) ─────────────────────────────────────────────

const fmSlow = buildExportFrontmatter(
  {
    studyMode: "slow",
    language: "Spanish",
    materialMeta: { fileName: "economia-coordinacion-cap3.md" },
    _meta: { session_id: "sample-slow-001", duration_min: 47 },
    slow: {
      criticalMode: true,
      readingScope: { label: "Capítulo 3", charStart: 0, charEnd: 4200 },
    },
  },
  { mode: "slow" },
);
assert(fmSlow.startsWith("---\n"), "FM-happy: YAML opens with ---");
assert(fmSlow.includes("mode: slow"), "FM-happy: slow mode");
assert(fmSlow.includes("session_id: sample-slow-001"), "FM-happy: session_id");
assert(fmSlow.includes("critical: true"), "FM-happy: critical flag");
assert(fmSlow.includes("duration_min: 47"), "FM-happy: duration");
assert(fmSlow.includes("language: es"), "FM-happy: language es");

const fmFast = buildExportFrontmatter(
  { studyMode: "rsvp", language: "English", _meta: { session_id: "x" } },
  { mode: "fast" },
);
assert(fmFast.includes("mode: fast"), "FM-happy: fast mode");
assert(!fmFast.includes("scope:"), "FM-edge: fast omits scope");
assert(!fmFast.includes("critical:"), "FM-edge: fast omits critical");

// ─── Graph edge families (happy / failure) ───────────────────────────────────

const edgeLine = formatGraphEdgeMarkdown("a", "b", "requires", "Spanish");
assert(edgeLine.includes("requires · epistémica"), "EDGE-happy: requires maps to epistemic family");

const supportLine = formatGraphEdgeMarkdown("u1", "arg:P1", "supports", "English");
assert(supportLine.includes("supports · argumentative"), "EDGE-happy: supports argumentative");

const legacyLine = formatGraphEdgeMarkdown("u1", "arg:P1", "refuta", "English");
assert(legacyLine.includes("argumentative"), "EDGE-edge: legacy refuta still maps");

// ─── Enriched graph uses supports/contradicts/instantiates ─────────────────

const enriched = buildSlowEnrichedGraphFromInputs({
  textConcepts: [{ termId: "coordination", term: "Coordination" }],
  argumentMap: [{ id: "P1", text: "Premise" }],
  annotations: [
    {
      id: "a1",
      type: "⊘",
      charStart: 100,
      charEnd: 120,
      userText: "Objeción concreta",
    },
    {
      id: "a2",
      type: "≈",
      charStart: 200,
      charEnd: 220,
      userText: "Ejemplo concreto",
      graphLinks: [{ termId: "coordination" }],
    },
  ],
  scopeText: "Premise in text " + "x".repeat(200),
});
const edgeTypes = enriched.edges.map((e) => e.type);
assert(edgeTypes.includes("contradicts"), "GRAPH-happy: ⊘ yields contradicts edge");
assert(edgeTypes.includes("instantiates"), "GRAPH-happy: ≈ link yields instantiates");

// ─── Fast export v3 sections ───────────────────────────────────────────────

localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "Flux", definition: "Flow rate." }]),
);

const fastSession = {
  studyMode: "rsvp",
  language: "Spanish",
  n_blocks: 1,
  n_test: 2,
  n_socratic: 1,
  blocks_list_text: "1. Block",
  materialMeta: { fileName: "vectors.md" },
  _meta: {
    session_id: "sample-fast-001",
    duration_min: 32,
    student_synthesis: "Repaso de campos vectoriales antes del parcial.",
    assessment: {
      max_questions: 2,
      penalised_total: 1,
      pct: 50,
      strong_blocks: [],
      weak_blocks: [1],
      config_adjustments_applied: true,
      gaps_by_block: {
        1: [{ label: "Stokes formal", source: "llm", review_priority: "high" }],
      },
    },
    material_graph: {
      conceptInventory: [{ id: "c1", order: 1, title: "Flux", prerequisite_ids: [] }],
      blockIndex: [{ id: 1, title: "Block", concept_ids: ["c1"], signature: ["flux"] }],
    },
  },
  blocks: [
    {
      title: "Block",
      explanation: "Body",
      questions: [
        { type: "test", question: "Si φ=x², ¿∇φ en (1,0)?" },
        { type: "test", question: "¿Qué es flujo?" },
        { type: "socratic", question: "¿Por qué importa orientación?", socratic_mode: "guided" },
      ],
    },
  ],
  _responses: {
    blocks: {
      0: {
        questions: {
          0: {
            user_answer: "B",
            correct_answer: "A",
            feedback: "Revisa el cálculo: ∇φ = (2x, 0).",
            answered_at: "2026-06-07T10:23:15.000Z",
            error_type: "calculation_error",
          },
          1: {
            user_answer: "A",
            correct_answer: "A",
            feedback: "Correcto.",
            answered_at: "2026-06-07T10:24:01.000Z",
          },
          2: {
            user_answer: "Porque define el signo del flujo.",
            feedback: "Buena intuición.",
            answered_at: "2026-06-07T10:25:00.000Z",
            socratic_mode: "guided",
          },
        },
      },
    },
  },
};

const fastMd = buildMarkdown(fastSession);
assert(fastMd.startsWith("---\n"), "FAST-happy: frontmatter first");
assert(fastMd.includes("mode: fast"), "FAST-happy: mode in frontmatter");
assert(!fastMd.includes("## Session Plan"), "FAST-happy: Session Plan removed");
assert(!fastMd.includes("## Missed questions"), "FAST-happy: Missed questions removed");
assert(fastMd.includes("**answered_at:** 2026-06-07T10:23:15.000Z"), "FAST-happy: answered_at on question");
assert(fastMd.includes("- error_type: calculation_error"), "FAST-happy: error_type on wrong test Q");
assert(fastMd.includes("- socratic_mode: guided"), "FAST-happy: socratic_mode flag");
assert(fastMd.includes("review_priority: high"), "FAST-happy: gap review_priority");
assert(fastMd.includes("## Student synthesis"), "FAST-happy: student synthesis section");
assert(
  fastMd.includes("<!-- source-of-truth: resume-blob + material file | this markdown is render-only -->"),
  "FAST-happy: source-of-truth comment",
);
assert(fastMd.includes("<!-- graph-section -->"), "FAST-happy: graph delimiter");
assert(
  /· (epistémica|didáctica|semántica|argumentativa)/.test(fastMd),
  "FAST-happy: edge family in graph",
);
assert(fastMd.includes("study-session-resume:v2:"), "FAST-invariant: resume blob preserved");

// ─── Slow export v3 ────────────────────────────────────────────────────────

const slowSession = {
  studyMode: "slow",
  language: "Spanish",
  materialMeta: { fileName: "economia-coordinacion-cap3.md" },
  _meta: {
    session_id: "sample-slow-001",
    student_synthesis: "La verificación de información es el eje del capítulo.",
  },
  slow: {
    phase: "complete",
    criticalMode: true,
    graphEnrichedUnlocked: true,
    readingScope: { label: "Capítulo 3", charStart: 0, charEnd: 4200 },
    phase0: { thesis: "Tesis", guideQuestion: "Q?" },
    annotations: [
      {
        id: "o1",
        type: "⊘",
        charStart: 640,
        charEnd: 710,
        userText: "Inferencia causal no justificada",
      },
      {
        id: "s1",
        type: "⇑",
        charStart: 1120,
        charEnd: 1210,
        userText: "Marco predictivo útil",
      },
      { id: "t1", type: "↯", charStart: 780, charEnd: 830, userText: "Optimismo normativo vs datos" },
    ],
    findings: [
      {
        conceptTerm: "Coordination failure",
        userText: "Hallazgo",
        revealedInPhase1: false,
        review_priority: "medium",
      },
    ],
  },
};

const slowMd = buildMarkdown(slowSession);
assert(slowMd.includes("mode: slow"), "SLOW-happy: slow frontmatter");
assert(slowMd.includes("## Top tensions"), "SLOW-happy: top tensions section");
assert(slowMd.includes("⊘ [640–710]"), "SLOW-happy: tension cites offsets");
assert(!slowMd.includes("## Grafo de material"), "SLOW-happy: no duplicate phase0 material graph");
assert(slowMd.includes("## Grafo enriquecido"), "SLOW-happy: enriched graph only");
assert(slowMd.includes("review_priority: medium"), "SLOW-happy: finding review_priority");

const tensions = extractTopTensions(slowSession.slow.annotations, { max: 3 });
assert(tensions.length >= 1, "TENSION-happy: extracts at least one");
assert(tensions.some((l) => l.includes("⊘") || l.includes("↯")), "TENSION-happy: critical types present");

// appendGraphSections: slow without enriched → no graph
const slowNoGraphLines = [];
appendGraphSections(slowNoGraphLines, { studyMode: "slow", slow: { phase0: { thesis: "x" } } }, "English");
assert(slowNoGraphLines.length === 0, "GRAPH-edge: slow without enriched emits no graph");

// ─── inferErrorType / isTestResponseIncorrect ──────────────────────────────

assert(isTestResponseIncorrect({ user_answer: "B", correct_answer: "A" }), "ERR-happy: detects wrong MC");
assert(!isTestResponseIncorrect({ user_answer: "A", correct_answer: "A" }), "ERR-fail: correct not flagged");
assert(
  inferErrorType({ feedback: "Revisa el cálculo" }, "∇φ") === "calculation_error",
  "ERR-happy: infers calculation_error",
);
assert(
  inferErrorType({ error_type: "formula_recall" }, "") === "formula_recall",
  "ERR-edge: stored error_type wins",
);

// formatAssessmentGapsExportSection
const gapLines = formatAssessmentGapsExportSection(
  {
    gaps_by_block: { 2: [{ label: "Gap A", source: "llm" }] },
    weak_blocks: [2],
  },
  { titleMap: { 2: "Title" }, nBlocks: 2 },
);
assert(gapLines.some((l) => l.includes("review_priority: high")), "GAP-happy: weak block gap high priority");

console.log(`\n20260607 export-format-v3: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
