/**
 * T15 — graph academic genre: nodeType, textGenre, edges, prune, canvas
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t15-graph-academic-genre.mjs
 */
import { JSDOM } from "jsdom";
import { validatePhase0Orientation, NODE_TYPES, TEXT_GENRES } from "../src/js/slow/phase0.js";
import {
  buildSlowEnrichedGraphFromInputs,
  buildSlowPhase0GraphFromInputs,
  collectTextConceptsFromLists,
  pruneOrphanNodes,
  EDGE_TYPES,
} from "../src/js/graph/build.js";
import { EDGE_TYPE_FAMILIES, formatGraphEdgeMarkdown } from "../src/js/export-format.js";
import { renderGraphCanvas } from "../src/js/graph/canvas.js";

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

const basePhase0 = {
  thesis: "La Bildung evoluciona históricamente.",
  guideQuestion: "¿Cómo cambia el concepto?",
  conceptsToFind: [
    { term: "Bildung", authorUsage: "formación integral", nodeType: "CONCEPTO" },
    { term: "Herder", authorUsage: "precursor romántico", nodeType: "PERSONA" },
    {
      term: "Tendencias tecnocráticas",
      authorUsage: "oposición al humanismo",
      nodeType: "EVENTO",
      includes: ["PISA", "estandarización"],
    },
  ],
};

// 1 — GENEALOGÍA → historically_precedes
const genealogia = buildSlowPhase0GraphFromInputs({
  phase0: {
    ...basePhase0,
    textGenre: "GENEALOGÍA",
    argumentMap: [
      { id: "G1", text: "Origen ilustrado", period: "siglo XVIII" },
      { id: "G2", text: "Romanticismo", period: "siglo XIX" },
      { id: "G3", text: "Neohumanismo", period: "siglo XX" },
    ],
  },
});
const geneEdges = genealogia.edges.filter((e) => e.type === "historically_precedes");
assert(geneEdges.length === 2, "T15 #1 happy: GENEALOGÍA has 2 historically_precedes edges");
assert(
  !genealogia.edges.some((e) => e.type === "sequence"),
  "T15 #1 happy: GENEALOGÍA has no sequence edges",
);
assert(
  genealogia.nodes.some((n) => n.label.includes("siglo XVIII")),
  "T15 #1 happy: arg label includes period",
);

// 2 — ARGUMENTO_LINEAL → sequence
const lineal = buildSlowPhase0GraphFromInputs({
  phase0: {
    ...basePhase0,
    textGenre: "ARGUMENTO_LINEAL",
    argumentMap: [
      { id: "P1", text: "Premisa uno", status: "argued" },
      { id: "P2", text: "Premisa dos", status: "argued" },
      { id: "C", text: "Conclusión" },
    ],
  },
});
const seqEdges = lineal.edges.filter((e) => e.type === "sequence");
assert(seqEdges.length === 2, "T15 #2 happy: lineal has 2 sequence edges");
assert(
  !lineal.edges.some((e) => e.type === "historically_precedes"),
  "T15 #2 happy: lineal has no historically_precedes",
);

// edge case — missing textGenre defaults to sequence
const defaultGenre = buildSlowPhase0GraphFromInputs({
  phase0: {
    ...basePhase0,
    argumentMap: [
      { id: "P1", text: "A" },
      { id: "P2", text: "B" },
    ],
  },
});
const defaultMapEdges = defaultGenre.edges.filter(
  (e) => e.from.startsWith("arg:") && e.to.startsWith("arg:"),
);
assert(
  defaultMapEdges.length === 1 && defaultMapEdges[0].type === "sequence",
  "T15 #2 edge: absent textGenre uses sequence between map nodes",
);

// 3 — pruneOrphanNodes
const orphanGraph = {
  nodes: [
    { id: "text:orphan", label: "solo", layer: "text" },
    { id: "user:note", label: "[Pedro:⟷] nota", layer: "user" },
    { id: "text:linked", label: "conectado", layer: "text" },
  ],
  edges: [{ from: "user:note", to: "text:linked", type: "relates" }],
};
const pruned = pruneOrphanNodes(orphanGraph);
assert(
  !pruned.nodes.some((n) => n.id === "text:orphan"),
  "T15 #3 happy: orphan text node removed",
);
assert(
  pruned.nodes.some((n) => n.id === "user:note"),
  "T15 #3 happy: orphan user node kept",
);
const prunedAgain = pruneOrphanNodes(pruned);
assert(
  prunedAgain.nodes.length === pruned.nodes.length,
  "T15 #3 edge: prune is idempotent",
);

// failure-ish — empty graph
const emptyPrune = pruneOrphanNodes({ nodes: [], edges: [] });
assert(emptyPrune.nodes.length === 0, "T15 #3 failure-safe: empty graph stays empty");

