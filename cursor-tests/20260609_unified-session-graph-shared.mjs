/**
 * T07 — Graph adapters use shared layer
 */
import { resetStorage } from "./setup-dom.mjs";
import { createSession, setActiveSession } from "../src/js/session-store.js";
import { buildClozeEpistemicGraph } from "../src/js/graph/build.js";
import { buildSessionGraph, resolveEnrichedGraphInputs } from "../src/js/graph/adapters.js";

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

const canonicalId = "a1b2c3d4e5f6";
const doc = await createSession("# Test\n\nContent.");
doc.shared.conceptInventory = [
  { canonicalId, label: "Episteme", definition: "True knowledge" },
];
doc.shared.annotations = [
  { id: "ann1", type: "★", text: "key point", offset: 10, createdAt: 1 },
];
const { saveActiveSession } = await import("../src/js/session-store.js");
saveActiveSession(doc);
setActiveSession(doc.docId);

const clozeSession = { studyMode: "cloze", cloze: { epistemicGraph: null } };
const graph = buildClozeEpistemicGraph(clozeSession, { shared: doc.shared });
assert(graph.nodes.some((n) => n.epistemicId === canonicalId || n.id === `cloze:${canonicalId}`), "cloze graph: canonicalId node");

const sessionGraph = buildSessionGraph(clozeSession, { mode: "cloze" });
assert(sessionGraph.nodes.length >= 1, "buildSessionGraph cloze mode");

const inputs = resolveEnrichedGraphInputs(
  { slow: { annotations: [] } },
  { shared: doc.shared },
);
assert(inputs.annotations.length === 1, "resolveEnrichedGraphInputs: shared annotations");
assert(
  (inputs.textConcepts?.size ?? inputs.textConcepts?.length ?? 0) >= 1,
  "resolveEnrichedGraphInputs: shared concepts",
);

console.log(`\nT07 graph-shared: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
