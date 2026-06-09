/**
 * T08 — Documents library screen (unified session)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_unified-session-doc-library.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { LS_DOC_SESSIONS_KEY } from "../src/js/config.js";
import { resetStorage } from "./setup-dom.mjs";
import {
  createSession,
  getActiveSession,
  getAllSessions,
  getSmItemsDueToday,
  saveActiveSession,
  setActiveSession,
  upsertSmItem,
} from "../src/js/session-store.js";

/** Contract mapping from consumer-integration.md §8 */
function mapDocLibraryRows() {
  return getAllSessions().map((doc) => ({
    docId: doc.docId,
    title: doc.shared?.docMeta?.titleInferred || "Untitled document",
    modes: Object.entries(doc.modes || {})
      .filter(([, value]) => value != null)
      .map(([key]) => key),
    smDue: getSmItemsDueToday(doc.docId).length,
    updatedAt: doc.updatedAt || 0,
  }));
}

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

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

const [indexHtml, studySrc, uiSrc, mainCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;

// --- Static: HTML structure ---
assert(doc.getElementById("screenDocLibrary"), "T08: screenDocLibrary exists");
assert(doc.getElementById("docLibraryList"), "T08: docLibraryList container");
assert(doc.getElementById("docLibraryBackBtn"), "T08: docLibraryBackBtn");
assert(doc.getElementById("modeSelectDocLibraryBtn"), "T08: mode select link button");
assert(
  doc.getElementById("screenModeSelect")?.contains(doc.getElementById("modeSelectDocLibraryBtn")),
  "T08: My documents button on mode select screen",
);

// --- Static: study.js wiring ---
assert(studySrc.includes("export function renderDocLibrary"), "T08: renderDocLibrary exported");
assert(studySrc.includes("titleInferred"), "T08: maps titleInferred from docMeta");
assert(studySrc.includes("doc.shared?.docMeta?.titleInferred"), "T08: title from shared docMeta");
assert(studySrc.includes("export function enterDocLibraryScreen"), "T08: enterDocLibraryScreen exported");
assert(studySrc.includes("getAllSessions"), "T08: uses getAllSessions");
assert(studySrc.includes("getSmItemsDueToday"), "T08: uses getSmItemsDueToday");
assert(studySrc.includes("setActiveSession"), "T08: reopen uses setActiveSession");
assert(studySrc.includes("enterModeSelectScreen"), "T08: reopen navigates to mode select");
assert(studySrc.includes("modeSelectDocLibraryBtn"), "T08: mode select button wired");
assert(studySrc.includes("docLibraryBackBtn"), "T08: back button wired");

// --- Static: ui.js showScreen ---
assert(uiSrc.includes("screenDocLibrary"), "T08: ui els screenDocLibrary");
assert(uiSrc.includes('which === "docLibrary"'), "T08: showScreen docLibrary branch");

// --- Static: CSS ---
assert(mainCss.includes(".doc-library-list"), "T08: doc-library-list styles");
assert(mainCss.includes(".doc-library-item"), "T08: doc-library-item styles");

// --- Functional: three sessions with title, modes, smDue ---
resetStorage();

const s1 = await createSession("# Alpha Paper\n\nFirst doc.");
s1.modes.rsvp = { studyMode: "rsvp", n_blocks: 1, blocks: [] };
saveActiveSession(s1);

const s2 = await createSession("# Beta Notes\n\nSecond doc.");
s2.modes.slow = { studyMode: "slow", slow: { phase: "scope" } };
s2.modes.cloze = { studyMode: "cloze", cloze: { pipelineStatus: "normalized" } };
saveActiveSession(s2);

const s3 = await createSession("# Gamma Review\n\nThird doc.");
s3.modes.questions = { studyMode: "questions", n_blocks: 2, blocks: [] };
saveActiveSession(s3);

const yesterday = Date.now() - 86400000;
const tomorrow = Date.now() + 86400000 * 2;
upsertSmItem(s1.docId, {
  id: "sm-a",
  sourceMode: "cloze",
  question: "Q?",
  answer: "A",
  easeFactor: 2.5,
  interval: 1,
  nextReview: yesterday,
  reviewCount: 0,
});
upsertSmItem(s1.docId, {
  id: "sm-b",
  sourceMode: "rsvp",
  question: "Q2?",
  answer: "A2",
  easeFactor: 2.5,
  interval: 1,
  nextReview: tomorrow,
  reviewCount: 0,
});
upsertSmItem(s3.docId, {
  id: "sm-c",
  sourceMode: "cloze",
  question: "Q3?",
  answer: "A3",
  easeFactor: 2.5,
  interval: 1,
  nextReview: yesterday,
  reviewCount: 0,
});

const stored = JSON.parse(localStorage.getItem(LS_DOC_SESSIONS_KEY));
for (const entry of stored) {
  if (entry.docId === s1.docId) entry.updatedAt = 1000;
  if (entry.docId === s2.docId) entry.updatedAt = 2000;
  if (entry.docId === s3.docId) entry.updatedAt = 3000;
}
localStorage.setItem(LS_DOC_SESSIONS_KEY, JSON.stringify(stored));

const rows = mapDocLibraryRows();
assert(rows.length === 3, "T08: lists three sessions");

const byId = new Map(rows.map((row) => [row.docId, row]));
const row1 = byId.get(s1.docId);
const row2 = byId.get(s2.docId);
const row3 = byId.get(s3.docId);

assert(row1?.title?.includes("Alpha Paper"), "T08: title from docMeta.titleInferred");
assert(row1?.modes?.includes("rsvp"), "T08: active rsvp mode");
assert(row1?.smDue === 1, "T08: smDue counts due items for doc");
assert(getSmItemsDueToday(s1.docId).length === 1, "T08: getSmItemsDueToday contract");

assert(row2?.title?.includes("Beta Notes"), "T08: second doc title");
assert(row2?.modes?.includes("slow") && row2?.modes?.includes("cloze"), "T08: multiple active modes");
assert(row2?.smDue === 0, "T08: no sm due on second doc");

assert(row3?.title?.includes("Gamma Review"), "T08: third doc title");
assert(row3?.modes?.includes("questions"), "T08: questions mode listed");
assert(row3?.smDue === 1, "T08: third doc sm due");

assert(
  rows[0].docId === s3.docId && rows[1].docId === s2.docId && rows[2].docId === s1.docId,
  "T08: rows follow getAllSessions updatedAt desc order",
);

setActiveSession(s2.docId);
assert(getActiveSession()?.docId === s2.docId, "T08: reopen can set active session by docId");

console.log(`\nT08 unified-session doc-library: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
