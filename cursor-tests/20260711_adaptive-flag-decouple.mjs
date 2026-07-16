/**
 * Phase B T02 — adaptive/holistic gate on shared pre-mode, not RSVP-only flag.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260711_adaptive-flag-decouple.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { LS_SHARED_ASSESSMENT_GATE_KEY } from "../src/js/config.js";
import {
  isPrePackingAssessmentEnabled,
  isSharedPreModeAssessmentEnabled,
  isAdaptiveProbingEnabled,
  isHolisticAssessmentEnabled,
  saveSharedAssessmentGatePreference,
} from "../src/js/config/flags.js";

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

resetStorage();
localStorage.removeItem(LS_SHARED_ASSESSMENT_GATE_KEY);

assert(isPrePackingAssessmentEnabled() === false, "legacy RSVP pre-packing gate stays false");
assert(isSharedPreModeAssessmentEnabled() === true, "shared gate defaults ON");
assert(isAdaptiveProbingEnabled() === true, "adaptive enabled when shared gate ON");
assert(isHolisticAssessmentEnabled() === true, "holistic enabled when shared gate ON");

saveSharedAssessmentGatePreference(false);
assert(isSharedPreModeAssessmentEnabled() === false, "shared gate OFF after save");
assert(isAdaptiveProbingEnabled() === false, "adaptive OFF when shared gate OFF");
assert(isHolisticAssessmentEnabled() === false, "holistic OFF when shared gate OFF");
assert(isPrePackingAssessmentEnabled() === false, "legacy RSVP gate still false");

saveSharedAssessmentGatePreference(true);
assert(isAdaptiveProbingEnabled() === true, "adaptive back ON with shared gate");
assert(isHolisticAssessmentEnabled() === true, "holistic back ON with shared gate");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("20260711_adaptive-flag-decouple.mjs: OK");
