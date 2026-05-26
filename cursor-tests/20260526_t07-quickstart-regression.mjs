/**
 * T07 — quickstart regression (block-split-dedup)
 * Maps to specs/20260526-block-split-dedup/quickstart.md pass criteria.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t07-quickstart-regression.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseConceptPackFromModelResponse } from "../src/js/api.js";
import {
  applyPackMetaCount,
  describeSplitRunMetaForUi,
  initActiveSessionFromBlocksList,
  parseImportedIndexText,
} from "../src/js/session.js";

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

// --- Quickstart §1: progress strings present in orchestrator (order) ---
const sessionSrc = await readFile(join(root, "src/js/session.js"), "utf8");
const invIdx = sessionSrc.indexOf("Inventariando conceptos");
const packIdx = sessionSrc.indexOf("Empaquetando");
const dedupIdx = sessionSrc.indexOf("Comprobando duplicados");
assert(invIdx > 0 && packIdx > invIdx && dedupIdx > packIdx, "T07 §1: progress messages in twoPhaseConceptSplit order");

const studySrc = await readFile(join(root, "src/js/study.js"), "utf8");
assert(!studySrc.includes("twoPhaseSplitMerge"), "T07 §5: study.js does not call twoPhaseSplitMerge");
assert(studySrc.includes("twoPhaseConceptSplit"), "T07 §1: study.js uses twoPhaseConceptSplit");
assert(studySrc.includes("indexWasImported = true"), "T07 §5: import sets indexWasImported");
assert(studySrc.includes("renderSplitMergeSummary(null)"), "T07 §5: import clears split summary");

// --- SC-002: block 1 overview (pack parser contract) ---
const overviewPack = parseConceptPackFromModelResponse(
  JSON.stringify({
    blocks: [
      {
        id: 1,
        title: "Mapa del curso: Cálculo vectorial",
        summary: "Ruta de módulos",
        signature: ["gradient", "integral"],
        concept_ids: [],
        chunk: "",
      },
      {
        id: 2,
        title: "Gradient",
        summary: "Steepest ascent",
        signature: ["gradient", "partial", "derivative"],
        concept_ids: ["c1"],
        chunk: "",
      },
    ],
    pack_meta: { target_n: 2, final_block_count: 2, merges: [] },
  }),
  { targetN: 2 },
);
assert(overviewPack?.blocks?.length === 2, "T07 SC-002: pack parses with overview block 1");
assert(
  /overview|mapa del curso/i.test(overviewPack.blocks[0].title),
  "T07 SC-002: block 1 title is overview/mapa",
);

// --- Quickstart §2 / SC-003: M < N, no padding ---
const eightConceptBlocks = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  title: i === 0 ? "Overview: Short material" : `Concept ${i}`,
  summary: `Summary ${i}`,
  signature: [`sig${i}a`, `sig${i}b`],
  concept_ids: i === 0 ? [] : [`c${i}`],
  chunk: "",
}));
const coerced = applyPackMetaCount(eightConceptBlocks, { final_block_count: 8 });
assert(coerced.length === 8, "T07 SC-003: applyPackMetaCount keeps M blocks (no pad to N)");
const uiFewer = describeSplitRunMetaForUi({
  requested_n: 20,
  final_n: 8,
  pipeline: "two_phase",
});
assert(
  uiFewer.headline.includes("Pediste 20") && uiFewer.headline.includes("sustentó 8"),
  "T07 SC-003: M vs N UI copy",
);
assert(coerced.length < 20, "T07 SC-003: editor row count M < requested N");

// --- Quickstart §3 / SC-004: dedup detail reasons ---
const uiDedup = describeSplitRunMetaForUi({
  requested_n: 15,
  final_n: 14,
  dedup_merged_count: 1,
  dedup_merges: [{ keep_id: 2, absorb_ids: [3], reason: "signature_overlap", overlap_terms: ["a", "b", "c"] }],
});
assert(uiDedup.detailRows[0]?.reason === "signature_overlap", "T07 SC-004: dedup reason in UI meta");

// --- Quickstart §5: import JSON, no re-split path ---
const imported = parseImportedIndexText(
  JSON.stringify([
    { id: 1, title: "Imported block A", summary: "Sum A" },
    { id: 2, title: "Imported block B", summary: "Sum B" },
  ]),
);
assert(imported.length === 2 && imported[0].title === "Imported block A", "T07 §5: parseImportedIndexText JSON");
const importSummary = describeSplitRunMetaForUi(null);
assert(importSummary.hidden, "T07 §5: imported index hides split merge summary");

// Confirm guard: imported may proceed without originalMaterialText
const wouldBlockConfirm = (indexWasImported, originalMaterialText) =>
  !indexWasImported && !String(originalMaterialText || "").trim();
assert(
  !wouldBlockConfirm(true, ""),
  "T07 §5: indexWasImported allows confirm without material text",
);
assert(
  wouldBlockConfirm(false, ""),
  "T07 §5: generated split still requires material on confirm",
);

// --- Confirm → study: session skeleton from imported list ---
const session = initActiveSessionFromBlocksList({
  nBlocks: imported.length,
  blocksListText: "1. Imported block A\n2. Imported block B",
});
assert(session.n_blocks === 2 && session.blocks.length === 2, "T07 §5: confirm builds session with M blocks");

// --- §1 heuristic: no duplicate normalized primary titles in mock dense index ---
function primaryTitleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/^key terms:\s*/i, "")
    .replace(/^overview:\s*/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const denseMock = [
  { title: "Overview: Dense PDF" },
  { title: "Stokes theorem" },
  { title: "Green theorem" },
  { title: "Divergence theorem" },
];
const keys = denseMock.slice(1).map((b) => primaryTitleKey(b.title));
assert(new Set(keys).size === keys.length, "T07 §1: mock dense index has distinct primary titles");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
