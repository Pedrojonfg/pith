/**
 * Concept inventory truncation + map-reduce — Phase 1 fix and chunk builder.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260616_inventory-truncation-map-reduce.mjs
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONCEPT_INVENTORY_MAX_TOKENS,
  CONCEPT_INVENTORY_CHUNK_MAX_TOKENS,
  CONCEPT_INVENTORY_MERGE_MAX_TOKENS,
  INVENTORY_TARGET_CHUNK_WORDS,
  looksLikeTruncatedModelJson,
  parseConceptInventoryFromModelResponse,
  buildInventoryChunks,
} from "../src/js/api.js";

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

section("T01 truncation detection — bug report fragment");

const truncatedPhilosophy = `{
  "concepts": [
    {
      "id": "c1",
      "order": 1,
      "title": "Idealismo vs. Materialismo",
      "scope_one_line": "Dos corrientes filosóficas opuestas para explicar la realidad.",
      "source_phrase": "La concepción idealista ha sido la dominante…",
      "anchor_type": "cited",
      "module": "Introducción",
      "prerequisite_ids": [],
      "concept_type": "distinction"
    },
    {
      "id": "c2",
      "order": 2,
      "title": "Empirismo y Contrato Social",
      "scope_one_line": "Crítica a Locke y Hobbes…",
      "source_phrase": "Locke llega a la idea del contrato social y no es capaz de ubicar su a`;

assert(
  looksLikeTruncatedModelJson(truncatedPhilosophy) === true,
  "T01: philosophy log fragment cuts mid source_phrase → truncated",
);

section("T02 short invalid JSON → not truncated");

assert(
  looksLikeTruncatedModelJson('{"concepts":[') === false,
  "T02: short invalid fragment → not truncated",
);

section("T03–T04 token constants");

assert(
  typeof CONCEPT_INVENTORY_MAX_TOKENS === "number" && CONCEPT_INVENTORY_MAX_TOKENS > 8192,
  "T03: CONCEPT_INVENTORY_MAX_TOKENS > 8192",
);
assert(
  typeof CONCEPT_INVENTORY_CHUNK_MAX_TOKENS === "number" && CONCEPT_INVENTORY_CHUNK_MAX_TOKENS > 0,
  "T04a: CONCEPT_INVENTORY_CHUNK_MAX_TOKENS exported",
);
assert(
  typeof CONCEPT_INVENTORY_MERGE_MAX_TOKENS === "number" && CONCEPT_INVENTORY_MERGE_MAX_TOKENS > 0,
  "T04b: CONCEPT_INVENTORY_MERGE_MAX_TOKENS exported",
);

section("T05 parseConceptInventoryFromModelResponse");

const completeC1 = JSON.stringify({
  concepts: [
    {
      id: "c1",
      order: 1,
      title: "Idealismo vs. Materialismo",
      scope_one_line: "Dos corrientes filosóficas opuestas para explicar la realidad.",
      source_phrase: "La concepción idealista ha sido la dominante…",
      anchor_type: "cited",
    },
  ],
});
const parsed = parseConceptInventoryFromModelResponse(completeC1);
assert(Array.isArray(parsed) && parsed[0]?.id === "c1" && parsed[0]?.title, "T05: complete c1 parses");

section("T06 buildInventoryChunks — 6 sections");

function words(n) {
  return Array(n).fill("word").join(" ");
}

const mockTree = [
  { title: "S1", startOffset: 0, endOffset: words(500).length, children: [] },
  {
    title: "S2",
    startOffset: words(500).length + 2,
    endOffset: words(500).length + 2 + words(800).length,
    children: [],
  },
  {
    title: "S3",
    startOffset: words(500).length + 2 + words(800).length + 2,
    endOffset: words(500).length + 2 + words(800).length + 2 + words(1200).length,
    children: [],
  },
  {
    title: "S4",
    startOffset:
      words(500).length + 2 + words(800).length + 2 + words(1200).length + 2,
    endOffset:
      words(500).length +
      2 +
      words(800).length +
      2 +
      words(1200).length +
      2 +
      words(2000).length,
    children: [],
  },
  {
    title: "S5",
    startOffset:
      words(500).length +
      2 +
      words(800).length +
      2 +
      words(1200).length +
      2 +
      words(2000).length +
      2,
    endOffset:
      words(500).length +
      2 +
      words(800).length +
      2 +
      words(1200).length +
      2 +
      words(2000).length +
      2 +
      words(3000).length,
    children: [],
  },
  {
    title: "S6",
    startOffset:
      words(500).length +
      2 +
      words(800).length +
      2 +
      words(1200).length +
      2 +
      words(2000).length +
      2 +
      words(3000).length +
      2,
    endOffset:
      words(500).length +
      2 +
      words(800).length +
      2 +
      words(1200).length +
      2 +
      words(2000).length +
      2 +
      words(3000).length +
      2 +
      words(4000).length,
    children: [],
  },
];

let offset = 0;
const parts = [500, 800, 1200, 2000, 3000, 4000].map((n) => {
  const t = words(n);
  const start = offset;
  offset += t.length + 2;
  return { text: t, start, end: start + t.length };
});
const markdown = parts.map((p) => p.text).join("\n\n");
const tree = parts.map((p, i) => ({
  title: `S${i + 1}`,
  startOffset: p.start,
  endOffset: p.end,
  children: [],
}));

const chunks6 = buildInventoryChunks({ tree }, markdown);
assert(chunks6 && chunks6.length >= 2, "T06: ≥2 chunks from 6 sections");
const maxWords = INVENTORY_TARGET_CHUNK_WORDS * 1.5;
assert(
  chunks6.every((c) => c.wordCount <= maxWords + 50),
  "T06: no chunk exceeds TARGET_CHUNK_WORDS * 1.5 (with margin)",
);

section("T07 single section → null");

const singleMd = words(500);
const singleTree = [{ title: "Only", startOffset: 0, endOffset: singleMd.length, children: [] }];
assert(buildInventoryChunks({ tree: singleTree }, singleMd) === null, "T07: single section → null");

section("T08–T10 source hygiene");

const leversSrc = await readFile(join(root, "src/js/pipeline-levers.js"), "utf8");
assert(!leversSrc.includes("twoPassInventory"), "T08: pipeline-levers has no twoPassInventory");

const sessionSrc = await readFile(join(root, "src/js/session.js"), "utf8");
assert(!sessionSrc.includes("twoPassInventory"), "T09: session.js has no twoPassInventory");

const studySrc = await readFile(join(root, "src/js/study.js"), "utf8");
assert(!studySrc.includes("127.0.0.1") && !studySrc.includes(":7501"), "T10: study.js has no debug ingest");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
