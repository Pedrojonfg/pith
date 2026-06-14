/**
 * Vault notes, connections, resumable upload — validation (spec 20260625-vault-notes-connections)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260625_vault-notes-connections.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resetStorage } from "./setup-dom.mjs";
import { VAULT_STORAGE_KEY, loadVault, saveVault, applyRelatedBacklinks, getDistinctAreas } from "../src/js/vault/vault-store.js";
import {
  buildBatchContext,
  mergeNotesForEntry,
  normalizeAreaArray,
  resolveRelatedAcceptedIds,
  commitVaultCurationItem,
  applyPersonalFieldsToEntry,
  getSiblingRelatedCandidates,
} from "../src/js/vault/vault-curation.js";
import {
  createUploadQueue,
  getPendingQueueCount,
  loadUploadQueue,
  resetStaleProcessingItems,
  UPLOAD_QUEUE_KEY,
} from "../src/js/vault/vault-upload-queue.js";
import { loadVaultSettings, saveVaultSettings } from "../src/js/vault/vault-settings.js";

let passed = 0;
let failed = 0;

function check(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

resetStorage();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");
const studyJs = readFileSync(join(root, "src/js/study.js"), "utf8");

// --- UI shell ---
check(indexHtml.includes('id="uploadVaultAutoNotes"'), "happy: auto-draft notes toggle exists");
check(indexHtml.includes('id="vaultUploadResumeBanner"'), "happy: resume banner exists");
check(indexHtml.includes('id="btnVaultUploadResume"'), "happy: resume button exists");
check(studyJs.includes("syncVaultUploadResumeBanner"), "contract: study exports resume banner sync");
check(studyJs.includes("createUploadQueue"), "contract: study uses upload queue");

// --- Migration defaults ---
saveVault({
  schemaVersion: 2,
  entries: [
    {
      id: "e-ready",
      canonicalTitle: "Ready concept",
      topic: "math",
      sources: [{ docId: "d1", conceptId: "c1", addedAt: 1 }],
      prerequisites: [],
      dependents: [],
      observations: [],
    },
    {
      id: "e-pending",
      canonicalTitle: "Pending concept",
      topic: "",
      sources: [],
      prerequisites: [],
      dependents: [],
      observations: [],
      manualOrigin: true,
    },
  ],
  reviewItems: [],
  lastUpdated: Date.now(),
});

const migrated = loadVault();
const ready = migrated.entries.find((e) => e.id === "e-ready");
const pending = migrated.entries.find((e) => e.id === "e-pending");
check(ready?.status === "ready", "migration: sources → ready");
check(pending?.status === "pending", "migration: empty sources → pending");
check(Array.isArray(ready?.area) && ready.area[0] === "math", "migration: topic → area");
check(ready?.type === "CONCEPT", "migration: default type CONCEPT");
check(migrated.schemaVersion === 3, "migration: vault schemaVersion 3");

// --- Notes append on re-curation ---
const entry = { notes: "Original note", notesUpdatedAt: 1000 };
mergeNotesForEntry(entry, "Added detail", 2000);
check(entry.notes.includes("Original note"), "notes merge: preserves original");
check(entry.notes.includes("## Update"), "notes merge: dated section");
check(entry.notesUpdatedAt === 2000, "notes merge: updates timestamp");

// --- Bidirectional backlinks ---
let vault = loadVault();
const a = vault.entries[0];
const b = vault.entries[1];
applyRelatedBacklinks(vault, a.id, [b.id]);
check(a.related?.includes(b.id), "backlinks: forward link");
check(b.related?.includes(a.id), "backlinks: reverse link");
check(b.status === "pending", "backlinks: neighbor status unchanged");

// --- resolveRelatedAcceptedIds ---
const session = {
  docId: "d1",
  shared: { conceptInventory: [{ id: "c1", label: "C1" }], docTopics: ["math"] },
};
const resolved = resolveRelatedAcceptedIds(session, ["c1", b.id]);
check(resolved.includes(b.id), "resolve related: vault id kept");
check(resolved.includes("e-ready"), "resolve related: concept id → vault entry via source");

// --- Queue resumability ---
localStorage.removeItem(UPLOAD_QUEUE_KEY);
createUploadQueue("doc-q", [
  {
    conceptId: "c1",
    payload: { definition: { accepted: false }, reviewItems: [], notes: "", area: [], tags: [], relatedAccepted: [] },
  },
]);
let queue = loadUploadQueue();
queue.items[0].status = "done";
queue.items.push({
  conceptId: "c2",
  status: "processing",
  payload: { definition: { accepted: false }, reviewItems: [], notes: "", area: [], tags: [], relatedAccepted: [] },
});
localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
queue = resetStaleProcessingItems(loadUploadQueue());
check(queue.items.find((i) => i.conceptId === "c2")?.status === "pending", "queue: stale processing → pending");
check(getPendingQueueCount(queue) === 1, "queue: pending count excludes done");

// --- Settings ---
saveVaultSettings({ autoDraftNotes: false });
check(loadVaultSettings().autoDraftNotes === false, "settings: autoDraftNotes persists");

// --- Batch context ---
const batch = buildBatchContext(
  {
    docId: "d1",
    shared: {
      conceptInventory: [
        { id: "c1", label: "A" },
        { id: "c2", label: "B" },
      ],
      docTopics: ["math"],
    },
    modes: { rsvp: { blockIndex: [{ concept_ids: ["c1", "c2"] }] } },
  },
);
check(batch.concepts.length === 2, "batch context: studied concepts");
check(getDistinctAreas(loadVault()).includes("math"), "distinct areas includes migrated topic");

check(normalizeAreaArray("physics")[0] === "physics", "normalize area single string");

// --- FR-003: topic = area[0] on curated write (happy) ---
const curated = {
  topic: "legacy",
  area: [],
  tags: [],
  notes: "",
  related: [],
  status: "pending",
};
applyPersonalFieldsToEntry(
  curated,
  { area: ["calculus", "math"], tags: ["limits"], notes: "Note body", relatedAccepted: [] },
  Date.now(),
);
check(curated.topic === "calculus", "happy: topic set from area[0]");
check(curated.status === "ready", "happy: status ready after curation fields");
check(curated.tags.includes("limits"), "happy: tags stored");

// --- Notes merge edge: empty incoming leaves unchanged ---
const unchanged = { notes: "Keep me", notesUpdatedAt: 50 };
mergeNotesForEntry(unchanged, "   ", 99);
check(unchanged.notes === "Keep me" && unchanged.notesUpdatedAt === 50, "edge: blank notes no-op");

// --- Notes merge failure guard: first write sets timestamp ---
const fresh = { notes: "", notesUpdatedAt: null };
mergeNotesForEntry(fresh, "First note", 123);
check(fresh.notes === "First note" && fresh.notesUpdatedAt === 123, "happy: first notes write");

// --- Merge mode unions area/tags (edge) ---
const mergedEntry = { area: ["math"], tags: ["a"], notes: "", related: [], status: "pending", topic: "math" };
applyPersonalFieldsToEntry(
  mergedEntry,
  { area: ["physics"], tags: ["b"], notes: "extra", relatedAccepted: [] },
  Date.now(),
  { isMerge: true },
);
check(mergedEntry.area.includes("math") && mergedEntry.area.includes("physics"), "edge: merge unions area");
check(mergedEntry.tags.includes("a") && mergedEntry.tags.includes("b"), "edge: merge unions tags");

// --- Backlinks failure: invalid target skipped ---
const vault2 = loadVault();
const only = vault2.entries[0];
const beforeRelated = [...(only.related || [])];
applyRelatedBacklinks(vault2, only.id, ["nonexistent-id"]);
check(
  JSON.stringify(only.related || []) === JSON.stringify(beforeRelated),
  "failure: invalid related id ignored",
);

// --- Sibling candidates (US2) ---
const sibs = getSiblingRelatedCandidates(batch, "c1");
check(sibs.length === 1 && sibs[0] === "c2", "happy: sibling related candidates exclude self");

// --- commitVaultCurationItem contract (consumer: vault-upload-queue) ---
resetStorage();
saveVault({ schemaVersion: 3, entries: [], reviewItems: [], lastUpdated: Date.now() });
const commitSession = {
  docId: "doc-commit",
  shared: {
    conceptInventory: [{ id: "cx", label: "Commit Test" }],
    docTopics: ["test-topic"],
  },
};
const itemResult = commitVaultCurationItem({
  session: commitSession,
  mapping: { conceptId: "cx", action: "new", vaultEntryId: null },
  payload: {
    definition: { accepted: true, text: "Def text", sourceChunk: "chunk" },
    reviewItems: [],
    notes: "My note",
    area: ["test-topic"],
    tags: ["tag1"],
    relatedAccepted: [],
  },
  batchContext: buildBatchContext(commitSession, [{ id: "cx", label: "Commit Test" }]),
});
const afterCommit = loadVault();
const committed = afterCommit.entries.find((e) => e.id === itemResult.vaultEntryId);
check(Boolean(committed), "happy: commitVaultCurationItem creates entry");
check(committed.notes === "My note", "happy: notes persisted on commit");
check(committed.status === "ready", "happy: status ready after commit");
check(committed.definitions?.length === 1, "happy: definition appended");

// --- Queue failure: corrupt storage ---
localStorage.setItem(UPLOAD_QUEUE_KEY, "{not-json");
check(loadUploadQueue() === null, "failure: corrupt queue returns null");

// --- resolveRelatedAcceptedIds failure: unknown ids dropped ---
const dropped = resolveRelatedAcceptedIds({ docId: "x", shared: {} }, ["ghost-id"]);
check(dropped.length === 0, "failure: unknown related ids resolve empty");

// --- Contract: main.js boot wires resume banner ---
const mainJs = readFileSync(join(root, "src/js/main.js"), "utf8");
check(mainJs.includes("syncVaultUploadResumeBanner"), "contract: main.js syncs resume banner on boot");

// --- Contract: vault-upload-queue exports processor ---
const queueJs = readFileSync(join(root, "src/js/vault/vault-upload-queue.js"), "utf8");
check(queueJs.includes("export async function processUploadQueue"), "contract: queue processor exported");

console.log(`\n20260625_vault-notes-connections: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
