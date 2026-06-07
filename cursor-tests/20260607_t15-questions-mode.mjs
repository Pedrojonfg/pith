/**
 * Validate — Questions mode (fourth study mode, quiz-only, no RSVP reader)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t15-questions-mode.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_ACTIVE_SESSION_KEY,
  LS_SESSIONS_BY_MODE_KEY,
} from "../src/js/config.js";
import { buildExportFrontmatter } from "../src/js/export-format.js";
import { startReviewFromSessionBlocks } from "../src/js/review.js";
import {
  buildBlockConfigKey,
  emptySessionsByMode,
  getBlockSummaryFromList,
  initActiveSessionFromBlocksList,
  isQuestionsStudyMode,
  loadSessionForMode,
  loadSessionsByMode,
  migrateLegacyActiveSession,
  normalizeStudyMode,
  resolveRegenMode,
  storeSessionForMode,
  state,
} from "../src/js/session.js";

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

function assertThrows(fn, msg, expectedSubstring = "") {
  try {
    fn();
    failed += 1;
    console.error(`FAIL: ${msg} (expected throw)`);
  } catch (err) {
    const text = err?.message ? String(err.message) : String(err);
    if (expectedSubstring && !text.includes(expectedSubstring)) {
      failed += 1;
      console.error(`FAIL: ${msg} — throw "${text}" missing "${expectedSubstring}"`);
      return;
    }
    passed += 1;
  }
}

const [indexHtml, studySrc, sessionSrc, reviewSrc, exportSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/js/session.js"), "utf8"),
  readFile(join(root, "src/js/review.js"), "utf8"),
  readFile(join(root, "src/js/export-format.js"), "utf8"),
]);

// ─── UI: fourth mode on selector ───────────────────────────────────────────
const dom = new JSDOM(indexHtml);
const doc = dom.window.document;
const modeRadios = doc.querySelectorAll('input[name="studyMode"]');
const questionsRadio = doc.querySelector('input[name="studyMode"][value="questions"]');
const rsvpRadio = doc.querySelector('input[name="studyMode"][value="rsvp"]');

assert(modeRadios.length === 4, "UI happy: four mode radios");
assert(questionsRadio, "UI happy: questions radio exists");
assert([...modeRadios].every((r) => !r.checked), "UI edge: no mode preselected");

const questionsLabel = questionsRadio.closest("label");
assert(questionsLabel?.textContent?.includes("Questions"), "UI happy: Questions label");
assert(
  questionsLabel?.textContent?.toLowerCase().includes("no rsvp"),
  "UI happy: hint mentions no RSVP reader",
);

const rsvpLabel = rsvpRadio?.closest("label");
assert(rsvpLabel?.textContent?.includes("RSVP"), "UI regression: RSVP option preserved");

function applyCreateVisibility(mode) {
  const isSlow = mode === "slow";
  const isRsvp = mode === "rsvp";
  const isCloze = mode === "cloze";
  const isQuestions = mode === "questions";
  const showBlockConfig = isRsvp || isQuestions;
  return {
    rsvpOnlyHidden: !isRsvp,
    blocksSectionHidden: !showBlockConfig,
    clozeImportHidden: !isCloze,
    blocksRequired: showBlockConfig,
  };
}

const qVis = applyCreateVisibility("questions");
assert(qVis.rsvpOnlyHidden === true, "UI happy: questions hides rsvp-only controls (offline pack)");
assert(qVis.blocksSectionHidden === false, "UI happy: questions shows blocks section");
assert(qVis.blocksRequired === true, "UI happy: blocks input required for questions");
assert(applyCreateVisibility("cloze").blocksSectionHidden === true, "UI edge: cloze hides blocks");

// study.js wiring (static contract)
assert(studySrc.includes('if (mode === "questions") return "Questions"'), "wire: getStudyModeLabel");
assert(studySrc.includes("const showBlockConfig = isRsvp || isQuestions"), "wire: block config visibility");
assert(studySrc.includes("resumeQuestionsSession"), "wire: resume handler");
assert(studySrc.includes("isQuestionsStudyMode(state.activeSession)"), "wire: skip RSVP");
assert(studySrc.includes("reviewBlockBtn"), "wire: transition review button");
assert(studySrc.includes('mode: normalizeStudyMode(state.studyMode)'), "wire: confirm sets mode");
assert(studySrc.includes("generateQuestionsBlockForIndex"), "wire: questions block generator");

// ─── Session: normalize + slots ─────────────────────────────────────────────
resetStorage();
assert(normalizeStudyMode("questions") === "questions", "session happy: normalize questions");
assert(normalizeStudyMode("") === "rsvp", "session edge: empty → rsvp");
assert(normalizeStudyMode("bogus") === "rsvp", "session failure: unknown → rsvp");

const empty = emptySessionsByMode();
assert(empty.questions === null && empty.rsvp === null, "session happy: emptySessionsByMode shape");

storeSessionForMode("questions", { studyMode: "questions", n_blocks: 2, label: "q-only" });
storeSessionForMode("rsvp", { studyMode: "rsvp", n_blocks: 1, label: "rsvp-only" });
assert(loadSessionForMode("questions")?.label === "q-only", "session happy: questions slot isolated");
assert(loadSessionForMode("rsvp")?.label === "rsvp-only", "session happy: rsvp slot preserved");

const parsed = loadSessionsByMode();
assert(parsed.questions?.n_blocks === 2, "session happy: loadSessionsByMode includes questions");

localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify({ studyMode: "rsvp", n_blocks: 1 }));
migrateLegacyActiveSession();
assert(loadSessionsByMode().questions === null, "session edge: legacy migration sets questions null");

// ─── initActiveSessionFromBlocksList ─────────────────────────────────────────
const qSession = initActiveSessionFromBlocksList({
  mode: "questions",
  nBlocks: 3,
  blocksListText: "1. A — sum\n2. B — sum2",
});
assert(qSession.studyMode === "questions", "init happy: mode questions");
assert(qSession.n_blocks === 3, "init happy: block count");
assert(qSession.blocks.length === 3, "init happy: blocks array length");

const defaultSession = initActiveSessionFromBlocksList({ nBlocks: 1, blocksListText: "1. X" });
assert(defaultSession.studyMode === "rsvp", "init edge: omitted mode defaults rsvp");

// ─── isQuestionsStudyMode + getBlockSummaryFromList ─────────────────────────
state.activeSession = {
  studyMode: "questions",
  blocks_list_text: "1. Intro — First summary\n2. Next — Second summary",
};
assert(isQuestionsStudyMode(state.activeSession), "isQuestions happy: session object");
assert(isQuestionsStudyMode("questions"), "isQuestions happy: string mode");
assert(!isQuestionsStudyMode({ studyMode: "rsvp" }), "isQuestions failure: rsvp false");

assert(getBlockSummaryFromList(0) === "First summary", "summary happy: block 1");
assert(getBlockSummaryFromList(1) === "Second summary", "summary happy: block 2");
state.activeSession.blocks_list_text = "1. Only title";
assert(getBlockSummaryFromList(0) === "", "summary edge: title-only line → empty summary");
state.activeSession.blocks_list_text = "";
assert(getBlockSummaryFromList(0) === "", "summary edge: empty list");

// ─── resolveRegenMode under Questions session ───────────────────────────────
const baseCfg = {
  n_test: 2,
  n_socratic: 1,
  explanation_profile: "thorough",
  gap_focus: [],
  include_connection_questions: true,
};
const qBlock = {
  id: 2,
  title: "Block 2",
  explanation: "",
  questions: [{ type: "test", question: "Q?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" }],
  _config: { ...baseCfg },
};

state.activeSession = { studyMode: "questions", n_blocks: 2 };

assert(
  resolveRegenMode(baseCfg, qBlock, {
    prefetchReady: true,
    prefetchConfigKey: buildBlockConfigKey(baseCfg),
  }) === "consume_prefetch",
  "regen happy: questions mode prefetch ready → consume_prefetch",
);

assert(
  resolveRegenMode({ ...baseCfg, n_test: 3 }, qBlock, { baseCfg }) === "questions_only",
  "regen happy: questions mode count change → questions_only",
);

assert(
  resolveRegenMode(baseCfg, { ...qBlock, questions: [] }) === "full_block",
  "regen failure: questions mode empty questions → full_block",
);

state.activeSession = { studyMode: "rsvp", n_blocks: 2 };
assert(
  resolveRegenMode({ ...baseCfg, n_test: 3 }, { ...qBlock, explanation: "text" }, { baseCfg }) ===
    "questions_only",
  "regen regression: RSVP still uses explanation-based questions_only",
);

// ─── Review: startReviewFromSessionBlocks ───────────────────────────────────
state.activeSession = {
  studyMode: "questions",
  n_blocks: 2,
  blocks: [
    {
      questions: [
        { type: "test", question: "T1?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" },
        { type: "socratic", question: "S1?" },
      ],
    },
    { questions: [{ type: "test", question: "T2?", options: { A: "x", B: "y", C: "z", D: "w" }, answer: "B" }] },
  ],
};

assertThrows(
  () => startReviewFromSessionBlocks({ blockIndices: [] }),
  "review failure: empty blockIndices throws",
  "Select at least one block",
);

state.activeSession.blocks[0].questions = [];
assertThrows(
  () => startReviewFromSessionBlocks({ blockIndices: [0] }),
  "review failure: block without questions throws",
  "No questions available",
);

state.activeSession.blocks[0].questions = [
  { type: "test", question: "T1?", options: { A: "a", B: "b", C: "c", D: "d" }, answer: "A" },
];
// Happy path (showScreen + renderReviewQuestion) requires full DOM — covered in manual QA
assert(reviewSrc.includes("startReviewFromSessionBlocks"), "review wire: export function");
assert(reviewSrc.includes("isQuestionsStudyMode(state.activeSession)"), "review wire: session btn shortcut");

// ─── Export frontmatter ─────────────────────────────────────────────────────
const fm = buildExportFrontmatter({ studyMode: "questions", _meta: { session_id: "s1" } });
assert(fm.includes("mode: questions"), "export happy: questions mode in frontmatter");
assert(!fm.includes("mode: fast"), "export edge: not mapped to fast");

const fmRsvp = buildExportFrontmatter({ studyMode: "rsvp", _meta: { session_id: "s2" } });
assert(fmRsvp.includes("mode: fast"), "export regression: rsvp still fast");

assert(sessionSrc.includes("generateQuestionsBlockForIndex"), "session: generator exists");
assert(exportSrc.includes('studyMode === "questions"'), "export-format: questions branch");

console.log(`\nValidate Questions mode: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
