/**
 * Cloze pack markdown export / import / multi-file merge
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_cloze-export-import.mjs
 */
import {
  buildClozeMarkdown,
  parseClozePackMarkdown,
  mergeClozePackSessions,
  isClozePackMarkdown,
} from "../src/js/cloze/export-import.js";
import { getValidItems } from "../src/js/cloze/normalize.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

const sampleItem = {
  id: "item_001",
  item_type: "NODE-DEF",
  sentence_original: "Democracy is a form of government.",
  sentence_with_blank: "_____ is a form of government.",
  blank_text: "Democracy",
  blank_char_start: 0,
  blank_char_end: 9,
  is_synthetic: false,
  importance: 4,
  semantic_cluster: "politics",
  options: [
    { text: "Oligarchy", is_correct: false, plausibility: "high", source: "L1" },
    { text: "Democracy", is_correct: true, plausibility: null, source: null },
    { text: "Autocracy", is_correct: false, plausibility: "medium", source: "L1" },
    { text: "Monarchy", is_correct: false, plausibility: "low", source: "L3" },
  ],
  difficulty: "medium",
  qa_status: "valid",
  times_shown: 0,
  times_correct: 0,
};

const sessionA = {
  studyMode: "cloze",
  language: "Spanish",
  materialMeta: { fileName: "tema1.md", originalFormat: "md", uploadedAt: "2026-06-07T10:00:00.000Z" },
  cloze: {
    pipelineStatus: "ready",
    items: [sampleItem],
    studyIndex: 0,
    studyStats: { correct: 0, shown: 0 },
  },
};

const sessionB = {
  studyMode: "cloze",
  language: "Spanish",
  materialMeta: { fileName: "tema2.md", originalFormat: "md", uploadedAt: "2026-06-07T11:00:00.000Z" },
  cloze: {
    pipelineStatus: "ready",
    items: [{ ...sampleItem, id: "item_002", blank_text: "Republic", sentence_with_blank: "A _____ has elected representatives." }],
    studyIndex: 0,
    studyStats: { correct: 0, shown: 0 },
  },
};

// --- Export ---
const md = buildClozeMarkdown(sessionA);
assert(md.includes("mode: cloze"), "export: frontmatter mode cloze");
assert(md.includes("# Cloze Detection Pack"), "export: title section");
assert(md.includes("item_001"), "export: human-readable item id");
assert(isClozePackMarkdown(md), "export: capsule marker detected");

// --- Round-trip single pack ---
const parsed = parseClozePackMarkdown(md, { sourceName: "tema1.md" });
assert(parsed.ok, "import: single pack parses");
assert(parsed.validCount === 1, "import: one valid item");
assert(parsed.session?.cloze?.items?.[0]?.blank_text === "Democracy", "import: item data preserved");

const roundTrip = buildClozeMarkdown(parsed.session);
const reparsed = parseClozePackMarkdown(roundTrip);
assert(reparsed.ok && reparsed.validCount === 1, "round-trip: re-import succeeds");

// --- Merge two packs ---
const merged = mergeClozePackSessions([sessionA, sessionB]);
assert(merged?.cloze?.items?.length === 2, "merge: two items combined");
assert(getValidItems(merged.cloze.items).length === 2, "merge: both items valid");
assert(String(merged.materialMeta?.fileName).includes("2 packs"), "merge: label reflects pack count");

// --- Merge with duplicate ids renames ---
const dupB = {
  ...sessionB,
  cloze: { ...sessionB.cloze, items: [{ ...sampleItem, id: "item_001" }] },
};
const mergedDup = mergeClozePackSessions([sessionA, dupB]);
const ids = mergedDup.cloze.items.map((i) => i.id);
assert(ids.length === 2 && new Set(ids).size === 2, "merge: duplicate ids get unique suffix");

// --- Failure: no capsule ---
const bad = parseClozePackMarkdown("# Not a cloze pack\n\nHello");
assert(!bad.ok && bad.reason === "missing_capsule", "failure: rejects markdown without capsule");

console.log(`\n20260607_cloze-export-import: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
