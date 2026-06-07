/**
 * T05 — buildClozeEpistemicGraph + buildSessionGraph mode cloze
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260529_t05-cloze-graph.mjs
 */
import { JSDOM } from "jsdom";
import { buildClozeEpistemicGraph, buildSessionGraph } from "../src/js/graph/build.js";
import { renderGraphCanvas } from "../src/js/graph/canvas.js";
import { mountMaterialGraphScreen } from "../src/js/graph/view.js";

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

const epistemicGraph = {
  nodes: [
    { id: "node_001", text: "Democracy", type: "CONCEPT", importance: 4 },
    { id: "node_002", text: "Representation", type: "TERM", importance: 3 },
    { id: "node_003", text: "", type: "CONCEPT", importance: 2 },
    { id: "node_004", text: "Orphan", type: "CONCEPT", importance: 1 },
  ],
  edges: [
    { id: "e1", source_id: "node_001", target_id: "node_002", type: "implies" },
    { id: "e2", source_id: "node_001", target_id: "node_001", type: "self" },
    { id: "e3", source_id: "missing", target_id: "node_002", type: "causes" },
  ],
};

const clozeSession = {
  studyMode: "cloze",
  cloze: {
    pipelineStatus: "phase0",
    epistemicGraph,
  },
  slow: {
    phase0: { argumentMap: [{ id: "P1", text: "Should not appear" }] },
    graphEnrichedUnlocked: true,
  },
  _meta: {
    material_graph: {
      blockIndex: [{ id: 1, title: "RSVP block", concept_ids: ["c1"], signature: [] }],
      conceptInventory: [{ id: "c1", title: "RSVP concept" }],
    },
  },
};

const graph = buildClozeEpistemicGraph(clozeSession);

assert(graph.kind === "cloze", "happy: kind is cloze");
assert(graph.nodes.length === 3, "happy: skips empty-text node, keeps valid nodes");
assert(
  graph.nodes.some((n) => n.id === "cloze:node_001" && n.label === "Democracy" && n.importance === 4),
  "happy: maps id→cloze:id and text→label with importance",
);
assert(
  graph.nodes.some((n) => n.id === "cloze:node_002" && n.epistemicType === "TERM"),
  "happy: preserves epistemic type metadata",
);
assert(
  graph.edges.some(
    (e) => e.from === "cloze:node_001" && e.to === "cloze:node_002" && e.type === "implies",
  ),
  "happy: maps source_id/target_id to directed edge with type",
);
assert(
  !graph.edges.some((e) => e.from === e.to),
  "edge: self-loop omitted",
);
assert(
  !graph.nodes.some((n) => n.label.includes("RSVP") || n.label.includes("Should not appear")),
  "happy: does not read RSVP/Slow graphs",
);

const routed = buildSessionGraph(clozeSession, { mode: "cloze" });
assert(routed.kind === "cloze" && routed.nodes.length === graph.nodes.length, "happy: buildSessionGraph routes cloze mode");

const emptyNull = buildClozeEpistemicGraph({ studyMode: "cloze", cloze: { epistemicGraph: null } });
assert(
  emptyNull.nodes.length === 0 && emptyNull.edges.length === 0 && emptyNull.kind === "cloze",
  "edge: null epistemicGraph → empty cloze graph",
);

const emptyMissing = buildClozeEpistemicGraph({ studyMode: "cloze", cloze: {} });
assert(emptyMissing.nodes.length === 0, "edge: missing epistemicGraph → empty");

const slowOnly = buildSessionGraph(
  { slow: { phase0: { argumentMap: [{ id: "A", text: "Slow only" }] } } },
  { mode: "cloze" },
);
assert(slowOnly.nodes.length === 0 && slowOnly.kind === "cloze", "failure: cloze mode ignores slow phase0");

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='host'></div></body></html>");
global.document = dom.window.document;
const host = document.getElementById("host");
renderGraphCanvas(graph, host, { width: 640, height: 400, lang: "English" });
assert(host.querySelector(".material-graph-svg"), "happy: renderGraphCanvas accepts cloze graph");

const mountHost = dom.window.document.createElement("div");
mountMaterialGraphScreen(clozeSession, mountHost, { mode: "cloze" });
assert(mountHost.querySelector(".material-graph-canvas-mount"), "happy: mountMaterialGraphScreen accepts cloze mode");

console.log("\nExample cloze graph output:");
console.log(JSON.stringify({ kind: graph.kind, nodeCount: graph.nodes.length, sample: graph.nodes[0], edge: graph.edges[0] }, null, 2));

console.log(`\n20260529_t05-cloze-graph: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
