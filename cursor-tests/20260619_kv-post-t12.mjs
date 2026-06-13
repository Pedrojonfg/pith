/**
 * Post A+ T12 — vault graph UI adapter
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t12.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  buildVaultGraph,
  masteryToNodeColors,
  VAULT_GRAPH_MIN_ENTRIES,
  VAULT_GRAPH_TOPIC_FILTER_THRESHOLD,
} from "../src/js/vault/vault-graph.js";
import { masteryToNodeColors as masteryColorsFromModel } from "../src/js/vault/mastery-model.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
  setPrerequisites,
} from "../src/js/vault/vault-store.js";

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
clearVault();

// happy: buildVaultGraph node + edge shape
const a = addManualEntry({ canonicalTitle: "Alpha", topic: "math", masteryBase: 0.2 });
const b = addManualEntry({ canonicalTitle: "Beta", topic: "math", masteryBase: 0.8 });
setPrerequisites(b.id, [a.id]);
setPrerequisites(a.id, [b.id]); // co-prerequisite pair via T09 safe add in store

const vault = loadVault();
const graph = buildVaultGraph(vault);
assert(graph.nodes.length === 2, "happy: two vault nodes");
const nodeA = graph.nodes.find((n) => n.id === a.id);
assert(nodeA?.type === "vault_concept", "happy: node type vault_concept");
assert(nodeA?.label === "Alpha", "happy: label is canonicalTitle");
assert(Number.isFinite(nodeA?.mastery), "happy: mastery on node");
assert(graph.edges.some((e) => e.type === "prerequisite" || e.type === "co_prerequisite"), "happy: edges emitted");

// happy: topic filter
const other = addManualEntry({ canonicalTitle: "Gamma", topic: "physics" });
const filtered = buildVaultGraph(loadVault(), { topicFilter: "math" });
assert(filtered.nodes.length === 2, "happy: topic filter limits nodes");
assert(!filtered.nodes.some((n) => n.id === other.id), "happy: filtered topic excludes other concepts");

// happy: mastery colors gradient low < high green channel
const low = masteryToNodeColors(0.1);
const high = masteryToNodeColors(0.9);
assert(low.fill !== high.fill, "happy: mastery colors differ by level");
assert(masteryToNodeColors(0.5).fill === masteryColorsFromModel(0.5).fill, "contract: re-export matches mastery-model");

// contract: thresholds
assert(VAULT_GRAPH_MIN_ENTRIES === 10, "contract: min entries for graph button is 10");
assert(VAULT_GRAPH_TOPIC_FILTER_THRESHOLD === 150, "contract: topic filter threshold is 150");

// edge: orphan prereq outside filter omitted
const orphan = addManualEntry({ canonicalTitle: "OrphanDep", topic: "math" });
setPrerequisites(orphan.id, ["missing-id"]);
const mathOnly = buildVaultGraph(loadVault(), { topicFilter: "math" });
const orphanNode = mathOnly.nodes.find((n) => n.id === orphan.id);
assert(orphanNode, "edge: filtered node still present");
assert(
  !mathOnly.edges.some((e) => e.from === "missing-id" || e.to === "missing-id"),
  "edge: edges to missing ids omitted",
);

// scale: 100 nodes build under budget
clearVault();
for (let i = 0; i < 100; i += 1) {
  addManualEntry({ canonicalTitle: `Concept ${i}`, topic: "bulk", masteryBase: i / 100 });
}
const t0 = Date.now();
const big = buildVaultGraph(loadVault());
const elapsed = Date.now() - t0;
assert(big.nodes.length === 100, "scale: 100 nodes in graph");
assert(elapsed < 500, "scale: buildVaultGraph for 100 nodes under 500ms");

console.log(`\nPost A+ T12: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