// 4 — normalizeConcept nodeType + includes via validatePhase0Orientation
const validated = validatePhase0Orientation({
  textGenre: "GENEALOGÍA",
  thesis: "Tesis genealógica",
  guideQuestion: "¿Cómo evoluciona?",
  argumentMap: [{ id: "G1", text: "Etapa uno", period: "XVIII" }],
  conceptsToFind: [
    { term: "[CONCEPTO] Bildung", authorUsage: "concepto central" },
    { term: "Herder", authorUsage: "autor citado", nodeType: "PERSONA" },
    {
      term: "Cluster",
      authorUsage: "agrupación",
      nodeType: "EVENTO",
      includes: ["PISA", "examen"],
    },
  ],
});
assert(validated?.textGenre === "GENEALOGÍA", "T15 #4 happy: textGenre preserved");
assert(validated?.conceptsToFind[0].nodeType === "CONCEPTO", "T15 #4 happy: prefix parses nodeType");
assert(validated?.conceptsToFind[0].term === "Bildung", "T15 #4 happy: prefix stripped from term");
assert(
  Array.isArray(validated?.conceptsToFind[2].includes) && validated.conceptsToFind[2].includes.length === 2,
  "T15 #4 happy: includes preserved",
);

const invalidGenre = validatePhase0Orientation({
  textGenre: "NO_EXISTE",
  thesis: "T",
  guideQuestion: "Q",
  argumentMap: [{ id: "P1", text: "x" }],
  conceptsToFind: [
    { term: "A", authorUsage: "a" },
    { term: "B", authorUsage: "b" },
    { term: "C", authorUsage: "c" },
  ],
});
assert(
  invalidGenre?.textGenre === "ARGUMENTO_LINEAL",
  "T15 #4 edge: unknown textGenre defaults to ARGUMENTO_LINEAL",
);

const graphFromValidated = buildSlowPhase0GraphFromInputs({ phase0: validated });
const conceptNode = graphFromValidated.nodes.find((n) => n.label.includes("Bildung"));
assert(
  conceptNode?.label === "[CONCEPTO] Bildung",
  "T15 #4 happy: graph label includes nodeType",
);
const clusterNode = graphFromValidated.nodes.find((n) => n.label.includes("Cluster"));
assert(
  Array.isArray(clusterNode?.includes) && clusterNode.includes.includes("PISA"),
  "T15 #4 happy: graph node carries includes",
);

// 5 — formatGraphEdgeMarkdown contrasts_with
const mdEs = formatGraphEdgeMarkdown("a", "b", "contrasts_with", "es");
assert(mdEs.includes("contrasts_with"), "T15 #5 happy: edge type in markdown");
assert(mdEs.includes("argumentativa"), "T15 #5 happy: argumentative family in Spanish");

const mdUnknown = formatGraphEdgeMarkdown("x", "y", "totally_unknown", "en");
assert(mdUnknown.includes("semantic"), "T15 #5 edge: unknown type falls back to semantic family");

// EDGE_TYPES contains new vocabulary
const newTypes = [
  "historically_precedes",
  "reinterprets",
  "constitutes",
  "contrasts_with",
  "influences",
];
for (const t of newTypes) {
  assert(EDGE_TYPES[t] === t, `T15 #5 happy: EDGE_TYPES has ${t}`);
}

// Canvas stroke styles
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='host'></div></body></html>");
const host = dom.window.document.getElementById("host");
const styleGraph = {
  nodes: [
    { id: "a", label: "A", layer: "arg", x: 0, y: 0 },
    { id: "b", label: "B", layer: "arg", x: 0, y: 0 },
    { id: "c", label: "C", layer: "arg", x: 0, y: 0 },
  ],
  edges: [
    { from: "a", to: "b", type: "historically_precedes" },
    { from: "b", to: "c", type: "contrasts_with" },
    { from: "a", to: "c", type: "contradicts" },
  ],
};
renderGraphCanvas(styleGraph, host, { width: 640, height: 400 });
const paths = host.querySelectorAll("path.material-graph-edge");
const byType = new Map();
paths.forEach((p) => byType.set(p.getAttribute("data-edge-type"), p));
assert(
  !byType.get("historically_precedes")?.getAttribute("stroke-dasharray"),
  "T15 #7 happy: historically_precedes is solid",
);
assert(
  byType.get("contrasts_with")?.getAttribute("stroke-dasharray") === "4 4",
  "T15 #7 happy: contrasts_with is dashed",
);
assert(
  byType.get("contradicts")?.getAttribute("stroke-dasharray") === "8 4",
  "T15 #7 happy: contradicts is heavy dashed",
);

// Phase0 graph prunes isolated concept nodes
const withOrphans = buildSlowPhase0GraphFromInputs({
  phase0: {
    ...basePhase0,
    textGenre: "ARGUMENTO_LINEAL",
    argumentMap: [{ id: "P1", text: "solo premisa" }],
  },
});
assert(
  withOrphans.nodes.length === 4 && withOrphans.nodes.filter((n) => n.layer === "text").length === 3,
  "T15 #6 happy: phase0 concepts stay linked to anchor arg node",
);

