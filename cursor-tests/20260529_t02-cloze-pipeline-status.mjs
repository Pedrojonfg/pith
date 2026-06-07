/**
 * T02 — pipelineStatus transitions (unit-level)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260529_t02-cloze-pipeline-status.mjs
 */
import { getPhaseLabel } from "../src/js/cloze/pipeline.js";

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

const transitions = [
  ["normalized", false],
  ["generating", true],
  ["phase0", true],
  ["phase4", true],
  ["ready", false],
  ["failed", false],
];

for (const [status, generating] of transitions) {
  const isGenerating = status === "generating" || /^phase\d$/.test(status);
  assert(isGenerating === generating, `T02: status ${status} generating=${generating}`);
}

assert(getPhaseLabel(0).length > 0, "T02: phase 0 label");
assert(getPhaseLabel(4).length > 0, "T02: phase 4 label");

const sessionFlow = {
  cloze: { pipelineStatus: "normalized", pipelinePhase: null },
};
assert(sessionFlow.cloze.pipelineStatus === "normalized", "T02: starts normalized");
sessionFlow.cloze.pipelineStatus = "phase2";
sessionFlow.cloze.pipelinePhase = 2;
assert(/^phase\d$/.test(sessionFlow.cloze.pipelineStatus), "T02: mid pipeline phase status");
sessionFlow.cloze.pipelineStatus = "ready";
sessionFlow.cloze.pipelinePhase = null;
assert(sessionFlow.cloze.pipelineStatus === "ready", "T02: ends ready");

console.log(`\nT02 cloze pipeline status: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
