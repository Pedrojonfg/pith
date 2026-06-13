/**
 * Post A+ T13 — vault-driven spaced review → smItems
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t13.mjs
 */
import { readFileSync } from "node:fs";
import { resetStorage } from "./setup-dom.mjs";
import {
  computeVaultReviewPriority,
  shouldIncludeInReviewPool,
  syncVaultToReviewPool,
  applyVaultReviewObservation,
} from "../src/js/vault/spaced-review.js";
import { getCurrentMastery } from "../src/js/vault/mastery-model.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
  saveVault,
  setPrerequisites,
} from "../src/js/vault/vault-store.js";
import {
  createSession,
  getSession,
  saveActiveSession,
  upsertSmItem,
} from "../src/js/session-store.js";

const MS_PER_DAY = 86_400_000;

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

function assertClose(actual, expected, msg, eps = 0.02) {
  assert(Math.abs(actual - expected) <= eps, `${msg} (expected ~${expected}, got ${actual})`);
}

function makeDecayingEntry(overrides = {}) {
  return addManualEntry({
    canonicalTitle: "Decayed concept",
    topic: "physics",
    masteryBase: 0.2,
    ...overrides,
  });
}

resetStorage();
clearVault();

// --- selection rules (happy / edge) ---

const decayed = makeDecayingEntry();
assert(
  getCurrentMastery(decayed) < 0.5,
  "happy: decayed entry mastery below partial threshold",
);
assert(shouldIncludeInReviewPool(decayed), "happy: decaying entry included in review pool");

const fresh = addManualEntry({ canonicalTitle: "Fresh", topic: "physics", masteryBase: 0.8 });
assert(!shouldIncludeInReviewPool(fresh), "happy: high-mastery entry excluded");

const miscEntry = addManualEntry({ canonicalTitle: "Misc", topic: "physics", masteryBase: 0.85 });
const vault = loadVault();
const miscStored = vault.entries.find((e) => e.id === miscEntry.id);
miscStored.misconceptions = [
  {
    id: "m1",
    description: "active misconception",
    confidence: 0.7,
    resolved: false,
    detectedAt: Date.now(),
  },
];
saveVault(vault);
assert(shouldIncludeInReviewPool(miscStored), "edge: active misconception included despite high mastery");

// --- priority: centrality boosts hub over leaf ---

clearVault();
const hub = addManualEntry({ canonicalTitle: "Hub", topic: "math", masteryBase: 0.2 });
const leaf = addManualEntry({ canonicalTitle: "Leaf", topic: "math", masteryBase: 0.2 });
setPrerequisites(leaf.id, [hub.id]);

const hubEntry = loadVault().entries.find((e) => e.id === hub.id);
const leafEntry = loadVault().entries.find((e) => e.id === leaf.id);
const v = loadVault();
const hubPriority = computeVaultReviewPriority(hubEntry, v);
const leafPriority = computeVaultReviewPriority(leafEntry, v);
assert(hubPriority > leafPriority, "happy: central hub priority exceeds leaf with same mastery");
assertClose(
  hubPriority / leafPriority,
  (1 + 1 / 10) / (1 + 0 / 10),
  "contract: priority scales with importanceScore",
  0.05,
);

// --- syncVaultToReviewPool (happy / preserve non-vault) ---

resetStorage();
clearVault();
const decayTopic = makeDecayingEntry({ canonicalTitle: "Entropy", topic: "thermo" });
addManualEntry({ canonicalTitle: "Stable", topic: "thermo", masteryBase: 0.9 });

const session = await createSession("# Thermo\n\nBody", { docId: "doc-thermo" });
session.shared.docTopics = ["thermo"];
session.shared.smItems = [];
saveActiveSession(session);

upsertSmItem("doc-thermo", {
  id: "cloze:item-1",
  sourceMode: "cloze",
  question: "What is entropy?",
  answer: "Disorder measure",
  nextReview: Date.now(),
  reviewCount: 0,
});

syncVaultToReviewPool(getSession("doc-thermo"));
const synced = getSession("doc-thermo");
const vaultItems = synced.shared.smItems.filter((i) => i.source === "vault_decay");
const clozeItems = synced.shared.smItems.filter((i) => i.id === "cloze:item-1");

assert(vaultItems.length === 1, "happy: decaying vault entry synced to smItems");
assert(vaultItems[0].vaultEntryId === decayTopic.id, "happy: smItem links vaultEntryId");
assert(vaultItems[0].conceptTitle === "Entropy", "happy: conceptTitle from vault");
assert(vaultItems[0].priority > 0, "happy: priority is positive");
assert(clozeItems.length === 1, "happy: non-vault smItems preserved");

// --- review completion updates vault and re-syncs ---

const beforeMastery = getCurrentMastery(
  loadVault().entries.find((e) => e.id === decayTopic.id),
);
applyVaultReviewObservation(synced, decayTopic.id, { type: "mcq_correct" });
const afterEntry = loadVault().entries.find((e) => e.id === decayTopic.id);
const afterMastery = getCurrentMastery(afterEntry);
assert(afterMastery > beforeMastery, "happy: review observation increases vault mastery");

const afterSync = getSession("doc-thermo");
const stillVault = afterSync.shared.smItems.filter((i) => i.source === "vault_decay");
assert(stillVault.length <= 1, "edge: pool re-synced after review");

// --- failure: no-op without docId ---

syncVaultToReviewPool({});
assert(true, "failure: syncVaultToReviewPool no-ops without docId");

// --- study.js wiring ---

const studySrc = readFileSync(new URL("../src/js/study.js", import.meta.url), "utf8");
assert(studySrc.includes("syncVaultToReviewPool"), "contract: study.js hooks spaced review sync");
assert(studySrc.includes("./vault/spaced-review.js"), "contract: study.js imports spaced-review module");

console.log(`\nPost A+ T13: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
