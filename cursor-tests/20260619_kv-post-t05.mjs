/**
 * Post A+ T05 — misconception model + session-close detection
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t05.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { updateMastery } from "../src/js/vault/mastery-model.js";
import {
  applyObservations,
  collectObservations,
} from "../src/js/vault/session-close.js";
import {
  detectMisconceptionsForEntry,
  getActiveMisconceptions,
  groupNegativeObservationsByAnswer,
  markMisconceptionResolved,
  markMisconceptionResolvedOnEntry,
  runMisconceptionDetectionForEntries,
  tryAutoResolveMisconceptions,
} from "../src/js/vault/misconceptions.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
  saveVault,
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

function getVaultEntry(id) {
  return loadVault().entries.find((e) => e.id === id);
}

function seedWrongObservations(entryId, wrongAnswer, count, now = Date.now()) {
  const vault = loadVault();
  const entry = vault.entries.find((e) => e.id === entryId);
  if (!entry) return;
  for (let i = 0; i < count; i += 1) {
    updateMastery(entry, {
      type: "mcq_wrong",
      timestamp: now - i * 1000,
      docId: "doc1",
      wrongAnswer,
    });
  }
  saveVault(vault);
}

resetStorage();
clearVault();

// happy: ≥3 same wrongAnswer → misconception created
const created = addManualEntry({ canonicalTitle: "Photosynthesis", topic: "biology" });
seedWrongObservations(created.id, "Respiration only", 3);
let vaultRef = loadVault();
let entry = vaultRef.entries.find((e) => e.id === created.id);
const misc = await detectMisconceptionsForEntry(entry, { useLlm: false });
saveVault(vaultRef);
assert(misc?.description && misc.confidence >= 0.6, "happy: ≥3 wrong obs creates misconception");
vaultRef = loadVault();
assert(getActiveMisconceptions(vaultRef.entries.find((e) => e.id === created.id)).length === 1, "happy: one active misconception");

// edge: <3 same wrongAnswer → no misconception
const created2 = addManualEntry({ canonicalTitle: "Mitosis", topic: "biology" });
seedWrongObservations(created2.id, "Same mistake", 2);
const entry2 = getVaultEntry(created2.id);
const none = await detectMisconceptionsForEntry(entry2, { useLlm: false });
assert(none === null, "edge: <3 wrong obs creates no misconception");

// failure: no wrongAnswer text → cannot group → no misconception
const created3 = addManualEntry({ canonicalTitle: "Meiosis", topic: "biology" });
const vault3 = loadVault();
const entry3 = vault3.entries.find((e) => e.id === created3.id);
for (let i = 0; i < 3; i += 1) {
  updateMastery(entry3, { type: "mcq_wrong", timestamp: Date.now() - i, docId: "d" });
}
saveVault(vault3);
const noText = await detectMisconceptionsForEntry(getVaultEntry(created3.id), { useLlm: false });
assert(noText === null, "failure: negative obs without wrongAnswer do not create misconception");

// contract: markMisconceptionResolved persists
const miscId = getActiveMisconceptions(getVaultEntry(created.id))[0]?.id;
assert(markMisconceptionResolved(created.id, miscId), "contract: markMisconceptionResolved returns true");
const reloaded = getVaultEntry(created.id);
assert(
  !getActiveMisconceptions(reloaded).some((m) => m.id === miscId),
  "contract: misconception marked resolved in vault",
);

// contract: auto-resolve after 3 consecutive positive obs
const created4 = addManualEntry({ canonicalTitle: "Cell wall", topic: "biology" });
seedWrongObservations(created4.id, "Membrane", 3);
vaultRef = loadVault();
entry = vaultRef.entries.find((e) => e.id === created4.id);
await detectMisconceptionsForEntry(entry, { useLlm: false });
saveVault(vaultRef);
assert(getActiveMisconceptions(getVaultEntry(created4.id)).length === 1, "setup: active misconception before auto-resolve");
const vault4 = loadVault();
const entry4 = vault4.entries.find((e) => e.id === created4.id);
for (let i = 0; i < 3; i += 1) {
  updateMastery(entry4, { type: "mcq_correct", timestamp: Date.now() + i, docId: "d" });
}
tryAutoResolveMisconceptions(entry4);
saveVault(vault4);
assert(getActiveMisconceptions(getVaultEntry(created4.id)).length === 0, "contract: 3 positive obs auto-resolves misconceptions");

// contract: applyObservations captures wrongAnswer via session-close collectObservations
const session = {
  docId: "doc-test",
  shared: {
    conceptInventory: [{ id: "c-photos", title: "Photosynthesis" }],
    _vaultPendingObservations: [
      { conceptId: "c-photos", type: "mcq_wrong", wrongAnswer: "Respiration only", timestamp: Date.now() },
      { conceptId: "c-photos", type: "mcq_wrong", wrongAnswer: "Respiration only", timestamp: Date.now() - 1 },
      { conceptId: "c-photos", type: "mcq_wrong", wrongAnswer: "Respiration only", timestamp: Date.now() - 2 },
    ],
  },
};
const obs = collectObservations(session, "rsvp", "doc-test");
assert(
  obs.every((o) => o.type === "mcq_wrong" && o.wrongAnswer === "Respiration only"),
  "contract: collectObservations sets wrongAnswer on pending obs",
);

const vault = loadVault();
const map = { "c-photos": created.id };
const touched = applyObservations(vault, obs, map);
assert(touched.has(created.id), "contract: applyObservations returns touched entry ids");

// max 1 LLM call per session batch
let llmCalls = 0;
const e5 = addManualEntry({ canonicalTitle: "Chloroplast", topic: "biology" });
const e6 = addManualEntry({ canonicalTitle: "Stroma", topic: "biology" });
seedWrongObservations(e5.id, "Wrong A", 3);
seedWrongObservations(e6.id, "Wrong B", 3);
const batchVault = loadVault();
await runMisconceptionDetectionForEntries(batchVault, [e5.id, e6.id], {
  detectPattern: async () => {
    llmCalls += 1;
    return { description: "LLM misconception", confidence: 0.8 };
  },
});
saveVault(batchVault);
assert(llmCalls === 1, "contract: at most one LLM call per session batch");
assert(getActiveMisconceptions(getVaultEntry(e5.id)).length === 1, "contract: first entry gets LLM misconception");
assert(getActiveMisconceptions(getVaultEntry(e6.id)).length === 1, "contract: second entry gets rule-based misconception");

// grouping helper
const grouped = groupNegativeObservationsByAnswer([
  { obs: { type: "mcq_wrong", wrongAnswer: "X" }, index: 0 },
  { obs: { type: "mcq_wrong", wrongAnswer: "X" }, index: 1 },
  { obs: { type: "mcq_wrong", wrongAnswer: "Y" }, index: 2 },
]);
assert(grouped.get("x")?.length === 2, "contract: groupNegativeObservationsByAnswer clusters by answer");

// markMisconceptionResolvedOnEntry in-memory
const temp = { misconceptions: [{ id: "m1", resolved: false }] };
assert(markMisconceptionResolvedOnEntry(temp, "m1"), "contract: in-memory resolve helper");
assert(temp.misconceptions[0].resolved === true, "contract: in-memory resolved flag set");

saveVault(batchVault);

console.log(`\nT05 results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
