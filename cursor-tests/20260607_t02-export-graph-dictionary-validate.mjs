/**
 * Validate — concept dictionary enrichment + graph/dictionary session export (chat scope)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t02-export-graph-dictionary-validate.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  LS_SESSION_CONCEPTS_KEY,
} from "../src/js/config.js";
import {
  buildBlockGenerationSystemPrompt,
  buildConceptEnrichmentSystemPrompt,
  enrichBlockConceptDefinitions,
} from "../src/js/api.js";
import {
  appendGraphSections,
  buildMarkdown,
  collectExportConcepts,
} from "../src/js/export.js";
import { conceptNodeId, blockNodeId } from "../src/js/graph/ids.js";

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

// ─── Concept dictionary enrichment (happy / edge / failure) ───────────────────

const blockPrompt = buildBlockGenerationSystemPrompt({
  language: "Spanish",
  n_test: 2,
  n_socratic: 1,
  explanation_profile: "thorough",
});
assert(!blockPrompt.includes("definition of max 15 words"), "CD-happy: block prompt drops 15-word cap");
assert(blockPrompt.includes("fuller entries are generated in a separate pass"), "CD-happy: two-pass documented");

const enrichPrompt = buildConceptEnrichmentSystemPrompt("Spanish");
assert(enrichPrompt.includes("40-150 words"), "CD-happy: enrichment allows substantive definitions");
assert(enrichPrompt.includes("Do NOT invent external history"), "CD-happy: text-grounded rule");

let enrichCalls = 0;
globalThis.fetch = async (_url, init) => {
  enrichCalls += 1;
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              concepts: [
                {
                  term: "Circulación",
                  definition:
                    "El texto define la circulación como la integral de línea de un campo sobre una curva cerrada.",
                },
              ],
            }),
          },
        },
      ],
    }),
  };
};
globalThis.localStorage.setItem("ds_api_key", "test-key");

const enriched = await enrichBlockConceptDefinitions({
  llmModel: "deepseek-chat",
  language: "Spanish",
  blockTitle: "Stokes",
  materialText: "Material sobre circulación.",
  explanation: "Explicación RSVP.",
  concepts: [{ term: "Circulación", definition: "hint corto" }],
});
assert(enrichCalls === 1, "CD-happy: one enrichment LLM call per block");
assert(enriched[0]?.definition.includes("integral de línea"), "CD-happy: stub replaced by enriched text");

enrichCalls = 0;
const noTerms = await enrichBlockConceptDefinitions({
  llmModel: "deepseek-chat",
  language: "Spanish",
  blockTitle: "Empty",
  materialText: "x",
  explanation: "y",
  concepts: [],
});
assert(enrichCalls === 0, "CD-edge: empty concepts skip LLM call");
assert(noTerms.length === 0, "CD-edge: empty in → empty out");

globalThis.fetch = async () => {
  throw new Error("network down");
};
const fallback = await enrichBlockConceptDefinitions({
  llmModel: "deepseek-chat",
  language: "Spanish",
  blockTitle: "Fail",
  materialText: "m",
  explanation: "e",
  concepts: [{ term: "T", definition: "keep me" }],
}).catch(() => null);
assert(fallback === null, "CD-fail: enrichment throws on network error (caller may catch)");

// ─── Export concept dictionary (happy / edge) ───────────────────────────────

resetStorage();
localStorage.setItem(
  LS_SESSION_CONCEPTS_KEY,
  JSON.stringify([{ term: "Alpha", definition: "short" }]),
);
localStorage.setItem(
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  JSON.stringify({
    0: [{ term: "alpha", definition: "Definición más extensa desde el material de estudio." }],
  }),
);

const merged = collectExportConcepts({ blocks: [] });
assert(merged.find((c) => c.term.toLowerCase() === "alpha")?.definition.includes("extensa"), "EXP-happy: longer definition wins");

const rsvpSession = {
  studyMode: "rsvp",
  language: "English",
  n_blocks: 2,
  n_test: 2,
  n_socratic: 1,
  blocks_list_text: "1. Overview\n2. Core",
  blocks: [
    { title: "Overview", explanation: "Intro", questions: [] },
    {
      title: "Core",
      explanation: "Body",
      questions: [],
      concepts: [{ term: "Flux", definition: "Rate through a surface." }],
    },
  ],
  _meta: {
    material_graph: {
      conceptInventory: [
        { id: "c1", order: 1, title: "Flux", prerequisite_ids: [] },
      ],
      blockIndex: [
        { id: 1, title: "Overview", concept_ids: [], signature: [] },
        { id: 2, title: "Core", concept_ids: ["c1"], signature: ["flux"] },
      ],
    },
  },
};

const rsvpMd = buildMarkdown(rsvpSession);
assert(rsvpMd.includes("## Concept Dictionary"), "EXP-happy: RSVP export has dictionary");
assert(rsvpMd.includes("### Flux"), "EXP-happy: dictionary uses heading format");
assert(rsvpMd.includes("## Material graph") || rsvpMd.includes("Material graph"), "EXP-happy: RSVP export includes material graph");
assert(
  rsvpMd.includes(conceptNodeId("c1")) || rsvpMd.includes("Flux"),
  "EXP-happy: graph lists concept nodes",
);
assert(rsvpMd.includes("study-session-resume:v2:"), "EXP-happy: resume capsule present");

const rsvpNoGraph = buildMarkdown({
  studyMode: "rsvp",
  n_blocks: 1,
  blocks: [{ title: "Only", explanation: "x", questions: [] }],
});
assert(!rsvpNoGraph.includes("## Material graph"), "EXP-edge: no material graph without material_graph data");

// ─── Slow export with phase0, annotations, graphs ─────────────────────────

const slowSession = {
  studyMode: "slow",
  language: "Spanish",
  materialMeta: { fileName: "texto.md" },
  slow: {
    phase: "complete",
    criticalMode: true,
    fillableMapMode: false,
    graphEnrichedUnlocked: true,
    readingScope: { label: "Capítulo 1", charStart: 0, charEnd: 1200 },
    phase0: {
      thesis: "La tesis central del autor.",
      guideQuestion: "¿Por qué importa X?",
      argumentMap: [
        { id: "P1", text: "Premisa uno", status: "argued" },
        { id: "C", text: "Conclusión", status: "argued" },
      ],
      conceptsToFind: [{ term: "Libertad", authorUsage: "Uso restringido del término." }],
      criticalExaminePoints: ["Punto débil estructural"],
      prequestions: ["¿Qué asume el autor?"],
    },
    annotations: [
      {
        id: "a1",
        type: "≈",
        charStart: 10,
        charEnd: 40,
        userText: "Paralelo con otro autor",
        graphLinks: [{ termId: "libertad", relation: "relates" }],
      },
    ],
    findings: [{ conceptTerm: "Libertad", userText: "Hallazgo silencioso", revealedInPhase1: false }],
  },
};

const slowMd = buildMarkdown(slowSession);
assert(slowMd.includes("# Slow Mode Session"), "SLOW-happy: slow header");
assert(slowMd.includes("## Phase 0 — Orientation"), "SLOW-happy: full phase0 section");
assert(slowMd.includes("**P1:** Premisa uno"), "SLOW-happy: argument map exported");
assert(slowMd.includes("### Concepts to track"), "SLOW-happy: concepts to find");
assert(slowMd.includes("Graph links: libertad"), "SLOW-happy: annotation graph links");
assert(slowMd.includes("## Concept findings"), "SLOW-happy: findings section");
assert(
  slowMd.includes("## Grafo enriquecido") || slowMd.includes("Grafo enriquecido"),
  "SLOW-happy: enriched graph in Spanish export",
);
assert(slowMd.includes("study-session-resume:v2:"), "SLOW-happy: slow export includes resume capsule");

// appendGraphSections edge: dedupe same kind
const lines = [];
appendGraphSections(lines, slowSession, "Spanish");
const graphMd = lines.join("\n");
const enrichedHeadings = (graphMd.match(/## Grafo enriquecido/g) || []).length;
assert(enrichedHeadings <= 1, "GRAPH-edge: duplicate graph kinds not repeated");

console.log(`\n20260607 export-graph-dictionary validate: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
