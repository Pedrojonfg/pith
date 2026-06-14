/**
 * SM-2 Priority Queue integration tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260620_sm2-priority-queue.mjs
 */
import { readFileSync } from "node:fs";
import { resetStorage } from "./setup-dom.mjs";
import {
  buildReviewQueue,
  isOnTime,
  normalizeSmItem,
  updateSmItem,
} from "../src/js/sm2.js";
import {
  mapClozeResultToQuality,
  mapMcqOutcomeToQuality,
  registerOrUpdateSmItem,
} from "../src/js/sm2-ingest.js";
import { getQueueStats } from "../src/js/sm2.js";
import {
  createSession,
  getSession,
  getSmItemsDueToday,
  saveActiveSession,
  upsertSmItem,
} from "../src/js/session-store.js";
import { syncVaultToReviewPool } from "../src/js/vault/spaced-review.js";
import { addManualEntry, clearVault } from "../src/js/vault/vault-store.js";

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

resetStorage();
clearVault();

// --- legacy normalization on read ---

const legacy = {
  id: "cloze:legacy-1",
  sourceMode: "cloze",
  question: "Legacy Q",
  answer: "Legacy A",
  nextReview: 50_000,
  reviewCount: 1,
};
const norm = normalizeSmItem(legacy);
assert(norm?.scheduledDue === 50_000, "normalize: nextReview → scheduledDue");
assert(norm?.sourceType === "cloze_item", "normalize: cloze sourceMode");

const session = await createSession("# SM2\n\nTest", { docId: "doc-sm2" });
upsertSmItem("doc-sm2", legacy);
const loaded = getSession("doc-sm2").shared.smItems[0];
assert(loaded.sourceType === "cloze_item", "session-store: legacy upsert canonicalizes");
assert(loaded.scheduledDue === 50_000, "session-store: scheduledDue persisted");

// --- early vs on-time update ---

const now = 1_000_000;
const earlyItem = {
  id: "test:early",
  sourceType: "rsvp_block",
  sourceId: "b1",
  docId: "doc-sm2",
  title: "Early",
  contentPreview: "",
  interval: 10,
  easeFactor: 2.5,
  repetitions: 1,
  scheduledDue: now + 10 * MS_PER_DAY,
  lastReviewed: now - MS_PER_DAY,
  observations: [],
  createdAt: now,
};
assert(!isOnTime(earlyItem, now + MS_PER_DAY), "early: before threshold");
const earlyUpdated = updateSmItem(earlyItem, 5, now + MS_PER_DAY);
assert(earlyUpdated.interval === earlyItem.interval, "early: interval unchanged");

const onTimeItem = {
  id: "test:ontime",
  sourceType: "rsvp_block",
  sourceId: "b1",
  docId: "doc-sm2",
  title: "On time",
  contentPreview: "",
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  scheduledDue: now,
  lastReviewed: null,
  observations: [],
  createdAt: now,
};
const onTimeUpdated = updateSmItem(onTimeItem, 4, now);
assert(onTimeUpdated.interval > onTimeItem.interval || onTimeUpdated.repetitions > onTimeItem.repetitions, "on-time: SM-2 advances");

// --- queue ordering ---

const q = buildReviewQueue([
  { ...onTimeItem, scheduledDue: 300 },
  { ...onTimeItem, id: "a", sourceId: "a", scheduledDue: 100 },
  { ...onTimeItem, id: "b", sourceId: "b", scheduledDue: 200 },
]);
assert(q[0].sourceId === "a" && q[2].scheduledDue === 300, "queue: scheduledDue ascending");

// --- RSVP ingest ---

const quality = mapMcqOutcomeToQuality({ correct: true, firstTry: true });
assert(quality === 5, "MCQ mapping: correct first try → 5");
registerOrUpdateSmItem("doc-sm2", {
  sourceType: "rsvp_block",
  sourceId: "block-42",
  title: "Block 42",
  contentPreview: "concept-a",
  quality,
});
registerOrUpdateSmItem("doc-sm2", {
  sourceType: "rsvp_block",
  sourceId: "block-42",
  title: "Block 42 updated",
  contentPreview: "concept-a",
  quality: 4,
});
const rsvpItems = getSession("doc-sm2").shared.smItems.filter((i) => i.sourceType === "rsvp_block");
assert(rsvpItems.length === 1, "ingest: single item per blockId");
assert(rsvpItems[0].observations?.length >= 2, "ingest: quality updates append observations");

