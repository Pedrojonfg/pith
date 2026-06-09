/**
 * Checkpoint dismiss fix + checkpointsEnabled scope toggle
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_checkpoint-dismiss-toggle.mjs
 */
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

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

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.window = dom.window;

const {
  buildSectionBoundaries,
  isLastPageOfSection,
  hideCheckpointChip,
  maybeScheduleCheckpoint,
  CHECKPOINT_CHIP_LABEL,
} = await import("../src/js/slow/checkpoints.js");

const cpText = "## One\n\naa\n\n## Two\n\nbb\n\n## Three\n\ncc";
const sections = buildSectionBoundaries(cpText, "markdown");
const breakpoints = [{ pageIndex: 0, charStart: 0, charEnd: cpText.length }];

assert(sections.length === 3, "setup: three heading sections");
for (const s of sections) {
  assert(
    isLastPageOfSection(breakpoints, 0, s),
    `setup: page 0 is last page for section ${s.id}`,
  );
}

function makeSession(overrides = {}) {
  const checkpointQuestions = Object.fromEntries(
    sections.map((s) => [s.id, `Integration Q for ${s.title}?`]),
  );
  return {
    slow: {
      phase: "phase1",
      checkpointsEnabled: true,
      normalizedFormat: "markdown",
      normalizedTextFull: cpText,
      readingScope: { charStart: 0, charEnd: cpText.length },
      checkpointsDismissed: [],
      checkpointQuestions,
      ...overrides,
    },
  };
}

let lastTimeoutFn = null;
let timeoutScheduled = false;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

globalThis.setTimeout = (fn, ms) => {
  timeoutScheduled = true;
  lastTimeoutFn = fn;
  assert(ms === 10000, "happy: checkpoint delay is 10s");
  return 42;
};
globalThis.clearTimeout = (id) => {
  if (id === 42) {
    lastTimeoutFn = null;
    timeoutScheduled = false;
  }
  return realClearTimeout(id);
};

// --- checkpointsEnabled: happy path schedules timer ---
{
  timeoutScheduled = false;
  lastTimeoutFn = null;
  const session = makeSession();
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(timeoutScheduled && typeof lastTimeoutFn === "function", "happy: enabled session schedules checkpoint");
}

// --- checkpointsEnabled: failure when explicitly false ---
{
  timeoutScheduled = false;
  lastTimeoutFn = null;
  const session = makeSession({ checkpointsEnabled: false });
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(!timeoutScheduled, "fail: checkpointsEnabled false does not schedule");
  const chip = document.getElementById("slowCheckpointChip");
  assert(!chip || chip.hidden !== false, "fail: chip stays hidden when disabled");
}

// --- checkpointsEnabled: edge legacy sessions without field default on ---
{
  timeoutScheduled = false;
  lastTimeoutFn = null;
  const session = makeSession();
  delete session.slow.checkpointsEnabled;
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(timeoutScheduled, "edge: missing checkpointsEnabled still schedules (legacy)");
}

// --- phase guard: failure outside phase1 ---
{
  timeoutScheduled = false;
  const session = makeSession({ phase: "phase0" });
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(!timeoutScheduled, "fail: non-phase1 does not schedule");
}

// --- dismiss ×: happy path hides chip and dismisses all sections on page ---
{
  hideCheckpointChip();
  timeoutScheduled = false;
  const session = makeSession();
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(lastTimeoutFn, "dismiss setup: timer captured");
  await lastTimeoutFn();

  const chip = document.getElementById("slowCheckpointChip");
  assert(chip && chip.hidden === false, "dismiss setup: chip visible after timer");
  assert(chip.textContent.includes(CHECKPOINT_CHIP_LABEL), "dismiss setup: chip label rendered");

  const dismissBtn = chip.querySelector(".slow-checkpoint-dismiss");
  assert(dismissBtn, "dismiss setup: × button exists");
  dismissBtn.click();

  assert(chip.hidden === true, "happy: × hides checkpoint chip");
  assert(chip.innerHTML === "", "happy: × clears chip content");
  for (const s of sections) {
    assert(
      session.slow.checkpointsDismissed.includes(s.id),
      `happy: dismiss adds all page sections (${s.id})`,
    );
  }
}

// --- dismiss ×: edge stale timer does not re-show after dismiss ---
{
  hideCheckpointChip();
  const session = makeSession();
  const staleFn = lastTimeoutFn;
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  const captured = lastTimeoutFn;
  await captured();
  document.getElementById("slowCheckpointChip")?.querySelector(".slow-checkpoint-dismiss")?.click();
  assert(document.getElementById("slowCheckpointChip")?.hidden === true, "edge: chip hidden after dismiss");

  await staleFn?.();
  const chip = document.getElementById("slowCheckpointChip");
  assert(!chip || chip.hidden !== false, "edge: stale timer cannot resurrect chip after dismiss");
}

// --- hideCheckpointChip: failure cancels pending schedule ---
{
  hideCheckpointChip();
  const session = makeSession({ checkpointsDismissed: [] });
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(lastTimeoutFn, "hide setup: timer scheduled");
  hideCheckpointChip();
  assert(lastTimeoutFn === null, "fail: hideCheckpointChip clears pending timer");
  const fnBeforeHide = lastTimeoutFn;
  await fnBeforeHide?.().catch?.(() => {});
}

// --- after full dismiss, reschedule finds nothing ---
{
  hideCheckpointChip();
  timeoutScheduled = false;
  const session = makeSession({
    checkpointsDismissed: sections.map((s) => s.id),
  });
  maybeScheduleCheckpoint(session, breakpoints, 0, () => {});
  assert(!timeoutScheduled, "fail: all dismissed sections → no new timer");
}

// --- scope screen DOM contract ---
const indexHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
assert(indexHtml.includes('id="slowScopeCheckpoints"'), "UI: scope screen has checkpoints checkbox");
assert(indexHtml.includes("Checkpoints de sección"), "UI: Spanish label for checkpoints toggle");
assert(
  indexHtml.includes('id="slowScopeCheckpoints" checked'),
  "UI: checkpoints checkbox checked by default",
);

// --- study.js session default ---
const studyJs = await readFile(new URL("../src/js/study.js", import.meta.url), "utf8");
assert(
  studyJs.includes("checkpointsEnabled: true"),
  "UI: new slow sessions default checkpointsEnabled true",
);

globalThis.setTimeout = realSetTimeout;
globalThis.clearTimeout = realClearTimeout;

console.log(`\n20260609_checkpoint-dismiss-toggle: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
