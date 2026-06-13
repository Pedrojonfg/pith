/**
 * Post A+ T11 — topological importance scoring
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t11.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  computeImportanceScore,
  recomputeImportanceScores,
} from "../src/js/vault/prerequisite-graph.js";
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

function getEntry(id) {
  return loadVault().entries.find((e) => e.id === id);
}

resetStorage();
clearVault();

// happy: hub scores higher than leaves (same mastery)
const hub = addManualEntry({ canonicalTitle: "Hub", topic: "math", masteryBase: 0.5 });
const leaf1 = addManualEntry({ canonicalTitle: "Leaf1", topic: "math", masteryBase: 0.5 });
const leaf2 = addManualEntry({ canonicalTitle: "Leaf2", topic: "math", masteryBase: 0.5 });
const leaf3 = addManualEntry({ canonicalTitle: "Leaf3", topic: "math", masteryBase: 0.5 });
setPrerequisites(leaf1.id, [hub.id]);
setPrerequisites(leaf2.id, [hub.id]);
setPrerequisites(leaf3.id, [hub.id]);

const hubEntry = getEntry(hub.id);
const leafEntry = getEntry(leaf1.id);
assert(
  hubEntry.importanceScore > leafEntry.importanceScore,
  "happy: central hub scores higher than leaf with same mastery",
);
assert(hubEntry.importanceScore === 3, "happy: hub with 3 dependents scores 3");
assert(leafEntry.importanceScore === 0, "happy: leaf with no dependents scores 0");

// happy: co-prerequisites contribute 0.5 each
clearVault();
const coA = addManualEntry({ canonicalTitle: "CoA", topic: "logic" });
const coB = addManualEntry({ canonicalTitle: "CoB", topic: "logic" });
setPrerequisites(coA.id, [coB.id]);
setPrerequisites(coB.id, [coA.id]);
const coAEntry = getEntry(coA.id);
const coBEntry = getEntry(coB.id);
assert(coAEntry.importanceScore === 0.5, "happy: co-prerequisite partner scores 0.5");
assert(coBEntry.importanceScore === 0.5, "happy: mutual co-prerequisite symmetric score");

// edge: chain — intermediate scores above terminal leaf
clearVault();
const chainA = addManualEntry({ canonicalTitle: "ChainA", topic: "chain" });
const chainB = addManualEntry({ canonicalTitle: "ChainB", topic: "chain" });
const chainC = addManualEntry({ canonicalTitle: "ChainC", topic: "chain" });
setPrerequisites(chainB.id, [chainA.id]);
setPrerequisites(chainC.id, [chainB.id]);
assert(getEntry(chainC.id).importanceScore === 0, "edge: terminal leaf scores 0");
assert(getEntry(chainB.id).importanceScore === 1, "edge: intermediate with one dependent scores 1");
assert(
  getEntry(chainA.id).importanceScore > getEntry(chainC.id).importanceScore,
  "edge: upstream concept scores higher than terminal leaf",
);

// contract: computeImportanceScore matches stored cache after recompute
clearVault();
const vault = loadVault();
const base = addManualEntry({ canonicalTitle: "Base", topic: "math" });
const dep = addManualEntry({ canonicalTitle: "Dep", topic: "math" });
setPrerequisites(dep.id, [base.id]);
const freshVault = loadVault();
const baseStored = getEntry(base.id);
assert(
  computeImportanceScore(baseStored, freshVault) === baseStored.importanceScore,
  "contract: computeImportanceScore matches vault-store cache",
);

// failure: invalid entry returns 0
assert(computeImportanceScore(null, vault) === 0, "failure: null entry returns 0");
assert(computeImportanceScore({}, vault) === 0, "failure: empty entry returns 0");

// contract: recomputeImportanceScores updates all entries
clearVault();
const r1 = addManualEntry({ canonicalTitle: "R1", topic: "math" });
const r2 = addManualEntry({ canonicalTitle: "R2", topic: "math" });
setPrerequisites(r2.id, [r1.id]);
const v = loadVault();
for (const e of v.entries) delete e.importanceScore;
recomputeImportanceScores(v);
const r1Entry = v.entries.find((e) => e.id === r1.id);
const r2Entry = v.entries.find((e) => e.id === r2.id);
assert(r1Entry.importanceScore === 1, "contract: recomputeImportanceScores restores hub score");
assert(r2Entry.importanceScore === 0, "contract: recomputeImportanceScores restores leaf score");

console.log(`\nPost A+ T11: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
