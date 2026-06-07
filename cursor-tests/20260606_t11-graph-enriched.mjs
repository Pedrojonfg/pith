/**
 * T11 — enriched graph view (buildEnrichedGraph + persist + markdown)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t11-graph-enriched.mjs
 */
import { JSDOM } from "jsdom";
import { addAnnotation, addGraphLink } from "../src/js/slow/annotations.js";
import {
  buildEnrichedGraph,
  buildGraphSubgraphMarkdown,
  mountEnrichedGraphScreen,
  persistEnrichedGraph,
  renderEnrichedGraphHtml,
  textNodeId,
  userNodeId,
  wireEnrichedGraphScreen,
} from "../src/js/slow/graph-view.js";
import { mergeEnrichedGraphUserNodes } from "../src/js/dictionary.js";

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

function makeSession(overrides = {}) {
  const scopeText = `${"x".repeat(200)} Premise alpha ${"y".repeat(200)} Conclusion beta ${"z".repeat(80)}`;
  return {
    slow: {
      normalizedTextFull: scopeText,
      readingScope: { charStart: 0, charEnd: scopeText.length },
      annotations: [],
      phase0: {
        argumentMap: [
          { id: "P1", text: "Premise alpha", status: "argued" },
          { id: "C", text: "Conclusion beta", status: "argued" },
        ],
        conceptsToFind: [{ term: "libertad", authorUsage: "freedom", graphTermId: "libertad" }],
      },
      graphNodes: [],
      ...overrides.slow,
    },
    ...overrides,
  };
}

const session = makeSession();
const ann = addAnnotation(session, {
  type: "⟷",
  charStart: 205,
  charEnd: 225,
  userText: "conecta libertad con premisa",
});
addGraphLink(session, ann.id, { termId: "libertad", relation: "conecta" });

const graph = buildEnrichedGraph(session);
const userNodes = graph.nodes.filter((n) => n.layer === "user");
const textNodes = graph.nodes.filter((n) => n.layer === "text");

assert(userNodes.length >= 1, "T11 happy: at least one user node");
assert(userNodes.some((n) => n.sourceAnnotationId === ann.id), "T11 happy: user node links to annotation");
assert(textNodes.some((n) => n.termId === "libertad"), "T11 happy: text node from concept");
assert(textNodes.some((n) => n.id === textNodeId("libertad")), "T11 happy: text node id slug");
assert(
  graph.edges.some((e) => e.from === userNodeId(ann.id) && e.to === textNodeId("libertad") && e.type === "relates"),
  "T11 happy: graphLink edge relates user→text",
);

const crit = addAnnotation(session, {
  type: "⊘",
  charStart: 210,
  charEnd: 230,
  userText: "objeción a premisa",
});
const graphCrit = buildEnrichedGraph(session);
assert(
  graphCrit.edges.some(
    (e) => e.from === userNodeId(crit.id) && e.type === "refuta" && e.to.startsWith("arg:"),
  ),
  "T11 happy: critical ⊘ edge refuta nearest argument node",
);

const emptySession = makeSession({ slow: { annotations: [], phase0: null, readingScope: { charStart: 0, charEnd: 10 } } });
emptySession.slow.normalizedTextFull = "short text";
const emptyGraph = buildEnrichedGraph(emptySession);
assert(emptyGraph.nodes.filter((n) => n.layer === "user").length === 0, "T11 edge: no user nodes without userText");
assert(Array.isArray(emptyGraph.edges), "T11 edge: edges array always present");

const noTextAnn = addAnnotation(emptySession, { type: "→", charStart: 1, charEnd: 4, userText: "" });
const noUserGraph = buildEnrichedGraph(emptySession);
assert(
  !noUserGraph.nodes.some((n) => n.sourceAnnotationId === noTextAnn.id),
  "T11 failure: empty userText does not create user node",
);

const stored = persistEnrichedGraph(session, graph);
assert(stored.length >= 1, "T11 happy: persistEnrichedGraph stores graphNodes");
assert(session.slow.graphNodes?.length >= 1, "T11 happy: session.slow.graphNodes populated");

const merged = mergeEnrichedGraphUserNodes(session, userNodes);
assert(merged.some((c) => c.layer === "user"), "T11 happy: dictionary merge adds layer:user concepts");

const md = buildGraphSubgraphMarkdown(graph, "English");
assert(md.includes("## Enriched graph"), "T11 happy: markdown export title");
assert(md.includes("[Pedro:⟷]"), "T11 happy: markdown includes user node label");
assert(md.includes("relates"), "T11 happy: markdown includes edge type");

const html = renderEnrichedGraphHtml(graph, "es");
assert(html.includes("slow-graph-node-user"), "T11 happy: HTML renders user node buttons");
assert(html.includes("data-annotation-id"), "T11 happy: HTML includes annotation id attribute");

const dom = new JSDOM("<!DOCTYPE html><div id='host'></div>");
const host = dom.window.document.getElementById("host");
let jumped = null;
mountEnrichedGraphScreen(session, host);
wireEnrichedGraphScreen(host, session, {
  onJumpToAnnotation: (s, a) => {
    jumped = a?.id;
  },
});
const targetBtn = host.querySelector(`.slow-graph-node-user[data-annotation-id="${ann.id}"]`);
assert(targetBtn, "T11 happy: rendered user node for target annotation");
targetBtn.click();
assert(jumped === ann.id, "T11 happy: tap user node triggers jumpToAnnotation callback");

console.log(`\nT11 graph enriched: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
