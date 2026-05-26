/**
 * T01–T04 — two-phase concept split API + deterministic dedup
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t01-t04-two-phase-split-dedup.mjs
 */
import {
  buildConceptInventoryPrompt,
  buildConceptPackPrompt,
  parseConceptInventoryFromModelResponse,
  parseConceptPackFromModelResponse,
} from "../src/js/api.js";
import {
  applyPackMetaCount,
  findDeterministicDuplicateMerges,
  normalizeBlockTitle,
  normalizeSignatureTerms,
  signatureOverlapCount,
  splitMaterialIntoBlockChunks,
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

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

// --- T01: concept inventory parse ---
const inventoryJson = `{"concepts":[
  {"id":"c1","order":1,"title":"Gradient","scope_one_line":"Direction of steepest ascent"},
  {"id":"c2","order":2,"title":"Divergence","scope_one_line":"Flux per unit volume"},
  {"id":"c3","order":3,"title":"Curl","scope_one_line":"Circulation density"},
  {"id":"c4","order":4,"title":"Line integral","scope_one_line":"Work along a curve"},
  {"id":"c5","order":5,"title":"Green's theorem","scope_one_line":"Links line and double integrals"}
]}`;

const fencedInventory = "```json\n" + inventoryJson + "\n```";
const parsedInventory = parseConceptInventoryFromModelResponse(fencedInventory);
assert(parsedInventory?.length >= 5, "T01: parse ≥5 concepts from fenced JSON");
const orders = parsedInventory.map((c) => c.order);
assert(orders.every((o, i) => i === 0 || o >= orders[i - 1]), "T01: order non-decreasing after sort");

const arrayOnly = parseConceptInventoryFromModelResponse(
  '[{"id":"c1","order":1,"title":"A","scope_one_line":"s"}]',
);
assert(arrayOnly?.length === 1, "T01: accepts raw array");

assert(parseConceptInventoryFromModelResponse("not json at all") === null, "T01: invalid text → null");

assert(buildConceptInventoryPrompt("Spanish").includes("Spanish"), "T01: prompt uses language");

// --- T02: concept pack parse ---
const mockInventory = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i + 1}`,
  order: i + 1,
  title: `Concept ${i + 1}`,
  scope_one_line: `Scope ${i + 1}`,
}));

const packJson = {
  blocks: [
    {
      id: 1,
      title: "Overview: Calculus roadmap",
      summary: "Modules and milestones",
      signature: ["gradient", "integral", "theorem"],
      concept_ids: [],
      chunk: "",
    },
    {
      id: 2,
      title: "Key terms: Module A",
      summary: "6-10 terms",
      signature: ["alpha", "beta"],
      concept_ids: ["c2"],
      chunk: "",
    },
    ...Array.from({ length: 6 }, (_, i) => ({
      id: i + 3,
      title: `Topic ${i + 1}`,
      summary: `Summary ${i + 1}`,
      signature: [`sig${i}a`, `sig${i}b`, `sig${i}c`],
      concept_ids: [`c${i + 3}`],
      chunk: "",
    })),
  ],
  pack_meta: {
    target_n: 8,
    final_block_count: 8,
    merges: [{ concept_ids: ["c9", "c10"], block_title: "Merged late topics" }],
  },
};

const packed = parseConceptPackFromModelResponse(JSON.stringify(packJson), { targetN: 8 });
assert(packed?.blocks?.length === 8, "T02: mock 10 concepts + N=8 → 8 blocks");
assert(/^Overview:/i.test(packed.blocks[0].title), "T02: block 1 is overview");
assert(packed.pack_meta.final_block_count === 8, "T02: pack_meta.final_block_count");
assert(packed.pack_meta.merges.length === 1, "T02: pack_meta documents merges");

const dupConceptPack = {
  ...packJson,
  blocks: [
    packJson.blocks[0],
    { ...packJson.blocks[1], concept_ids: ["c2"] },
    { ...packJson.blocks[2], id: 3, concept_ids: ["c2"] },
  ],
};
assert(
  parseConceptPackFromModelResponse(JSON.stringify(dupConceptPack)) === null,
  "T02: duplicate concept_ids → null",
);

const noOverview = {
  blocks: [{ id: 1, title: "Topic only", summary: "s", signature: ["a"], concept_ids: [], chunk: "" }],
  pack_meta: { target_n: 1, final_block_count: 1, merges: [] },
};
assert(
  parseConceptPackFromModelResponse(JSON.stringify(noOverview)) === null,
  "T02: block 1 without overview title → null",
);

assert(buildConceptPackPrompt(8, "English", "[]").includes("8"), "T02: pack prompt includes N");

// --- T03: applyPackMetaCount + chunks ---
const trimmed = applyPackMetaCount(packJson.blocks, { final_block_count: 5 });
assert(trimmed.length === 5 && trimmed[0].id === 1 && trimmed[4].id === 5, "T03: applyPackMetaCount trims and renumbers");

const chunks = splitMaterialIntoBlockChunks("one two three four five six", 3);
assert(chunks.length === 3 && chunks.every((c) => c.length > 0), "T03: splitMaterialIntoBlockChunks non-empty");

// --- T04: deterministic dedup ---
assert(
  signatureOverlapCount(
    ["Flux", " Divergence ", "curl", "field"],
    ["flux", "divergence", "curl", "theorem"],
  ) === 3,
  "T04: overlap count 3 for flux/divergence/curl",
);
assert(normalizeSignatureTerms([" Flux "]).has("flux"), "T04: normalizeSignatureTerms lowercases");
assert(signatureOverlapCount(["a", "b"], ["a", "c"]) === 1, "T04: overlap count 1");

assert(
  normalizeBlockTitle("Key terms: Partial derivatives") === normalizeBlockTitle("partial derivatives"),
  "T04: key terms prefix stripped for title compare",
);

const syntheticIndex = [
  { id: 1, title: "Overview: Test", signature: ["a", "b", "c"], chunk: "ov" },
  { id: 2, title: "Topic A", signature: ["flux", "divergence", "curl", "field"], chunk: "a" },
  { id: 3, title: "Topic B", signature: ["flux", "divergence", "curl", "theorem"], chunk: "b" },
];
const mergePlans = findDeterministicDuplicateMerges(syntheticIndex);
assert(mergePlans.length === 1, "T04: synthetic index → one merge plan");
assert(mergePlans[0].keep_id === 2 && mergePlans[0].absorb_ids[0] === 3, "T04: merge 3 into 2");
assert(mergePlans[0].reason === "signature_overlap", "T04: reason signature_overlap");

const overlapTwoOnly = [
  { id: 1, title: "Overview: Test", signature: ["a"], chunk: "" },
  { id: 2, title: "X", signature: ["flux", "divergence", "extra"], chunk: "" },
  { id: 3, title: "Y", signature: ["flux", "divergence", "other"], chunk: "" },
];
assert(findDeterministicDuplicateMerges(overlapTwoOnly).length === 0, "T04: overlap 2 only → no merge");

const overviewVsKeyTerms = [
  { id: 1, title: "Overview: Course", signature: ["flux", "divergence", "curl"], chunk: "" },
  { id: 2, title: "Key terms: Calc", signature: ["flux", "divergence", "curl"], chunk: "" },
];
assert(
  findDeterministicDuplicateMerges(overviewVsKeyTerms).length === 0,
  "T04: overview vs key terms skipped (signature overlap)",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
