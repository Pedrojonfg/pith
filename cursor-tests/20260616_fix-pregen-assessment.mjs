/**
 * RSVP Pre-Generation Assessment Reliability — T01–T06
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260616_fix-pregen-assessment.mjs
 */
import { readFile } from "node:fs/promises";
import { generatePrePackingAssessmentItems } from "../src/js/api.js";
import {
  ASSESSMENT_FLAGS,
  isAssessmentQuestionsUiEnabled,
  isPrePackingAssessmentEnabled,
} from "../src/js/config/flags.js";
import { buildPrefetchConfigKey } from "../src/js/study.js";

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

async function assertRejects(promise, msg, substr) {
  try {
    await promise;
    failed += 1;
    console.error(`FAIL: ${msg} (did not throw)`);
  } catch (err) {
    const text = err?.message ? String(err.message) : String(err);
    if (substr && !text.includes(substr)) {
      failed += 1;
      console.error(`FAIL: ${msg} (threw "${text}", expected "${substr}")`);
      return;
    }
    passed += 1;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

const inventory = [
  { id: "c1", label: "Thesis", type: "THESIS" },
  { id: "c2", label: "Argument", type: "ARGUMENT" },
];

const materialText = "Sample study material for assessment generation.";

// ── T01: buildPrefetchConfigKey ──
section("T01 buildPrefetchConfigKey");
{
  const base = { qCfg: { n_test: 2, n_socratic: 1 }, conceptInventory: inventory, cleanedText: materialText };
  const key1 = buildPrefetchConfigKey(base);
  assert(typeof key1 === "string" && key1.length > 0, "key is non-empty string");
  assert(key1.startsWith("2:1|"), "key encodes n_test and n_socratic");

  const key2 = buildPrefetchConfigKey({ ...base, qCfg: { n_test: 3, n_socratic: 1 } });
  assert(key1 !== key2, "key changes when counts change");

  const key3 = buildPrefetchConfigKey({
    ...base,
    conceptInventory: inventory.slice(0, 1),
  });
  assert(key1 !== key3, "key changes when inventory changes");

  const key4 = buildPrefetchConfigKey({ ...base, cleanedText: materialText + " extra" });
  assert(key1 !== key4, "key changes when material length changes");
}

// ── T03: API input validation (Questions path) ──
section("T03 API validation");
assert(isAssessmentQuestionsUiEnabled() === true, "Questions UI enabled for contract tests");

await assertRejects(
  generatePrePackingAssessmentItems({
    conceptInventory: inventory,
    materialText,
    llmModel: "test",
    language: "English",
  }),
  "missing n_test throws",
  "n_test must be a finite number",
);

await assertRejects(
  generatePrePackingAssessmentItems({
    conceptInventory: inventory,
    materialText,
    n_test: 2,
    llmModel: "test",
    language: "English",
  }),
  "missing n_socratic throws",
  "n_socratic must be a finite number",
);

await assertRejects(
  generatePrePackingAssessmentItems({
    conceptInventory: inventory,
    materialText: "  ",
    n_test: 2,
    n_socratic: 1,
    llmModel: "test",
    language: "English",
  }),
  "empty materialText throws",
  "Missing material text",
);

await assertRejects(
  generatePrePackingAssessmentItems({
    conceptInventory: inventory,
    materialText,
    n_test: 0,
    n_socratic: 0,
    llmModel: "test",
    language: "English",
  }),
  "zero questions throws",
  "at least one question",
);

// ── T05: legacy post-generation gate (source contract) ──
section("T05 legacy assessment gate");
{
  assert(isPrePackingAssessmentEnabled() === true, "pre-packing flag on by default");
  const studySrc = await readFile(new URL("../src/js/study.js", import.meta.url), "utf8");
  assert(
    studySrc.includes("function goAfterBlocksConfirmed(nBlocks)") &&
      studySrc.includes("if (isPrePackingAssessmentEnabled())") &&
      studySrc.includes("goToSessionReady(nBlocks)") &&
      studySrc.includes("goToInitialAssessment()"),
    "goAfterBlocksConfirmed branches session ready vs legacy assessment",
  );
  assert(
    studySrc.includes("const hideLegacy = isPrePackingAssessmentEnabled()") &&
      studySrc.includes("els.assessmentChoiceWrap.hidden = hideLegacy"),
    "setAssessmentUiDefaults hides legacy assessment choice when flag on",
  );
  assert(
    !studySrc.includes(".catch(() => [])"),
    "prefetch does not swallow errors with empty catch",
  );
  assert(
    studySrc.includes("buildPrefetchConfigKey") &&
      studySrc.includes("prefetchConfigKey") &&
      !studySrc.match(/itemsPromise:\s*generatePrePackingAssessmentItems\(\{[^}]*maxItems/s),
    "prefetch uses Questions params not maxItems-only",
  );
}

// ── T04: failure UX contract (source) ──
section("T04 failure UX");
{
  const studySrc = await readFile(new URL("../src/js/study.js", import.meta.url), "utf8");
  assert(studySrc.includes("retryPrePackingAssessmentGeneration"), "retry handler exists");
  assert(studySrc.includes("showPrePackingAssessmentGenerationFailure"), "failure panel exists");
  assert(
    studySrc.includes("Could not load knowledge check questions."),
    "stable error copy present",
  );
  const runnerCatch = studySrc.slice(
    studySrc.indexOf("async function enterPrePackingAssessmentRunner"),
    studySrc.indexOf("function renderPrePackingAssessmentQuestion"),
  );
  assert(
    !runnerCatch.includes("await handlePrePackingSkip()"),
    "runner catch does not auto-skip",
  );
}

// ── prefetch param contract ──
section("prefetch param contract");
assert(ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX === 7, "safety cap documented");

console.log(`\n${"=".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) process.exit(1);