// --- vault + cloze coexistence ---

clearVault();
addManualEntry({ canonicalTitle: "Decay", topic: "sm2", masteryBase: 0.2 });
const vaultSession = getSession("doc-sm2");
vaultSession.shared.docTopics = ["sm2"];
saveActiveSession(vaultSession);
syncVaultToReviewPool(getSession("doc-sm2"));
const mixed = getSession("doc-sm2").shared.smItems;
assert(mixed.some((i) => i.sourceType === "vault_concept"), "vault: concept in pool");
assert(mixed.some((i) => i.sourceType === "cloze_item"), "vault sync: cloze preserved");

// --- getSmItemsDueToday regression ---

const tomorrow = Date.now() + MS_PER_DAY * 2;
upsertSmItem("doc-sm2", {
  id: "due-today",
  sourceType: "rsvp_block",
  sourceId: "due-1",
  docId: "doc-sm2",
  title: "Due",
  contentPreview: "",
  scheduledDue: Date.now() - 1000,
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  observations: [],
  createdAt: Date.now(),
});
upsertSmItem("doc-sm2", {
  id: "due-later",
  sourceType: "rsvp_block",
  sourceId: "due-2",
  docId: "doc-sm2",
  title: "Later",
  contentPreview: "",
  scheduledDue: tomorrow,
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  observations: [],
  createdAt: Date.now(),
});
const dueToday = getSmItemsDueToday("doc-sm2");
assert(dueToday.some((i) => i.id === "due-today"), "getSmItemsDueToday: includes overdue");
assert(!dueToday.some((i) => i.id === "due-later"), "getSmItemsDueToday: excludes far future");

// --- edge: MCQ quality mapping (skip / wrong) ---

assert(mapMcqOutcomeToQuality({ skipped: true }) === 2, "MCQ skip → quality 2");
assert(mapMcqOutcomeToQuality({ correct: false }) === 1, "MCQ wrong → quality 1");
assert(mapClozeResultToQuality("HARD") === 3, "Cloze HARD → quality 3");

// --- edge: getQueueStats for badge ---

const badgeStats = getQueueStats(getSession("doc-sm2").shared.smItems);
assert(badgeStats.dueNow >= 1, "badge: dueNow > 0 with seeded overdue item");
assert(badgeStats.total >= 2, "badge: total includes mixed items");

// --- failure: ingest without session ---

let ingestThrew = false;
try {
  registerOrUpdateSmItem("missing-doc", {
    sourceType: "rsvp_block",
    sourceId: "x",
    title: "X",
    contentPreview: "",
  });
} catch {
  ingestThrew = true;
}
assert(ingestThrew, "ingest: throws when session missing");

// --- contract: upsert by sourceType+sourceId (not duplicate id) ---

upsertSmItem("doc-sm2", {
  id: "alt-id",
  sourceType: "cloze_item",
  sourceId: "legacy-1",
  docId: "doc-sm2",
  title: "Merged",
  contentPreview: "A",
  scheduledDue: Date.now(),
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  observations: [],
  createdAt: Date.now(),
});
const clozeMerged = getSession("doc-sm2").shared.smItems.filter(
  (i) => i.sourceType === "cloze_item" && i.sourceId === "legacy-1",
);
assert(clozeMerged.length === 1, "upsert: merge by sourceType+sourceId");
assert(clozeMerged[0].title === "Merged", "upsert: merged title wins");

// --- wiring contracts ---

const studySrc = readFileSync(new URL("../src/js/study.js", import.meta.url), "utf8");
assert(studySrc.includes("refreshVaultReviewBadge"), "study.js: vault review badge refresh");
assert(studySrc.includes("runVaultSm2ReviewSession"), "study.js: vault review session wiring");

const reviewSrc = readFileSync(new URL("../src/js/review.js", import.meta.url), "utf8");
assert(reviewSrc.includes("runVaultSm2ReviewSession"), "review.js: vault SM-2 session export");
assert(reviewSrc.includes("runSm2ReviewSession"), "review.js: per-doc SM-2 session export");
assert(reviewSrc.includes("reviewSm2EarlyChip"), "review.js: early review chip wiring");

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert(indexHtml.includes("btnVaultReview"), "index.html: vault Review button on doc library");
assert(indexHtml.includes("vaultReviewBadge"), "index.html: vault review badge markup");

console.log(`\nSM-2 priority queue: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
