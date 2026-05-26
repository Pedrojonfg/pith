/**
 * Validate T07 — quickstart static regression (zero-latency-blocks)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_validate-t07-zero-latency.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

const studySrc = await readFile(join(root, "src/js/study.js"), "utf8");

// SC-001 / SC-003: fast path consumes prefetch, does not call generateBlockDirect
assert(studySrc.includes("Siguiente bloque"), "transition overlay has fast-path CTA");
assert(studySrc.includes("isPrefetchReadyForKey"), "prefetch readiness gate before continue");
assert(
  studySrc.includes('mode === "consume_prefetch"') && studySrc.includes("getPrefetchedBlock"),
  "consume_prefetch uses cached block",
);
const continueHandler = studySrc.slice(
  studySrc.indexOf("o.continueBtn.onclick"),
  studySrc.indexOf("if (o.confirmBtn)"),
);
assert(
  continueHandler.includes("getPrefetchedBlock") && !continueHandler.includes("generateBlockDirect"),
  "SC-003: continue click does not invoke full generateBlockDirect",
);

// SC-002: default transition view has no comment textarea in overlay builder
const overlayBuilder = studySrc.slice(
  studySrc.indexOf("function getOrCreateTransitionOverlay"),
  studySrc.indexOf("function setTransitionOverlayOpen"),
);
assert(!overlayBuilder.includes("createElement(\"textarea\")"), "SC-002: no textarea in overlay DOM");

// FR-007: adjust path uses questions_only branch
assert(
  studySrc.includes('mode === "questions_only"') &&
    studySrc.includes("generateQuestionsOnlyForIndex"),
  "FR-007: adjust can regen questions only",
);

assert(studySrc.includes("Listo ✓"), "SC-001 UX: ready status label present");

console.log(`\nValidate T07 zero-latency: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
