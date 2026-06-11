/**
 * Concept pack truncation fix — max_tokens, truncation detection, pack fallback.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260611_concept-pack-truncation-fix.mjs
 *
 * Source: prompt-fallback (bugfix for RSVP concept pack JSON truncation)
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONCEPT_PACK_MAX_TOKENS,
  looksLikeTruncatedModelJson,
  parseConceptPackFromModelResponse,
  slimInventoryForPack,
} from "../src/js/api.js";
import { packInventoryDeterministic } from "../src/js/session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ── T01: truncation detection ──

section("T01 looksLikeTruncatedModelJson");

const completePack = JSON.stringify({
  blocks: [
    {
      id: 1,
      title: "Overview: Ética",
      summary: "Curso completo.",
      signature: ["ética"],
      concept_ids: [],
      chunk: "",
    },
  ],
  pack_meta: { target_n: 1, final_block_count: 1, merges: [] },
});

assert(looksLikeTruncatedModelJson(completePack) === false, "T01 happy: complete JSON → not truncated");

const shortGarbage = '{"blocks":[';
assert(
  looksLikeTruncatedModelJson(shortGarbage) === false,
  "T01 edge: short invalid fragment (<200 chars) → not truncated",
);

const truncatedFromLogs = `{
  "blocks": [
    {
      "id": 1,
      "title": "Overview: Curso de Ética",
      "summary": "Este curso explora las principales teorías éticas.",
      "signature": ["ética", "moral", "teorías éticas", "curso"],
      "concept_ids": [],
      "chunk": ""
    },
    {
      "id": 2,
      "title": "Key terms: Introducción",
      "summary": "Vocabulario esencial del módulo.",
      "signature": ["ética", "moral", "normas morales", "normas jurídicas", "normas sociales", "ética antigua", "é`;

assert(
  looksLikeTruncatedModelJson(truncatedFromLogs) === true,
  "T01 failure: long cut-off JSON (user log pattern) → truncated",
);

assert(looksLikeTruncatedModelJson("") === false, "T01 failure: empty string → not truncated");

// ── T02: parse still accepts Spanish overview ──

section("T02 parseConceptPackFromModelResponse");

const spanishOverviewPack = {
  blocks: [
    {
      id: 1,
      title: "Mapa del curso: Ética",
      summary: "Vista general del curso.",
      signature: ["ética", "moral"],
      concept_ids: [],
      chunk: "",
    },
    {
      id: 2,
      title: "Key terms: Introducción",
      summary: "Términos clave.",
      signature: ["t1", "t2", "t3"],
      concept_ids: ["c1"],
      chunk: "",
    },
  ],
  pack_meta: { target_n: 2, final_block_count: 2, merges: [] },
};

const parsedSpanish = parseConceptPackFromModelResponse(JSON.stringify(spanishOverviewPack), {
  targetN: 2,
});
assert(parsedSpanish?.blocks?.length === 2, "T02 happy: Mapa del curso overview parses");
assert(
  /^Mapa del curso:/i.test(parsedSpanish.blocks[0].title),
  "T02 happy: preserves Spanish overview title",
);

assert(
  parseConceptPackFromModelResponse(truncatedFromLogs, { targetN: 8 }) === null,
  "T02 failure: truncated model output → null (cannot parse)",
);

// ── T03: max_tokens contract in api.js ──

section("T03 api.js pack call contract");

assert(CONCEPT_PACK_MAX_TOKENS >= 8192, "T03 happy: CONCEPT_PACK_MAX_TOKENS is large enough for pack JSON");

const longScope = Array.from({ length: 12 }, (_, i) => ({
  id: `c${i + 1}`,
  order: i + 1,
  title: `Concept ${i + 1}`,
  scope_one_line: "x".repeat(200),
  module: i < 4 ? "Intro" : "Ethics",
}));
const slim = slimInventoryForPack(longScope);
assert(
  slim.every((c) => String(c.scope_one_line).length <= 100),
  "T03 edge: slimInventoryForPack caps scope_one_line",
);

const det = packInventoryDeterministic(longScope, 8, "Español");
assert(det.blocks.length >= 2 && det.blocks.length <= 8, "T06 happy: deterministic pack respects N");
assert(/^Mapa del curso:/i.test(det.blocks[0].title), "T06 happy: Spanish overview");
const detIds = new Set(det.blocks.flatMap((b) => b.concept_ids || []));
assert(detIds.size >= 8, "T06 happy: deterministic pack assigns concepts");
assert(det.pack_meta.deterministic === true, "T06 contract: pack_meta.deterministic");

assert(packInventoryDeterministic([], 5).blocks.length === 0, "T06 failure: empty inventory → no blocks");

async function testApiSourceContract() {
  const apiSrc = await readFile(join(root, "src/js/api.js"), "utf8");
  assert(apiSrc.includes("max_tokens: CONCEPT_PACK_MAX_TOKENS"), "T03 contract: pack passes max_tokens");
  assert(apiSrc.includes("looksLikeTruncatedModelJson(lastRaw)"), "T03 contract: tracks truncation on retry");
  assert(
    apiSrc.includes("Model response was cut off before finishing the block pack"),
    "T03 contract: truncation-specific user error",
  );
  assert(apiSrc.includes("terse: true"), "T03 contract: terse retry attempt for smaller output");
}

// ── T04: packInventoryToBlocks fallback contract ──

section("T04 session.js pack fallback contract");

async function testSessionFallbackContract() {
  const sessionSrc = await readFile(join(root, "src/js/session.js"), "utf8");
  assert(
    sessionSrc.includes("packInventoryToBlocks: falling back to mono split"),
    "T04 happy: pack failure logs fallback",
  );
  assert(sessionSrc.includes("deepSeekSplitIntoBlocks"), "T04 happy: fallback uses mono split");
  assert(sessionSrc.includes("pack_fallback_reason"), "T04 contract: splitRunMeta records fallback reason");
  assert(sessionSrc.includes('pipeline: "fallback_mono"'), "T04 contract: fallback pipeline tag");
  assert(sessionSrc.includes("packInventoryDeterministic"), "T04 contract: deterministic fallback exists");
  assert(sessionSrc.includes('api.js?v=20260611_2'), "T04 contract: dynamic api import cache-busted");
  assert(sessionSrc.includes("deterministic_fallback"), "T04 contract: deterministic_fallback pipeline tag");
}

// ── T05: consumer contract (study.js still uses packInventoryToBlocks) ──

section("T05 study.js consumer contract");

async function testStudyConsumerContract() {
  const studySrc = await readFile(join(root, "src/js/study.js"), "utf8");
  assert(studySrc.includes("packInventoryToBlocks"), "T05 contract: study.js still calls packInventoryToBlocks");
  assert(studySrc.includes("runPrePackingPack"), "T05 contract: pre-packing path uses runPrePackingPack");
}

await testApiSourceContract();
await testSessionFallbackContract();
await testStudyConsumerContract();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
