/**
 * Session Persistence & Export Reliability — exhaustive validation (T09)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260615_session-persistence-export.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  BLOCKS_INLINE_THRESHOLD,
  LS_DOC_BLOCKS_PREFIX,
  LS_DOC_RESPONSES_PREFIX,
  LS_DOC_SESSIONS_KEY,
  LS_LAST_EXPORT_STATE_KEY,
  LS_SESSION_CONCEPTS_KEY,
  LS_V1_BACKUP_KEY,
} from "../src/js/config.js";
import {
  computePersistenceHealth,
  docBlocksKey,
  docResponsesKey,
  rehydrateBlocks,
  stripBlocksForPersist,
  tryRecoverBlocksFromV1Backup,
  writeThroughModeSlice,
} from "../src/js/block-store.js";
import { resolveModeEntryState } from "../src/js/mode-bootstrap.js";
import {
  buildMarkdown,
  buildOfflinePack,
  exportOfflinePack,
  exportSessionMarkdown,
  resolveSessionForExport,
} from "../src/js/export.js";
import {
  createSession,
  deleteSession,
  getSession,
  saveActiveSession,
  setActiveSession,
} from "../src/js/session-store.js";
import {
  hasGeneratedBlockContent,
  notifyPersistFailure,
  setOnPersistFailure,
  state,
} from "../src/js/session.js";

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

function mockDownloadApis() {
  globalThis.URL = globalThis.URL || {};
  globalThis.URL.createObjectURL = () => "blob:mock";
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.document.createElement = () => ({
    href: "",
    download: "",
    click() {},
    remove() {},
  });
  globalThis.document.body = globalThis.document.body || { appendChild() {} };
}

resetStorage();

const shells = Array.from({ length: 23 }, () => ({}));
assert(!shells.some(hasGeneratedBlockContent), "FR-004: shells have no content");

const docShell = {
  docId: "abc123",
  schemaVersion: 2,
  shared: { rawMarkdown: "# Doc\n\nText." },
  modes: { rsvp: { n_blocks: 23, blocks: shells }, slow: null, cloze: null, questions: null },
};
assert(resolveModeEntryState(docShell, "rsvp").kind === "bootstrap", "FR-004 happy: shells → bootstrap");
assert(hasGeneratedBlockContent({ questions: [{ type: "test" }] }), "FR-004 edge: questions-only");
assert(resolveModeEntryState({ ...docShell, modes: { ...docShell.modes, rsvp: { n_blocks: 1, blocks: [{ explanation: "x" }] } } }, "rsvp").kind === "resume", "FR-004 happy: content → resume");

const bigExplanation = "x".repeat(BLOCKS_INLINE_THRESHOLD + 500);
const stripped = stripBlocksForPersist({ n_blocks: 1, blocks: [{ explanation: bigExplanation }] }, "rt1");
assert(!Array.isArray(stripped.blocks) && stripped.blocksRef, "FR-003 happy: externalize");
assert(rehydrateBlocks(stripped, "rt1").blocks[0].explanation.length === bigExplanation.length, "FR-003 happy: rehydrate");
assert(Array.isArray(stripBlocksForPersist({ blocks: [{ explanation: "hi" }] }, "s1").blocks), "FR-003 edge: inline small");

resetStorage();
mockDownloadApis();
const session = await createSession("# Export\n\nDoc.");
session.modes.rsvp = {
  studyMode: "rsvp",
  n_blocks: 1,
  blocks: [{ explanation: "Persisted explanation for export." }],
  _meta: { session_id: "sess1", rev: 3 },
};
saveActiveSession(session);
setActiveSession(session.docId);
state.activeSession = null;
state.studyMode = "rsvp";
assert(resolveSessionForExport()?.blocks?.[0]?.explanation?.includes("Persisted"), "FR-006 happy: resolve from storage");

resetStorage();
state.activeSession = null;
assert(resolveSessionForExport() === null, "FR-006 failure: no session");

resetStorage();
mockDownloadApis();
const sess2 = await createSession("# Two\n\nBlocks.");
sess2.modes.rsvp = {
  studyMode: "rsvp",
  n_blocks: 1,
  blocks: [{ explanation: "Exportable explanation.", questions: [] }],
  _meta: { session_id: "sess2", rev: 1 },
};
saveActiveSession(sess2);
setActiveSession(sess2.docId);
state.activeSession = sess2.modes.rsvp;
globalThis.localStorage.setItem(LS_LAST_EXPORT_STATE_KEY, JSON.stringify({ session_id: "sess2", rev: 1 }));
assert(exportSessionMarkdown({ force: false, source: "beforeunload" }).error === "dedup", "FR-007 edge: dedup");
assert(exportSessionMarkdown({ force: true }).ok === true, "FR-007 happy: force export");
assert(buildMarkdown(sess2.modes.rsvp).includes("Exportable"), "FR-005 happy: markdown blocks");

resetStorage();
mockDownloadApis();
const sess3 = await createSession("# Offline\n\nPack.");
sess3.modes.rsvp = {
  studyMode: "rsvp",
  n_blocks: 1,
  blocks: [{ explanation: "Offline explanation.", questions: [{ type: "test", question: "Q?" }] }],
};
saveActiveSession(sess3);
setActiveSession(sess3.docId);
state.activeSession = sess3.modes.rsvp;
assert(exportOfflinePack().ok === true, "FR-009 happy: offline pack");
assert(buildOfflinePack(sess3.modes.rsvp, 0).includes("Offline explanation"), "FR-009 happy: pack content");

resetStorage();
state.activeSession = { studyMode: "rsvp", n_blocks: 3, blocks: [{}, {}, {}] };
state.studyMode = "rsvp";
assert(exportOfflinePack().error === "no_block_content", "FR-009 failure: shells rejected");

resetStorage();
globalThis.localStorage.setItem(LS_SESSION_CONCEPTS_KEY, JSON.stringify([{ term: "X" }]));
assert(computePersistenceHealth({ docId: "h1", modes: { rsvp: { blocks: shells, n_blocks: 5 } }, shared: {} }).status === "partial", "FR-010 happy: partial");
resetStorage();
assert(computePersistenceHealth({ docId: "e1", modes: { rsvp: { blocks: [], n_blocks: 0 } }, shared: {} }).status === "empty", "FR-010 failure: empty");

resetStorage();
const quotaDoc = await createSession("# Quota\n\nTest.");
const origSetItem = globalThis.localStorage.setItem.bind(globalThis.localStorage);
globalThis.localStorage.setItem = (key, value) => {
  if (String(key).includes(LS_DOC_BLOCKS_PREFIX) || key === LS_DOC_SESSIONS_KEY) {
    const err = new Error("QuotaExceededError");
    err.name = "QuotaExceededError";
    throw err;
  }
  return origSetItem(key, value);
};
quotaDoc.modes.rsvp = { studyMode: "rsvp", n_blocks: 1, blocks: [{ explanation: "z".repeat(BLOCKS_INLINE_THRESHOLD + 50) }] };
setActiveSession(quotaDoc.docId);
assert(writeThroughModeSlice(quotaDoc, "rsvp", quotaDoc.modes.rsvp).error === "quota", "FR-002 failure: quota");
globalThis.localStorage.setItem = origSetItem;

let persistErr = null;
setOnPersistFailure((e) => { persistErr = e; });
notifyPersistFailure("quota");
assert(persistErr === "quota", "FR-002 happy: notify callback");

resetStorage();
globalThis.localStorage.setItem(LS_V1_BACKUP_KEY, JSON.stringify({ sessionsByMode: { rsvp: { blocks: [{ explanation: "Recovered." }] } } }));
assert(tryRecoverBlocksFromV1Backup({ blocks: shells })?.[0]?.explanation?.includes("Recovered"), "FR-012 happy: backup");

resetStorage();
const doc2 = await createSession("# Big\n\nDoc.");
doc2.modes.rsvp = { studyMode: "rsvp", n_blocks: 1, blocks: [{ explanation: "y".repeat(BLOCKS_INLINE_THRESHOLD + 100) }] };
saveActiveSession(doc2);
assert(JSON.parse(globalThis.localStorage.getItem(LS_DOC_SESSIONS_KEY)).find((s) => s.docId === doc2.docId).modes.rsvp.blocksRef, "contract: externalize on save");
assert(getSession(doc2.docId).modes.rsvp.blocks[0].explanation.length > BLOCKS_INLINE_THRESHOLD, "FR-001: reload survival");
const bk = docBlocksKey(doc2.docId);
deleteSession(doc2.docId);
assert(!globalThis.localStorage.getItem(bk), "contract: delete removes blocks key");
assert(!globalThis.localStorage.getItem(docResponsesKey(doc2.docId)), "contract: delete removes responses key");

resetStorage();
const doc3 = await createSession("# WT\n\nDoc.");
doc3.modes.rsvp = { studyMode: "rsvp", n_blocks: 1, blocks: [{ explanation: "Write-through ok." }] };
setActiveSession(doc3.docId);
assert(writeThroughModeSlice(doc3, "rsvp", doc3.modes.rsvp).ok, "FR-001 contract: write-through");
assert(getSession(doc3.docId).modes.rsvp.blocks[0].explanation.includes("Write-through"), "FR-001 happy: persisted");

console.log(`\n20260615_session-persistence-export: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
