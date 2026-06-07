/**
 * T03 — getValidItems filter
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260529_t03-cloze-valid-items.mjs
 */
import { getValidItems, mergeItemOptions } from "../src/js/cloze/normalize.js";

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

const distractors = [
  { text: "wrong-a", plausibility: "high", source: "L1" },
  { text: "wrong-b", plausibility: "medium", source: "L1" },
  { text: "wrong-c", plausibility: "low", source: "L3" },
];

const baseItem = {
  id: "item_1",
  item_type: "NODE-DEF",
  sentence_original: "La elasticidad mide sensibilidad.",
  sentence_with_blank: "La _____ mide sensibilidad.",
  blank_text: "elasticidad",
  blank_char_start: 3,
  blank_char_end: 14,
  is_synthetic: false,
  importance: 4,
  semantic_cluster: "econ",
  qa_status: "valid",
  difficulty: "medium",
};

const withOptions = mergeItemOptions(baseItem, distractors);
assert(withOptions?.options?.length === 4, "T03: four options after merge");
assert(withOptions.options.filter((o) => o.is_correct).length === 1, "T03: one correct option");

const validOnly = getValidItems([
  withOptions,
  { ...baseItem, id: "weak", qa_status: "weak", options: withOptions.options },
  { ...baseItem, id: "rej", qa_status: "rejected", options: withOptions.options },
  { ...baseItem, id: "noopts", qa_status: "valid", options: null },
]);
assert(validOnly.length === 1, "T03: only valid item with options passes");
assert(validOnly[0].id === "item_1", "T03: valid item id preserved");

console.log(`\nT03 cloze valid items: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
