/**
 * T07 — Export Initial Assessment section includes gaps_by_block per block
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260525_t07-export-assessment-gaps.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { buildMarkdown, formatAssessmentGapsExportSection } from "../src/js/export.js";
import { state } from "../src/js/session.js";

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

// --- formatAssessmentGapsExportSection (unit) ---
const section = formatAssessmentGapsExportSection(
  {
    gaps_by_block: {
      1: [{ label: "Flux confusion", source: "synthesis" }],
      2: [
        { label: "Boundary conditions", source: "synthesis" },
        { label: "User refined gap", source: "user" },
      ],
    },
    gaps_source: "merged",
    synthesis_status: "ok",
  },
  { titleMap: { 1: "Intro", 2: "Advanced" }, nBlocks: 2 },
);
const sectionText = section.join("\n");
assert(sectionText.includes("### Knowledge gaps by block"), "has gaps subsection heading");
assert(sectionText.includes("Gaps source: merged"), "includes gaps_source");
assert(sectionText.includes("Gap synthesis: ok"), "includes synthesis_status");
assert(sectionText.includes("Block 1 — Intro**: Flux confusion"), "block 1 summary with title");
assert(sectionText.includes("Block 2 — Advanced**: Boundary conditions"), "block 2 first gap");
assert(sectionText.includes("User refined gap (edited)"), "user-edited gap marked");

// empty gaps → none recorded
const empty = formatAssessmentGapsExportSection(
  { gaps_by_block: {}, gaps_source: "none", synthesis_status: "timeout" },
  { nBlocks: 3 },
);
assert(empty.join("\n").includes("(none recorded)"), "empty gaps_by_block shows none recorded");

// --- buildMarkdown integration ---
resetStorage();
globalThis.window = globalThis.window || {};
globalThis.window.guideHistory = [];
state.activeSession = {
  n_test: 2,
  n_socratic: 1,
  n_blocks: 2,
  blocks_list_text: "1. Intro\n2. Advanced",
  blocks: [{}, {}],
  _meta: {
    assessment: {
      penalised_total: 12,
      raw_total: 14,
      max_questions: 20,
      pct: 60,
      strong_blocks: [1],
      weak_blocks: [2],
      config_adjustments_applied: true,
      gaps_by_block: {
        2: [{ label: "Laguna editada por usuario", source: "user" }],
      },
      gaps_source: "merged",
      synthesis_status: "ok",
    },
  },
};
state.activeBlockIndex = 0;
state.activeQuestionIndex = 0;

const md = buildMarkdown(state.activeSession);
assert(md.includes("## Initial Assessment"), "export has assessment section");
assert(md.includes("### Knowledge gaps by block"), "full export includes gaps subsection");
assert(md.includes("Block 2 — Advanced**: Laguna editada por usuario (edited)"), "merged user gap in export");
assert(md.includes("Weak blocks: Block 2"), "preserves weak block list");
assert(!md.includes("Block 1 — Intro**: "), "block without gaps omitted from gap list");

// no assessment meta → no gaps subsection
state.activeSession = { n_blocks: 1, blocks: [{}], blocks_list_text: "1. Solo" };
const mdNoAssess = buildMarkdown(state.activeSession);
assert(!mdNoAssess.includes("### Knowledge gaps by block"), "no assessment → no gaps section");

console.log(`\nT07 export assessment gaps: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
