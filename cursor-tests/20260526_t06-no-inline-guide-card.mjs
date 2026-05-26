/**
 * T06 — FR-005a: no inline guide card after finishRSVP; sidebar flow intact
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260526_t06-no-inline-guide-card.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const studySrc = await readFile(join(__dir, "../src/js/study.js"), "utf8");

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

// FR-005a: inline guide card removed
assert(!studySrc.includes("ensureGuideResponseCardVisible"), "T06: ensureGuideResponseCardVisible removed");
assert(!studySrc.includes("lastConsumedPendingGuideReplyTs"), "T06: lastConsumedPendingGuideReplyTs removed");
assert(!studySrc.includes("getCommentReply"), "T06: finishRSVP no longer reads getCommentReply");
assert(!studySrc.includes("Guide response"), "T06: inline card copy removed from study.js");

// finishRSVP delegates to showQuestions only
const finishMatch = studySrc.match(/function finishRSVP\(blockIndex\)\s*\{([\s\S]*?)\n\}/);
assert(finishMatch, "T06: finishRSVP function found");
const finishBody = finishMatch[1];
assert(
  finishBody.includes("showQuestions(blockIndex)") && !finishBody.includes("guideHistory"),
  "T06: finishRSVP only calls showQuestions (no sidebar duplicate inline)",
);

// triggerCommentReply preserved in startBlock (sidebar pending comment flow)
assert(studySrc.includes("triggerCommentReply()"), "T06: triggerCommentReply still invoked");
const startBlockMatch = studySrc.match(/function startBlock\(blockIndex\)\s*\{([\s\S]*?)\n\}/);
assert(startBlockMatch, "T06: startBlock function found");
assert(
  startBlockMatch[1].includes("shouldTriggerCommentReply") && startBlockMatch[1].includes("triggerCommentReply"),
  "T06: startBlock still wires shouldTriggerCommentReply → triggerCommentReply",
);

// Edge: no prepend to testQaView for guide (inline injection path gone)
assert(
  !studySrc.includes('els.testQaView.prepend(card)') || !studySrc.includes("response-box"),
  "T06: testQaView guide card prepend removed",
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
