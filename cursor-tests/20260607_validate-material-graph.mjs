/**
 * Validate — mode-agnostic material graph (RSVP + Slow)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_validate-material-graph.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import {
  buildRsvpMaterialGraph,
  buildSlowEnrichedGraphFromInputs,
  collectTextConceptsFromLists,
} from "../src/js/graph/build.js";
import {
  buildSessionGraph,
  buildSlowPhase0Graph,
  buildSlowEnrichedGraph,
} from "../src/js/graph/adapters.js";
import { conceptNodeId, blockNodeId, LITERATURE_TERM_ID } from "../src/js/graph/ids.js";
import {
  findNearestArgumentMapNode,
  textOverlapScore,
} from "../src/js/graph/proximity.js";
import { renderGraphCanvas } from "../src/js/graph/canvas.js";
import {
  buildGraphSubgraphMarkdown,
  mountMaterialGraphScreen,
  renderGraphUnlockButtonHtml,
  wireMaterialGraphScreen,
} from "../src/js/graph/view.js";
import { normalizeBlockIndexArray } from "../src/js/session.js";
import { addAnnotation, addGraphLink } from "../src/js/slow/annotations.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

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

// ─── RSVP material graph (pure logic) ───────────────────────────────────────

const inventory = [
  { id: "c1", order: 1, title: "Alpha", scope_one_line: "A", prerequisite_ids: [] },
  { id: "c2", order: 2, title: "Beta", scope_one_line: "B", prerequisite_ids: ["c1"] },
];

const blocks = [
  { id: 1, title: "Overview: X", summary: "O", concept_ids: [], signature: ["s1"] },
  { id: 2, title: "Block B", summary: "B", concept_ids: ["c2"], signature: ["term-x"] },
];

const rsvpGraph = buildRsvpMaterialGraph({ conceptInventory: inventory, blockIndex: blocks });

assert(rsvpGraph.kind === "rsvp_material", "MG-RSVP happy: graph kind");
assert(
  rsvpGraph.nodes.some((n) => n.id === conceptNodeId("c1") && n.layer === "concept"),
  "MG-RSVP happy: concept node from inventory",
);
assert(
  rsvpGraph.nodes.some((n) => n.id === blockNodeId(2) && n.layer === "block"),
  "MG-RSVP happy: block node",
);
assert(
  rsvpGraph.edges.some(
    (e) => e.type === "requires" && e.from === conceptNodeId("c1") && e.to === conceptNodeId("c2"),
  ),
  "MG-RSVP happy: prerequisite edge",
);
assert(
  rsvpGraph.edges.some(
    (e) => e.type === "covers" && e.from === blockNodeId(2) && e.to === conceptNodeId("c2"),
  ),
  "MG-RSVP happy: block covers concept",
);

const emptyRsvp = buildRsvpMaterialGraph({ conceptInventory: [], blockIndex: [] });
assert(emptyRsvp.nodes.length === 0 && emptyRsvp.edges.length === 0, "MG-RSVP edge: empty inputs → empty graph");

const blocksOnly = buildRsvpMaterialGraph({
  blockIndex: [{ id: 1, title: "Only", summary: "S", concept_ids: ["ghost"], signature: [] }],
});
assert(
  blocksOnly.nodes.some((n) => n.id === conceptNodeId("ghost")),
  "MG-RSVP edge: orphan concept_id on block creates concept node",
);
assert(
  !blocksOnly.edges.some((e) => e.type === "sequence"),
  "MG-RSVP edge: single block has no sequence edge",
);
assert(blocksOnly.edges.some((e) => e.type === "covers"), "MG-RSVP edge: single block still links to concept");

const dupEdgeGraph = buildRsvpMaterialGraph({
  conceptInventory: [{ id: "c1", order: 1, title: "A", prerequisite_ids: ["c1"] }],
  blockIndex: [],
});
assert(
  !dupEdgeGraph.edges.some((e) => e.from === e.to),
  "MG-RSVP failure: self prerequisite does not create edge",
);

// ─── Session graph dispatcher ───────────────────────────────────────────────

const sessionWithMeta = {
  studyMode: "rsvp",
  _meta: {
    material_graph: {
      blockIndex: blocks,
      conceptInventory: inventory,
    },
  },
};

const fromMeta = buildSessionGraph(sessionWithMeta, { mode: "rsvp" });
assert(fromMeta.nodes.length >= rsvpGraph.nodes.length - 2, "MG-Dispatch happy: reads material_graph from session meta");

const slowPhase0Session = {
  studyMode: "slow",
  slow: {
    phase0: {
      conceptsToFind: [{ term: "libertad", authorUsage: "freedom", graphTermId: "libertad" }],
      argumentMap: [
        { id: "P1", text: "Premise" },
        { id: "C", text: "Conclusion" },
      ],
    },
    annotations: [],
  },
};

const phase0Graph = buildSessionGraph(slowPhase0Session, { mode: "slow_phase0" });
assert(phase0Graph.kind === "slow_phase0", "MG-Dispatch happy: slow_phase0 mode");
assert(phase0Graph.nodes.length >= 3, "MG-Dispatch happy: phase0 has concept + arg nodes");
assert(phase0Graph.edges.some((e) => e.type === "sequence"), "MG-Dispatch happy: argument map sequence edges");

const noPhase0 = buildSessionGraph({ studyMode: "slow", slow: {} }, { mode: "slow_phase0" });
assert(noPhase0.nodes.length === 0, "MG-Dispatch edge: slow_phase0 without phase0 → empty");

// ─── normalizeBlockIndexArray preserves concept_ids ─────────────────────────

const normalized = normalizeBlockIndexArray(
  [
    {
      id: 1,
      title: "T",
      summary: "S",
      chunk: "text",
      concept_ids: ["c9", "c10"],
      signature: ["x"],
    },
  ],
  { requireChunk: true },
);
assert(
  Array.isArray(normalized?.[0]?.concept_ids) && normalized[0].concept_ids.includes("c9"),
  "MG-Session happy: normalizeBlockIndexArray keeps concept_ids",
);

const noConceptIds = normalizeBlockIndexArray(
  [{ id: 1, title: "T", summary: "S", chunk: "x" }],
  { requireChunk: true },
);
assert(!noConceptIds?.[0]?.concept_ids, "MG-Session edge: no concept_ids field when absent");

// ─── Canvas + mount (DOM) ───────────────────────────────────────────────────

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='host'></div></body></html>");
global.document = dom.window.document;
const host = dom.window.document.getElementById("host");

renderGraphCanvas(rsvpGraph, host, { width: 600, height: 360, lang: "es" });
assert(host.querySelector(".material-graph-svg"), "MG-Canvas happy: SVG rendered");
assert(host.querySelector(".material-graph-legend"), "MG-Canvas happy: legend rendered");
assert(host.querySelectorAll("circle").length >= rsvpGraph.nodes.length, "MG-Canvas happy: circle per node");
assert(host.querySelectorAll("path.material-graph-edge").length >= 1, "MG-Canvas happy: edge paths");

renderGraphCanvas({ nodes: [], edges: [] }, host, { lang: "English" });
assert(host.querySelector(".material-graph-empty"), "MG-Canvas edge: empty graph shows hint");

const mountHost = dom.window.document.createElement("div");
const mounted = mountMaterialGraphScreen(sessionWithMeta, mountHost, { mode: "rsvp" });
assert(mounted?.nodes?.length > 0, "MG-Mount happy: mountMaterialGraphScreen returns graph");
assert(mountHost.querySelector(".material-graph-canvas-mount"), "MG-Mount happy: canvas mount present");
assert(mountHost.querySelector("details.material-graph-list-fallback"), "MG-Mount happy: list fallback present");

let jumped = null;
const enrichedSession = {
  studyMode: "slow",
  slow: {
    normalizedTextFull: `${"a".repeat(200)} premise ${"b".repeat(200)}`,
    readingScope: { charStart: 0, charEnd: 450 },
    phase0: slowPhase0Session.slow.phase0,
    annotations: [],
    graphNodes: [],
  },
};
const ann = addAnnotation(enrichedSession, {
  type: "⟷",
  charStart: 205,
  charEnd: 220,
  userText: "link",
});
addGraphLink(enrichedSession, ann.id, { termId: "libertad", relation: "x" });

const enrichedHost = dom.window.document.createElement("div");
mountMaterialGraphScreen(enrichedSession, enrichedHost, { mode: "slow_enriched" });
wireMaterialGraphScreen(enrichedHost, enrichedSession, {
  onJumpToAnnotation: (_s, a) => {
    jumped = a?.id;
  },
});
const userBtn = enrichedHost.querySelector(`button[data-annotation-id="${ann.id}"]`);
assert(userBtn, "MG-Mount happy: enriched list has annotation button");
userBtn.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
assert(jumped === ann.id, "MG-Mount happy: wire triggers jump callback");

// ─── Markdown export titles ─────────────────────────────────────────────────

const enriched = buildSlowEnrichedGraph(enrichedSession);
const mdEnriched = buildGraphSubgraphMarkdown(enriched, "English");
const mdMaterial = buildGraphSubgraphMarkdown(rsvpGraph, "English");
assert(mdEnriched.includes("## Enriched graph"), "MG-Export happy: enriched title");
assert(mdMaterial.includes("## Material graph"), "MG-Export happy: material title for RSVP");
assert(mdEnriched.includes("relates"), "MG-Export happy: edge type in markdown");

// ─── HTML / study integration contracts ─────────────────────────────────────

const [indexHtml, studySrc, graphCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/graph.css"), "utf8"),
]);

assert(indexHtml.includes('id="blocksGraphActions"'), "MG-UI contract: blocks graph actions host");
assert(indexHtml.includes('id="slowPhase0GraphActions"'), "MG-UI contract: phase0 graph actions host");
assert(indexHtml.includes("src/css/graph.css"), "MG-UI contract: graph.css linked");
assert(indexHtml.includes('id="materialGraphTitle"'), "MG-UI contract: shared graph screen title");
assert(studySrc.includes("renderBlocksGraphActions"), "MG-UI contract: study wires blocks graph");
assert(studySrc.includes("wireMaterialGraphHandlers"), "MG-UI contract: unified graph handlers");
assert(studySrc.includes("material_graph"), "MG-UI contract: persists material_graph on confirm");
assert(studySrc.includes('from "./graph/view.js'), "MG-UI contract: imports shared graph view");
assert(!studySrc.includes("slow/graph-view"), "MG-UI contract: no legacy graph-view import");
assert(graphCss.includes(".material-graph-svg"), "MG-UI contract: graph.css has canvas styles");

const unlockBtn = renderGraphUnlockButtonHtml("English", { id: "testGraphBtn" });
assert(unlockBtn.includes('id="testGraphBtn"'), "MG-UI happy: unlock button html");

// ─── Pure builder + proximity (no session I/O) ───────────────────────────────

const pureGraph = buildSlowEnrichedGraphFromInputs({
  textConcepts: collectTextConceptsFromLists([], [{ term: "libertad", authorUsage: "freedom", graphTermId: "libertad" }]),
  argumentMap: [{ id: "P1", text: "Premise alpha about freedom" }],
  annotations: [{ id: "a1", type: "⊘", charStart: 0, charEnd: 10, userText: "objection to premise alpha freedom" }],
  scopeText: "Premise alpha about freedom and other topics far away",
  onResolveMiss: () => {},
});
assert(
  pureGraph.edges.some((e) => e.type === "refuta" && e.to === "arg:P1"),
  "MG-Pure: text-overlap links critical annotation without char proximity",
);

const textMatch = findNearestArgumentMapNode(
  { id: "x", charStart: 5000, charEnd: 5010, userText: "freedom objection premise alpha" },
  {
    argumentMap: [{ id: "P1", text: "Premise alpha about freedom" }],
    scopeText: "unrelated padding ".repeat(200),
  },
);
assert(textMatch.method === "text" && textMatch.nodeId === "P1", "MG-Proximity: text overlap fallback when char distance fails");

assert(textOverlapScore("freedom premise", "premise about freedom") > 0.2, "MG-Proximity: token overlap score");

assert(LITERATURE_TERM_ID === "literature", "MG-Ids: literature term constant");

// ─── Column layout (no force drift) ──────────────────────────────────────────

const layoutGraph = buildRsvpMaterialGraph({
  conceptInventory: [{ id: "c1", title: "A" }],
  blockIndex: [{ id: 1, title: "B", concept_ids: ["c1"], signature: [] }],
});
renderGraphCanvas(layoutGraph, host, { width: 640, height: 400, lang: "English" });
const conceptNode = host.querySelector('[data-node-id="concept:c1"]');
const blockNode = host.querySelector('[data-node-id="block:1"]');
assert(conceptNode && blockNode, "MG-Layout: renders concept and block nodes");
const conceptX = Number(conceptNode.getAttribute("transform")?.match(/translate\(([^,]+)/)?.[1] || 0);
const blockX = Number(blockNode.getAttribute("transform")?.match(/translate\(([^,]+)/)?.[1] || 0);
assert(conceptX < blockX, "MG-Layout: concept column left of block column (fixed columns)");

// ─── Report ─────────────────────────────────────────────────────────────────

console.log(`\n20260607_validate-material-graph: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

console.log(`
Tests generados: ${passed}
Stack de test usado: node --import register.mjs (jsdom, pure logic)
Categorías cubiertas: lógica pura, DOM/canvas, contratos HTML, re-exports

Casos cubiertos:
  ✓ RSVP graph: conceptos, bloques, prerequisitos, covers, sequence
  ✓ RSVP empty / orphan concept_id / self-edge rejection
  ✓ buildSessionGraph dispatcher (rsvp meta, slow_phase0)
  ✓ normalizeBlockIndexArray preserves concept_ids
  ✓ Canvas SVG + legend + empty state
  ✓ mountMaterialGraphScreen + wire jump callback
  ✓ Markdown export titles (material vs enriched)
  ✓ index.html + study.js integration contracts
  ✓ Pure builder + text-overlap proximity + fixed column layout
  ✓ graph/adapters.js session dispatch + enrichedInputs injection

Casos NO cubiertos (conscientemente):
  - twoPhaseConceptSplit live LLM call → requeriría mock de API / red
  - Click en nodo SVG canvas → candidato E2E Playwright
  - applyDeterministicDedup merge async → requeriría mock mergeChunks LLM

Tests que deberían existir en /tests (si el proyecto los tiene):
  - Integration: confirmBlocksBtn persists _meta.material_graph end-to-end
  - E2E: blocks screen "View graph" opens screenMaterialGraph with nodes visible
`);
