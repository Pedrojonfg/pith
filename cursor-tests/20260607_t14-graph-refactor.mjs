/**
 * T14 — graph refactor: pure builders, adapters, proximity, column layout (#4-#8)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t14-graph-refactor.mjs
 */
import { JSDOM } from "jsdom";
import { buildSlowEnrichedGraphFromInputs, collectTextConceptsFromLists } from "../src/js/graph/build.js";
import { buildSessionGraph, resolveEnrichedGraphInputs } from "../src/js/graph/adapters.js";
import { renderGraphCanvas } from "../src/js/graph/canvas.js";
import { LITERATURE_TERM_ID } from "../src/js/graph/ids.js";
import {
  CHAR_PROXIMITY_CHARS,
  findNearestArgumentMapNode,
  textOverlapScore,
} from "../src/js/graph/proximity.js";

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

// #4 — pure builder without session/dictionary
const graph = buildSlowEnrichedGraphFromInputs({
  textConcepts: collectTextConceptsFromLists([{ term: "justicia", definition: "fairness" }], []),
  argumentMap: [{ id: "C", text: "Conclusion about justice" }],
  annotations: [
    {
      id: "n1",
      type: "⟷",
      charStart: 100,
      charEnd: 120,
      userText: "links justice to conclusion",
      graphLinks: [{ termId: "justicia", relation: "see" }],
    },
  ],
  scopeText: "padding ".repeat(50),
  onResolveMiss: () => {},
});
assert(graph.kind === "slow_enriched", "T14 #4: pure builder kind");
assert(graph.nodes.some((n) => n.termId === "justicia"), "T14 #4: text node from injected concepts");
assert(
  graph.edges.some((e) => e.from === "user:n1" && e.to === "text:justicia"),
  "T14 #4: graphLink edge without session",
);

// enrichedInputs bypasses session adapter
const viaDispatcher = buildSessionGraph(null, {
  mode: "slow_enriched",
  enrichedInputs: {
    textConcepts: collectTextConceptsFromLists([{ term: "justicia" }], []),
    argumentMap: [],
    annotations: [],
    scopeText: "",
    onResolveMiss: () => {},
  },
});
assert(viaDispatcher.kind === "slow_enriched", "T14 #4: buildSessionGraph accepts enrichedInputs");

// #8 — char proximity then text overlap
const charHit = findNearestArgumentMapNode(
  { id: "a", charStart: 48, charEnd: 52, userText: "note" },
  {
    argumentMap: [{ id: "P1", text: "Premise alpha" }],
    scopeText: `${"x".repeat(40)} Premise alpha ${"y".repeat(40)}`,
  },
);
assert(charHit.method === "char" && charHit.nodeId === "P1", "T14 #8 happy: char proximity match");

const textHit = findNearestArgumentMapNode(
  { id: "b", charStart: 9000, charEnd: 9010, userText: "objection to premise alpha validity" },
  {
    argumentMap: [{ id: "P1", text: "Premise alpha validity" }],
    scopeText: "unrelated ".repeat(500),
  },
);
assert(textHit.method === "text" && textHit.nodeId === "P1", "T14 #8 happy: text overlap when char fails");

const miss = findNearestArgumentMapNode(
  { id: "c", charStart: 0, charEnd: 1, userText: "zzz" },
  {
    argumentMap: [{ id: "P1", text: "Completely different topic" }],
    scopeText: "abc",
  },
);
assert(!miss.nodeId, "T14 #8 edge: no false match on unrelated text");

assert(CHAR_PROXIMITY_CHARS === 200, "T14 #8: proximity constant exported");
assert(textOverlapScore("alpha beta", "beta gamma") > 0, "T14 #8: overlap score positive for shared token");

// #3 — literature constant
assert(LITERATURE_TERM_ID === "literature", "T14 #3: LITERATURE_TERM_ID constant");

// #5 — fixed column layout (x stable per layer)
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='host'></div></body></html>");
global.document = dom.window.document;
const host = document.getElementById("host");
const layered = {
  nodes: [
    { id: "concept:c1", label: "C", layer: "concept" },
    { id: "block:1", label: "B", layer: "block", blockId: 1 },
    { id: "user:u1", label: "U", layer: "user" },
  ],
  edges: [],
};
const first = renderGraphCanvas(layered, host, { width: 600, height: 400 });
renderGraphCanvas(layered, host, { width: 600, height: 400 });
const second = renderGraphCanvas(layered, host, { width: 600, height: 400 });
assert(
  first.nodes[0].x === second.nodes[0].x && first.nodes[0].y === second.nodes[0].y,
  "T14 #5: layout deterministic (no force jitter)",
);
const concept = second.nodes.find((n) => n.layer === "concept");
const user = second.nodes.find((n) => n.layer === "user");
assert(concept && user && concept.x < user.x, "T14 #5: concept column left of user column");

// resolveEnrichedGraphInputs with overrides (adapter inject)
const inputs = resolveEnrichedGraphInputs(null, {
  sessionConcepts: [],
  conceptsToFind: [{ term: "x", authorUsage: "y", graphTermId: "x" }],
  argumentMap: [],
  annotations: [],
  scopeText: "",
  onResolveMiss: () => {},
});
assert(inputs.textConcepts.has("x"), "T14 #4: adapter resolves overrides without session");

console.log(`\n20260607_t14-graph-refactor: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
