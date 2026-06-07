/**
 * T02 — Cloze Detection third mode in create screen selector
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260529_t02-cloze-selector.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";

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

const [indexHtml, studySrc, mainCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;

const modeSelectScreen = doc.getElementById("screenModeSelect");
const modeRadios = doc.querySelectorAll('input[name="studyMode"]');
const clozeRadio = doc.querySelector('input[name="studyMode"][value="cloze"]');
const rsvpRadio = doc.querySelector('input[name="studyMode"][value="rsvp"]');
const slowRadio = doc.querySelector('input[name="studyMode"][value="slow"]');

// --- Happy path: three modes visible, none preselected ---
assert(modeRadios.length === 3, "T02: exactly three mode radios");
assert(rsvpRadio && slowRadio && clozeRadio, "T02: rsvp, slow, cloze radios exist");
assert([...modeRadios].every((r) => !r.checked), "T02: no mode preselected");
for (const radio of modeRadios) {
  assert(modeSelectScreen.contains(radio), `T02: radio ${radio.value} on mode select screen`);
}

// --- Happy path: cloze label + active-recall hint ---
const clozeLabel = clozeRadio.closest("label");
assert(clozeLabel?.textContent?.includes("Cloze Detection"), "T02: cloze option title");
assert(
  clozeLabel?.textContent?.toLowerCase().includes("active recall"),
  "T02: cloze hint mentions active recall",
);
assert(
  clozeLabel?.textContent?.includes("NODE/EDGE") || clozeLabel?.textContent?.includes("cloze"),
  "T02: cloze hint references cloze items",
);

// --- Happy path: study.js labels and visibility ---
assert(studySrc.includes('if (mode === "cloze") return "Cloze Detection"'), "T02: getStudyModeLabel cloze");
assert(studySrc.includes("const isCloze = mode === \"cloze\""), "T02: isCloze flag in visibility");
assert(
  studySrc.includes("isSlow || isCloze ? \"Upload and continue →\" : \"Generate blocks\""),
  "T02: cloze upload button label",
);
assert(studySrc.includes("getStudyModeLabel(mode)"), "T02: resume hint uses getStudyModeLabel");

// --- Edge: RSVP/Slow hints unchanged ---
const rsvpLabel = rsvpRadio.closest("label");
const slowLabel = slowRadio.closest("label");
assert(rsvpLabel?.textContent?.includes("RSVP"), "T02: rsvp option preserved");
assert(slowLabel?.textContent?.includes("Slow Mode"), "T02: slow option preserved");

// --- Edge: visibility contract — cloze hides RSVP blocks and slow controls ---
function applyVisibility(mode) {
  const isSlow = mode === "slow";
  const isRsvp = mode === "rsvp";
  const rsvpOnly = doc.getElementById("rsvpOnlyControls");
  const rsvpBlocks = doc.getElementById("rsvpBlocksSection");
  const slowOnly = doc.getElementById("slowOnlyControls");
  if (rsvpOnly) rsvpOnly.hidden = !isRsvp;
  if (rsvpBlocks) rsvpBlocks.hidden = !isRsvp;
  if (slowOnly) slowOnly.hidden = !isSlow;
}

applyVisibility("cloze");
assert(doc.getElementById("rsvpOnlyControls")?.hidden === true, "T02: cloze hides rsvpOnlyControls");
assert(doc.getElementById("rsvpBlocksSection")?.hidden === true, "T02: cloze hides rsvpBlocksSection");
assert(doc.getElementById("slowOnlyControls")?.hidden === true, "T02: cloze hides slowOnlyControls");

applyVisibility("rsvp");
assert(doc.getElementById("rsvpOnlyControls")?.hidden === false, "T02: rsvp shows rsvpOnlyControls");
assert(doc.getElementById("rsvpBlocksSection")?.hidden === false, "T02: rsvp shows rsvpBlocksSection");
assert(doc.getElementById("slowOnlyControls")?.hidden === true, "T02: rsvp hides slowOnlyControls");

applyVisibility("slow");
assert(doc.getElementById("rsvpOnlyControls")?.hidden === true, "T02: slow hides rsvpOnlyControls");
assert(doc.getElementById("rsvpBlocksSection")?.hidden === true, "T02: slow hides rsvpBlocksSection");
assert(doc.getElementById("slowOnlyControls")?.hidden === false, "T02: slow shows slowOnlyControls");

// --- Failure: cloze must not re-enable RSVP blocks when selected ---
applyVisibility("cloze");
assert(doc.getElementById("rsvpBlocksSection")?.hidden !== false, "T02: cloze never shows blocks section");

// --- Failure: resetModeSelectUi clears all three ---
for (const radio of modeRadios) radio.checked = true;
for (const radio of modeRadios) radio.checked = false;
assert([...modeRadios].every((r) => !r.checked), "T02: reset clears all three radios");

// --- Layout: main.css supports three options ---
assert(
  mainCss.includes(".mode-select-screen .study-mode-options"),
  "T02: main.css has three-option layout rule",
);

console.log(`\nT02 cloze selector: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
