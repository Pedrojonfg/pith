/**
 * Post A+ T09 — prerequisite cycle detection + co-prerequisites
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t09.mjs
 */
import { readFileSync } from "node:fs";
import { resetStorage } from "./setup-dom.mjs";
import { addPrerequisiteSafe } from "../src/js/vault/prerequisite-graph.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
  saveVault,
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

function assertCoPair(idA, idB, msg) {
  const a = getEntry(idA);
  const b = getEntry(idB);
  assert(
    (a?.coPrerequisites || []).includes(b?.id)
      && (b?.coPrerequisites || []).includes(a?.id),
    `${msg}: mutual coPrerequisites`,
  );
  assert(
    !(a?.prerequisites || []).includes(b?.id)
      && !(b?.prerequisites || []).includes(a?.id),
    `${msg}: no one-way edges between co-prereq partners`,
  );
}

resetStorage();
clearVault();

// happy: one-way prerequisite
const a = addManualEntry({ canonicalTitle: "Alpha", topic: "math" });
const b = addManualEntry({ canonicalTitle: "Beta", topic: "math" });
const vault = loadVault();
const oneWay = addPrerequisiteSafe(vault, b.id, a.id);
saveVault(vault);
assert(oneWay.type === "one_way", "happy: addPrerequisiteSafe returns one_way");
assert(getEntry(b.id).prerequisites.includes(a.id), "happy: one-way edge stored");
assert(getEntry(a.id).dependents.includes(b.id), "happy: dependents rebuilt after one-way");

// happy: A→B + B→A becomes co-prerequisite pair
clearVault();
const x = addManualEntry({ canonicalTitle: "X", topic: "logic" });
const y = addManualEntry({ canonicalTitle: "Y", topic: "logic" });
setPrerequisites(y.id, [x.id]);
assert(getEntry(y.id).prerequisites.includes(x.id), "happy: first edge one-way Y→X");
setPrerequisites(x.id, [y.id]);
assertCoPair(x.id, y.id, "happy: reverse edge becomes co-prerequisite");
assert(
  getEntry(x.id).prerequisites.length === 0 && getEntry(y.id).prerequisites.length === 0,
  "happy: one-way edges removed after co-prerequisite conversion",
);

// edge: idempotent re-add of existing one-way
clearVault();
const p = addManualEntry({ canonicalTitle: "P", topic: "math" });
const q = addManualEntry({ canonicalTitle: "Q", topic: "math" });
setPrerequisites(q.id, [p.id]);
const v2 = loadVault();
const again = addPrerequisiteSafe(v2, q.id, p.id);
assert(again.type === "one_way", "edge: re-add existing one-way is idempotent");

// edge: idempotent when already co-prerequisites
clearVault();
const m = addManualEntry({ canonicalTitle: "M", topic: "math" });
const n = addManualEntry({ canonicalTitle: "N", topic: "math" });
setPrerequisites(m.id, [n.id]);
setPrerequisites(n.id, [m.id]);
const v3 = loadVault();
const coAgain = addPrerequisiteSafe(v3, m.id, n.id);
assert(coAgain.type === "co_prerequisite", "edge: re-add on co-prereq pair returns co_prerequisite");
assertCoPair(m.id, n.id, "edge: co-prerequisite pair unchanged");

// failure: self-reference ignored
clearVault();
const solo = addManualEntry({ canonicalTitle: "Solo", topic: "math" });
const v4 = loadVault();
addPrerequisiteSafe(v4, solo.id, solo.id);
assert(
  !(getEntry(solo.id).prerequisites || []).includes(solo.id),
  "failure: self prerequisite rejected",
);

// contract: setPrerequisites uses safe add (3-node path cycle)
clearVault();
const n1 = addManualEntry({ canonicalTitle: "N1", topic: "chain" });
const n2 = addManualEntry({ canonicalTitle: "N2", topic: "chain" });
const n3 = addManualEntry({ canonicalTitle: "N3", topic: "chain" });
setPrerequisites(n2.id, [n1.id]);
setPrerequisites(n3.id, [n2.id]);
setPrerequisites(n1.id, [n3.id]);
assertCoPair(n1.id, n3.id, "contract: transitive cycle converts closing pair to co-prereq");
assert(getEntry(n2.id).prerequisites.includes(n1.id), "contract: unrelated chain edges preserved");
assert(getEntry(n3.id).prerequisites.includes(n2.id), "contract: unrelated chain edges preserved");

const debugUiSrc = readFileSync(new URL("../src/js/vault/debug-ui.js", import.meta.url), "utf8");
assert(debugUiSrc.includes("vault-badge-co"), "contract: debug-ui renders co-prerequisite badge");

console.log(`\nPost A+ T09: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
