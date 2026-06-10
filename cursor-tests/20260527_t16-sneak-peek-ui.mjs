/**
 * T16 — SC-007 (sneak peek) UI wiring + quickstart check
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t16-sneak-peek-ui.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractSneakPeek } from "../src/js/sneakPeek.js";

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

// --- Static: overlay DOM wiring ---
assert(studySrc.includes("sneakPeekWrap"), "study.js creates sneakPeekWrap");
assert(studySrc.includes("sneakPeekText"), "study.js creates sneakPeekText");
assert(
  studySrc.includes('card.appendChild(sneakPeekWrap)') && studySrc.includes("card.appendChild(dictionaryWrap)"),
  "study.js inserts sneakPeekWrap before dictionaryWrap",
);

const idxSneak = studySrc.indexOf("card.appendChild(sneakPeekWrap)");
const idxDict = studySrc.indexOf("card.appendChild(dictionaryWrap)");
assert(idxSneak >= 0 && idxDict >= 0 && idxSneak < idxDict, "sneakPeekWrap is appended before dictionaryWrap");

// --- Static: placeholder + ready rendering ---
assert(studySrc.includes("Preparing next block…"), "block preparing placeholder exists in study.js");
assert(studySrc.includes("Writing transition preview…"), "bridge preparing placeholder exists in study.js");
assert(studySrc.includes("bridgePrefetchState"), "study.js reads bridge prefetch state");
assert(studySrc.includes("extractSneakPeek("), "study.js keeps extractSneakPeek as fallback");
assert(studySrc.includes("triggerBridgePrefetch("), "study.js can start bridge generation");
assert(
  studySrc.includes("renderTransitionSneakPeek(o, finishedIdx)") || studySrc.includes("renderTransitionSneakPeek(o, idx)"),
  "study.js triggers sneak peek rendering from refresh/poll logic",
);

// --- Static: keep out of adjust view ---
assert(!studySrc.includes("adjustWrap.appendChild(sneakPeekWrap)"), "sneak peek is not inside adjust controls");

// --- Behavioral sanity: sneak peek still respects <=4 sentence budget ---
const explanation =
  "Sentence one. Sentence two. Sentence three. Sentence four. Sentence five should not appear.";
const peek = extractSneakPeek(explanation, 4);
const sentenceCount = peek ? peek.split(/(?<=[.!?])\s+/).length : 0;
assert(sentenceCount <= 4, "extractSneakPeek respects maxSentences when invoked by UI");

const quickstart = await readFile(join(root, "specs/20260527-zero-latency-blocks/quickstart.md"), "utf8");
assert(quickstart.includes("SC-007"), "quickstart includes SC-007 section/row");

console.log(`\nT16 sneak peek UI: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

