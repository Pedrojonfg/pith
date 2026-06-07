/**
 * Material graph — RSVP block/concept pipeline (mode-agnostic)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t13-material-graph-rsvp.mjs
 */
import { buildRsvpMaterialGraph } from "../src/js/graph/build.js";
import { renderGraphCanvas } from "../src/js/graph/canvas.js";
import { JSDOM } from "jsdom";

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

const conceptInventory = [
  { id: "c1", order: 1, title: "Foundations", scope_one_line: "Basics", prerequisite_ids: [] },
  { id: "c2", order: 2, title: "Applications", scope_one_line: "Uses", prerequisite_ids: ["c1"] },
];

const blockIndex = [
  { id: 1, title: "Overview: Course", summary: "Map", concept_ids: [], signature: ["intro"] },
  { id: 2, title: "Core idea", summary: "Foundations block", concept_ids: ["c1"], signature: ["alpha"] },
  { id: 3, title: "Practice", summary: "Applications block", concept_ids: ["c2"], signature: ["beta"] },
];

const graph = buildRsvpMaterialGraph({ conceptInventory, blockIndex });

assert(graph.nodes.length >= 5, "RSVP graph has concept + block + term nodes");
assert(
  graph.edges.some((e) => e.type === "requires" && e.from.includes("c1") && e.to.includes("c2")),
  "prerequisite edge c1→c2",
);
assert(
  graph.edges.some((e) => e.type === "covers" && e.from.includes("block:2") && e.to.includes("c1")),
  "block 2 covers c1",
);
assert(graph.edges.some((e) => e.type === "sequence"), "blocks linked in sequence");

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='host'></div></body></html>");
global.document = dom.window.document;
const host = document.getElementById("host");
renderGraphCanvas(graph, host, { width: 640, height: 400, lang: "English" });
assert(host.querySelector(".material-graph-svg"), "canvas renders SVG");
assert(host.querySelectorAll(".material-graph-node").length >= graph.nodes.length, "SVG node groups");

if (failed) {
  console.error(`20260607_t13-material-graph-rsvp: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`20260607_t13-material-graph-rsvp: all ${passed} tests passed`);
