/**
 * Post A+ T01 — manual vault store APIs
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t01.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  addManualEntry,
  clearVault,
  deleteEntry,
  loadVault,
  mergeEntries,
  SCHEMA_VERSION,
  setPrerequisites,
  updateEntryTitle,
  upsertEntry,
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

// happy: add manual entry
const a = addManualEntry({ canonicalTitle: "Alpha", topic: "math", masteryBase: 0.6 });
assert(a?.id && a.canonicalTitle === "Alpha", "happy: addManualEntry returns entry");
assert(a.manualOrigin === true, "happy: manualOrigin flag set");

// happy: update title
updateEntryTitle(a.id, "Alpha renamed");
assert(getEntryTitle(a.id) === "Alpha renamed", "happy: updateEntryTitle persists");

// happy: prerequisites
const b = addManualEntry({ canonicalTitle: "Beta", topic: "math", masteryBase: 0.5 });
setPrerequisites(b.id, [a.id]);
const bLoaded = loadVault().entries.find((e) => e.id === b.id);
assert(bLoaded.prerequisites.includes(a.id), "happy: setPrerequisites sets prereqs");
const aLoaded = loadVault().entries.find((e) => e.id === a.id);
assert(aLoaded.dependents.includes(b.id), "happy: dependents inverse link");

// happy: merge
upsertEntry({
  id: "c1",
  canonicalTitle: "Gamma",
  topic: "math",
  masteryBase: 0.4,
  observations: [{ type: "mcq_wrong", rawSignal: -0.2, timestamp: Date.now() }],
  sources: [{ docId: "d1", conceptId: "c1" }],
});
const merged = mergeEntries(a.id, "c1");
assert(merged?.aliases?.includes("Gamma"), "happy: merge adds alias from merged title");
assert(merged.observations.length >= 1, "happy: merge combines observations");
assert(!loadVault().entries.some((e) => e.id === "c1"), "happy: merged entry removed");
assert(
  loadVault().entries.every((e) => !e.prerequisites.includes("c1")),
  "happy: merge rewires prerequisite refs",
);

// happy: delete cleans links
deleteEntry(b.id);
assert(!loadVault().entries.some((e) => e.id === b.id), "happy: delete removes entry");
assert(
  !loadVault().entries.some((e) => (e.prerequisites || []).includes(b.id)),
  "happy: delete cleans inverse prereq links",
);

// edge: schema v2
assert(loadVault().schemaVersion === SCHEMA_VERSION, "edge: schema version 2");

// failure: merge self
assert(mergeEntries(a.id, a.id) === null, "failure: cannot merge with self");

// failure: empty title
assert(updateEntryTitle(a.id, "") === null, "failure: empty title rejected");

function getEntryTitle(id) {
  return loadVault().entries.find((e) => e.id === id)?.canonicalTitle;
}

console.log(`\nPost A+ T01: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