// 6 — enriched graph prunes orphan text concepts (Scenario C)
const enrichedOrphans = buildSlowEnrichedGraphFromInputs({
  textConcepts: collectTextConceptsFromLists(
    [],
    [
      { term: "huérfano", authorUsage: "sin anotación", nodeType: "CONCEPTO" },
      { term: "conectado", authorUsage: "con anotación", nodeType: "CONCEPTO" },
    ],
  ),
  argumentMap: [],
  annotations: [
    {
      id: "u1",
      type: "⟷",
      charStart: 0,
      charEnd: 5,
      userText: "nota",
      graphLinks: [{ termId: "conectado", relation: "see" }],
    },
  ],
  scopeText: "",
});
assert(
  !enrichedOrphans.nodes.some((n) => n.label.includes("huérfano")),
  "T15 #6 happy: enriched graph prunes orphan text concept",
);
assert(
  enrichedOrphans.nodes.some((n) => n.layer === "user"),
  "T15 #6 happy: enriched graph keeps user node",
);

// 7 — DEBATE author labels + failure invalid nodeType
const debate = buildSlowPhase0GraphFromInputs({
  phase0: {
    ...basePhase0,
    textGenre: "DEBATE",
    argumentMap: [
      { id: "D1", text: "Posición kantiana", author: "Kant" },
      { id: "D2", text: "Posición hegeliana", author: "Hegel" },
    ],
  },
});
assert(
  debate.nodes.some((n) => n.label.includes("(Kant)")),
  "T15 #7 happy: DEBATE arg label includes author",
);
const badNodeType = validatePhase0Orientation({
  thesis: "T",
  guideQuestion: "Q",
  argumentMap: [{ id: "P1", text: "x" }],
  conceptsToFind: [
    { term: "X", authorUsage: "a", nodeType: "ALIEN" },
    { term: "Y", authorUsage: "b" },
    { term: "Z", authorUsage: "c" },
  ],
});
assert(
  badNodeType?.conceptsToFind[0].nodeType === "CONCEPTO",
  "T15 #7 edge: unknown nodeType defaults to CONCEPTO",
);

// 8 — legacy Phase 0 backward compat (no textGenre / nodeType)
const legacy = validatePhase0Orientation({
  thesis: "Economía lineal",
  guideQuestion: "¿Cuál es la tesis?",
  argumentMap: [
    { id: "P1", text: "Premisa", status: "argued" },
    { id: "C", text: "Conclusión" },
  ],
  conceptsToFind: [
    { term: "inflación", authorUsage: "sube precios" },
    { term: "PIB", authorUsage: "producto interno" },
    { term: "oferta", authorUsage: "cantidad vendida" },
  ],
});
assert(legacy?.textGenre === "ARGUMENTO_LINEAL", "T15 #8 happy: legacy defaults textGenre");
assert(
  legacy?.conceptsToFind.every((c) => c.nodeType === "CONCEPTO"),
  "T15 #8 happy: legacy concepts default nodeType",
);
assert(
  validatePhase0Orientation(null) === null,
  "T15 #8 failure: null input returns null",
);

// 9 — EDGE_TYPE_FAMILIES + enums exported
const familyExpectations = {
  historically_precedes: "didactic",
  reinterprets: "semantic",
  constitutes: "semantic",
  influences: "semantic",
  contrasts_with: "argumentative",
};
for (const [type, family] of Object.entries(familyExpectations)) {
  assert(EDGE_TYPE_FAMILIES[type] === family, `T15 #9 happy: ${type} → ${family}`);
}
assert(NODE_TYPES.has("PERSONA"), "T15 #9 happy: NODE_TYPES exported");
assert(TEXT_GENRES.has("GENEALOGÍA"), "T15 #9 happy: TEXT_GENRES exported");

assert(
  formatGraphEdgeMarkdown("g1", "g2", "historically_precedes", "es").includes("didáctica"),
  "T15 #9 happy: historically_precedes export family ES",
);
assert(
  formatGraphEdgeMarkdown("p", "c", "reinterprets", "en").includes("semantic"),
  "T15 #9 happy: reinterprets export family EN",
);

// 10 — canvas colors for new edge types
renderGraphCanvas(
  {
    nodes: [
      { id: "n1", label: "N1", layer: "arg" },
      { id: "n2", label: "N2", layer: "arg" },
    ],
    edges: [
      { from: "n1", to: "n2", type: "influences" },
      { from: "n2", to: "n1", type: "reinterprets" },
    ],
  },
  host,
  { width: 400, height: 300 },
);
const influencePath = host.querySelector('path[data-edge-type="influences"]');
const reinterpretPath = host.querySelector('path[data-edge-type="reinterprets"]');
assert(influencePath?.getAttribute("stroke"), "T15 #10 happy: influences path rendered");
assert(
  reinterpretPath?.getAttribute("stroke-dasharray") === "4 4",
  "T15 #10 happy: reinterprets dashed stroke",
);

console.log(`\nT15 graph-academic-genre: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
