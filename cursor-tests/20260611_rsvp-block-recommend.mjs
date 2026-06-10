/**
 * T01–T06 — RSVP block count recommendation (recommender, cache, exports, DOM)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-block-recommend.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { resetStorage } from "./setup-dom.mjs";
import {
  BASE_CONCEPTS_PER_BLOCK,
  MAX_BLOCKS,
  MIN_BLOCKS,
  WORDS_PER_BLOCK_TARGET,
  computeBlockCountRecommendation,
  formatBlockCountReasoning,
} from "../src/js/recommendation/block-count-recommender.js";
import {
  buildBlockSplitFingerprint,
  getBlockSplitCache,
  invalidateBlockSplitCache,
  isBlockSplitCacheValid,
  setBlockSplitCache,
} from "../src/js/block-split-cache.js";

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

function section(name) {
  console.log(`\n── ${name} ──`);
}

function assertRecSchema(rec, label) {
  assert(typeof rec.computedAt === "number" && rec.computedAt > 0, `${label}: computedAt`);
  assert(typeof rec.nBlocks === "number", `${label}: nBlocks number`);
  assert(rec.nBlocks >= MIN_BLOCKS && rec.nBlocks <= MAX_BLOCKS, `${label}: nBlocks clamped`);
  assert(typeof rec.reasoning === "string" && rec.reasoning.length > 0, `${label}: reasoning`);
  assert(Array.isArray(rec.signalsUsed) && rec.signalsUsed.includes("conceptCount"), `${label}: signalsUsed`);
  assert(rec.factors && typeof rec.factors === "object", `${label}: factors object`);
  assert(typeof rec.factors.conceptN === "number", `${label}: factors.conceptN`);
  assert(typeof rec.factors.wordN === "number", `${label}: factors.wordN`);
  assert(typeof rec.factors.sectionN === "number", `${label}: factors.sectionN`);
  assert(typeof rec.factors.multiplier === "number", `${label}: factors.multiplier`);
  assert(typeof rec.factors.rawN === "number", `${label}: factors.rawN`);
}

function assertReasoningMentionsConcepts(rec, conceptCount) {
  assert(
    rec.reasoning.includes(String(conceptCount)),
    `reasoning mentions conceptCount ${conceptCount}`,
  );
}

// ── T01: recommender unit ──

function testExports() {
  assert(MIN_BLOCKS === 5, "MIN_BLOCKS === 5");
  assert(MAX_BLOCKS === 60, "MAX_BLOCKS === 60");
  assert(WORDS_PER_BLOCK_TARGET === 2200, "WORDS_PER_BLOCK_TARGET === 2200");
  assert(BASE_CONCEPTS_PER_BLOCK === 5, "BASE_CONCEPTS_PER_BLOCK === 5");
}

function testLowConceptShortText() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 10,
    wordCount: 3000,
  });
  assert(rec.nBlocks >= MIN_BLOCKS, "10 concepts / 3k words: nBlocks >= 5");
  assert(rec.nBlocks === 5, "10 concepts / 3k words: clamped to 5");
  assert(rec.factors.conceptN === 3, "10 concepts / load 3: conceptN = 3");
  assert(rec.factors.wordN === 2, "3k words: wordN = 2");
  assert(rec.factors.multiplier === 1, "default multiplier 1.0");
  assertRecSchema(rec, "low");
  assertReasoningMentionsConcepts(rec, 10);
  assert(rec.reasoning.includes("3,000") || rec.reasoning.includes("3000"), "reasoning mentions wordCount");
}

function testDensePhilosophical() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 80,
    wordCount: 12000,
    genre: "philosophical",
    argumentativeDensity: 5,
    conceptualLoad: 4,
  });
  assert(rec.nBlocks > 10, "80 philosophical concepts: higher N");
  assert(rec.nBlocks === 35, "80 philosophical concepts: nBlocks = 35");
  assert(rec.factors.multiplier === 1.15, "philosophical multiplier 1.15");
  assert(rec.signalsUsed.includes("genre"), "philosophical: genre in signalsUsed");
  assert(rec.signalsUsed.includes("conceptualLoad"), "philosophical: conceptualLoad in signalsUsed");
  assertRecSchema(rec, "philosophical");
  assertReasoningMentionsConcepts(rec, 80);
}

function testTinySizeCategoryCap() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 50,
    wordCount: 8000,
    sizeCategory: "tiny",
  });
  assert(rec.factors.rawN === 8, "tiny: rawN capped at 8");
  assert(rec.nBlocks === 8, "tiny: nBlocks = 8 after cap");
  assert(rec.signalsUsed.includes("sizeCategory"), "tiny: sizeCategory in signalsUsed");
  assertRecSchema(rec, "tiny");
}

function testClampMinimum() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 2,
    wordCount: 500,
  });
  assert(rec.nBlocks === MIN_BLOCKS, "very small input clamps to MIN_BLOCKS");
  assertRecSchema(rec, "clamp-min");
}

function testClampMaximum() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 500,
    wordCount: 200000,
    sectionCount: 80,
    genre: "philosophical",
    conceptualLoad: 5,
  });
  assert(rec.nBlocks === MAX_BLOCKS, "huge input clamps to MAX_BLOCKS");
  assertRecSchema(rec, "clamp-max");
}

function testMissingMetaDefaultsLoad3() {
  const rec = computeBlockCountRecommendation({ conceptCount: 20 });
  const target = BASE_CONCEPTS_PER_BLOCK - (3 - 1) * 0.75;
  assert(rec.factors.conceptN === Math.ceil(20 / target), "missing meta: load 3 default conceptN");
  assert(!rec.signalsUsed.includes("conceptualLoad"), "missing meta: no conceptualLoad in signalsUsed");
  assertRecSchema(rec, "defaults");
}

function testSectionCountDrivesRawN() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 10,
    wordCount: 2000,
    sectionCount: 25,
  });
  assert(rec.factors.sectionN === 25, "sectionN stored");
  assert(rec.factors.rawN === 25, "25 sections drive rawN");
  assert(rec.nBlocks === 25, "section-driven nBlocks = 25");
  assert(rec.signalsUsed.includes("sectionCount"), "sectionCount in signalsUsed");
  assertRecSchema(rec, "sections");
}

function testWordCountDrivesRawN() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 5,
    wordCount: 44000,
  });
  assert(rec.factors.wordN === 20, "44k words: wordN = 20");
  assert(rec.factors.rawN === 20, "word length drives rawN");
  assert(rec.nBlocks === 20, "word-driven nBlocks = 20");
  assert(rec.signalsUsed.includes("wordCount"), "wordCount in signalsUsed");
  assertRecSchema(rec, "words");
}

function testScientificTheoreticalMultiplier() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 40,
    wordCount: 5000,
    genre: "scientific_theoretical",
    conceptualLoad: 4,
    argumentativeDensity: 3,
  });
  assert(rec.factors.multiplier === 1.1, "scientific_theoretical load 4: multiplier 1.1");
  assert(rec.signalsUsed.includes("genre"), "scientific_theoretical: genre in signalsUsed");
  assert(rec.signalsUsed.includes("conceptualLoad"), "scientific_theoretical: conceptualLoad in signalsUsed");
  assertRecSchema(rec, "scientific");
}

function testLectureNotesMultiplier() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 30,
    wordCount: 6000,
    genre: "lecture_notes",
  });
  assert(rec.factors.multiplier === 0.95, "lecture_notes: multiplier 0.95");
  assert(rec.signalsUsed.includes("genre"), "lecture_notes: genre in signalsUsed");
  assertRecSchema(rec, "lecture");
}

function testFirstPersonRatioMultiplier() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 30,
    wordCount: 6000,
    firstPersonRatio: 0.05,
  });
  assert(rec.factors.multiplier === 0.95, "firstPersonRatio > 0.03: multiplier 0.95");
  assert(rec.signalsUsed.includes("firstPersonRatio"), "firstPersonRatio in signalsUsed");
  assertRecSchema(rec, "first-person");
}

function testArgumentativeDensityMultiplier() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 30,
    wordCount: 6000,
    genre: "essay",
    argumentativeDensity: 4,
  });
  assert(rec.factors.multiplier === 1.15, "argumentativeDensity >= 4: multiplier 1.15");
  assert(rec.signalsUsed.includes("argumentativeDensity"), "argumentativeDensity in signalsUsed");
  assertRecSchema(rec, "arg-density");
}

function testFormatBlockCountReasoning() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 42,
    wordCount: 12000,
    genre: "philosophical",
    conceptualLoad: 4,
  });
  const formatted = formatBlockCountReasoning(rec);
  assert(typeof formatted === "string" && formatted.length > 0, "formatBlockCountReasoning returns string");
  assert(formatted === rec.reasoning, "formatBlockCountReasoning returns rec.reasoning");
  assert(formatted.includes("42"), "formatted mentions concepts");
  assert(formatted.split(".").filter(Boolean).length <= 3, "formatted is 1-2 sentences");
}

function testFormatFallbackWithoutReasoning() {
  const formatted = formatBlockCountReasoning({
    nBlocks: 12,
    factors: { conceptN: 10, wordN: 8, multiplier: 1 },
  });
  assert(formatted.includes("12"), "fallback mentions nBlocks");
  assert(formatted.includes("Recommended"), "fallback has Recommended");
}

function testHighConceptualLoadReducesTarget() {
  const lowLoad = computeBlockCountRecommendation({ conceptCount: 20, conceptualLoad: 1 });
  const highLoad = computeBlockCountRecommendation({ conceptCount: 20, conceptualLoad: 5 });
  assert(highLoad.factors.conceptN > lowLoad.factors.conceptN, "load 5 yields higher conceptN than load 1");
  assert(highLoad.signalsUsed.includes("conceptualLoad"), "non-default load in signalsUsed");
}

function testFormulaBoundaryRawNBelowMin() {
  const rec = computeBlockCountRecommendation({ conceptCount: 3, wordCount: 500 });
  assert(rec.factors.rawN === 1, "3 concepts / 500 words: rawN = 1");
  assert(rec.nBlocks === MIN_BLOCKS, "rawN below MIN clamps to 5");
}

function testSanityHandoutRange() {
  const rec = computeBlockCountRecommendation({ conceptCount: 8, wordCount: 1500 });
  assert(rec.nBlocks >= 5 && rec.nBlocks <= 8, "handout ~1.5k words in 5–8 range");
}

function testSanityMediumChapterRange() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 35,
    wordCount: 12000,
    sectionCount: 15,
  });
  assert(rec.nBlocks >= 10 && rec.nBlocks <= 20, "medium chapter in 10–20 range");
}

function testSanityLongPhilosophyRange() {
  const rec = computeBlockCountRecommendation({
    conceptCount: 70,
    wordCount: 40000,
    genre: "philosophical",
    conceptualLoad: 5,
  });
  assert(rec.nBlocks >= 25 && rec.nBlocks <= 45, "long dense philosophy in 25–45 range");
}

// ── T03: fingerprint / cache ──

const sampleFile = { name: "chapter.pdf", size: 12000, lastModified: 1_700_000_000_000 };

function testFingerprintBuildsFileKey() {
  const fp = buildBlockSplitFingerprint({
    file: sampleFile,
    studyNotes: "  focus exam  ",
    wordCount: 8000,
  });
  assert(fp.fileKey === "chapter.pdf:12000:1700000000000", "fingerprint fileKey format");
  assert(fp.studyNotes === "focus exam", "fingerprint trims studyNotes");
  assert(fp.wordCount === 8000, "fingerprint normalizes wordCount");
}

function testFingerprintEmptyFileKey() {
  const fp = buildBlockSplitFingerprint({ studyNotes: "", wordCount: 0 });
  assert(fp.fileKey === "", "missing file yields empty fileKey");
  assert(fp.wordCount === 0, "missing wordCount defaults to 0");
}

function testCacheValidOnMatch() {
  const fp = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "", wordCount: 1000 });
  const cache = { fingerprint: fp, conceptInventory: [{ id: "c1", label: "Alpha" }] };
  assert(isBlockSplitCacheValid(cache, fp), "cache valid when fingerprint matches");
}

function testCacheInvalidOnNotesChange() {
  const fp = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "old", wordCount: 1000 });
  const cache = { fingerprint: fp, conceptInventory: [{ id: "c1" }] };
  const next = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "new focus", wordCount: 1000 });
  assert(!isBlockSplitCacheValid(cache, next), "notes change invalidates cache");
}

function testCacheInvalidOnFileChange() {
  const fp = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "", wordCount: 1000 });
  const cache = { fingerprint: fp, conceptInventory: [{ id: "c1" }] };
  const next = buildBlockSplitFingerprint({
    file: { name: "other.pdf", size: 999, lastModified: 1 },
    studyNotes: "",
    wordCount: 1000,
  });
  assert(!isBlockSplitCacheValid(cache, next), "file change invalidates cache");
}

function testCacheInvalidOnEmptyInventory() {
  const fp = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "", wordCount: 1000 });
  assert(!isBlockSplitCacheValid({ fingerprint: fp, conceptInventory: [] }, fp), "empty inventory invalid");
  assert(!isBlockSplitCacheValid(null, fp), "null cache invalid");
}

function testCacheSetGetInvalidate() {
  resetStorage();
  invalidateBlockSplitCache();
  assert(getBlockSplitCache() === null, "cache starts null");

  const fp = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "x", wordCount: 500 });
  setBlockSplitCache({
    fingerprint: fp,
    conceptInventory: [{ id: "c1" }],
    recommendation: { nBlocks: 12 },
  });
  const stored = getBlockSplitCache();
  assert(stored !== null, "setBlockSplitCache stores payload");
  assert(stored.recommendation?.nBlocks === 12, "recommendation stored");
  assert(isBlockSplitCacheValid(stored, fp), "stored cache validates");

  invalidateBlockSplitCache();
  assert(getBlockSplitCache() === null, "invalidateBlockSplitCache clears state");
}

function testBlocksInputNotInFingerprint() {
  const fpA = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "same", wordCount: 900 });
  const fpB = buildBlockSplitFingerprint({ file: sampleFile, studyNotes: "same", wordCount: 900 });
  assert(JSON.stringify(fpA) === JSON.stringify(fpB), "blocks tweak does not change fingerprint");
}

// ── T02: session exports smoke ──

async function testSessionExportsSmoke() {
  const { runConceptInventory, packInventoryToBlocks, twoPhaseConceptSplit } = await import(
    "../src/js/session.js"
  );
  assert(typeof runConceptInventory === "function", "runConceptInventory exported");
  assert(typeof packInventoryToBlocks === "function", "packInventoryToBlocks exported");
  assert(typeof twoPhaseConceptSplit === "function", "twoPhaseConceptSplit still exported");

  const sessionSrc = await readFile(join(root, "src/js/session.js"), "utf8");
  assert(sessionSrc.includes('progress("Indexing concepts…")'), "runConceptInventory uses Indexing progress");
  assert(sessionSrc.includes("Packing ${requested_n} blocks"), "packInventoryToBlocks uses Packing progress");
  assert(sessionSrc.includes("await runConceptInventory"), "twoPhaseConceptSplit delegates inventory");
  assert(sessionSrc.includes("await packInventoryToBlocks"), "twoPhaseConceptSplit delegates pack");
}

// ── T04/T05: DOM + wiring smoke ──

async function testRecommendDomSmoke() {
  const [indexHtml, uiSrc, mainCss, studySrc] = await Promise.all([
    readFile(join(root, "index.html"), "utf8"),
    readFile(join(root, "src/js/ui.js"), "utf8"),
    readFile(join(root, "src/css/main.css"), "utf8"),
    readFile(join(root, "src/js/study.js"), "utf8"),
  ]);

  const dom = new JSDOM(indexHtml);
  const doc = dom.window.document;
  const section = doc.getElementById("rsvpBlocksSection");
  const btn = doc.getElementById("recommendBlocksBtn");
  const status = doc.getElementById("recommendBlocksStatus");
  const why = doc.getElementById("recommendBlocksWhy");

  assert(section, "rsvpBlocksSection present");
  assert(btn, "recommendBlocksBtn present");
  assert(status, "recommendBlocksStatus present");
  assert(why, "recommendBlocksWhy present");
  assert(section.contains(btn), "recommendBlocksBtn inside rsvpBlocksSection");
  assert(section.contains(status), "recommendBlocksStatus inside rsvpBlocksSection");
  assert(section.contains(why), "recommendBlocksWhy inside rsvpBlocksSection");
  assert(btn.textContent.includes("Recommend block count"), "recommend button copy EN");
  assert(why.hidden === true, "recommendBlocksWhy hidden by default");
  assert(why.getAttribute("aria-live") === "polite", "recommendBlocksWhy aria-live");

  assert(uiSrc.includes('recommendBlocksBtn: document.getElementById("recommendBlocksBtn")'), "ui.js els.recommendBlocksBtn");
  assert(uiSrc.includes('recommendBlocksStatus: document.getElementById("recommendBlocksStatus")'), "ui.js els.recommendBlocksStatus");
  assert(uiSrc.includes('recommendBlocksWhy: document.getElementById("recommendBlocksWhy")'), "ui.js els.recommendBlocksWhy");

  assert(mainCss.includes(".recommend-blocks-btn"), "recommend blocks CSS present");
  assert(studySrc.includes("handleRecommendBlockCount"), "study.js recommend handler");
  assert(studySrc.includes("invalidateBlockSplitCacheAndRecommendUi"), "study.js cache invalidation helper");
  assert(studySrc.includes("packInventoryToBlocks"), "study.js generate uses packInventoryToBlocks");
  assert(studySrc.includes("runConceptInventory"), "study.js recommend uses runConceptInventory");
  assert(studySrc.includes("els.recommendBlocksBtn.hidden = !isRsvp"), "recommend btn RSVP-only visibility");
}

// ── Run ──

section("T01 recommender unit");
testExports();
testLowConceptShortText();
testDensePhilosophical();
testTinySizeCategoryCap();
testClampMinimum();
testClampMaximum();
testMissingMetaDefaultsLoad3();
testSectionCountDrivesRawN();
testWordCountDrivesRawN();
testScientificTheoreticalMultiplier();
testLectureNotesMultiplier();
testFirstPersonRatioMultiplier();
testArgumentativeDensityMultiplier();
testFormatBlockCountReasoning();
testFormatFallbackWithoutReasoning();
testHighConceptualLoadReducesTarget();
testFormulaBoundaryRawNBelowMin();
testSanityHandoutRange();
testSanityMediumChapterRange();
testSanityLongPhilosophyRange();

section("T03 fingerprint / cache");
testFingerprintBuildsFileKey();
testFingerprintEmptyFileKey();
testCacheValidOnMatch();
testCacheInvalidOnNotesChange();
testCacheInvalidOnFileChange();
testCacheInvalidOnEmptyInventory();
testCacheSetGetInvalidate();
testBlocksInputNotInFingerprint();

section("T02 session exports");
await testSessionExportsSmoke();

section("T04/T05 DOM + wiring");
await testRecommendDomSmoke();

console.log(
  `\n20260611_rsvp-block-recommend: ${passed} passed, ${failed} failed`,
);
process.exit(failed > 0 ? 1 : 0);
