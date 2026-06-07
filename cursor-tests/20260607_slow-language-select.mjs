/**
 * Slow Mode — language selector shared with RSVP on create screen
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_slow-language-select.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import { STUDY_LANG_OPTIONS, LS_STUDY_LANG_KEY } from "../src/js/config.js";
import { getStudyLanguage, syncStudyLanguage } from "../src/js/ui.js";

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

const [indexHtml, studySrc, uiSrc, exportSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
  readFile(join(root, "src/js/export.js"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;
const rsvpSection = doc.getElementById("rsvpBlocksSection");
const languageSelect = doc.getElementById("languageSelect");
const llmModelSelect = doc.getElementById("llmModelSelect");

// --- Happy path: language select visible for both modes (outside RSVP-only section) ---
assert(languageSelect, "SL: languageSelect exists");
assert(rsvpSection, "SL: rsvpBlocksSection exists");
assert(!rsvpSection.contains(languageSelect), "SL: languageSelect not inside rsvpBlocksSection");
assert(
  indexHtml.indexOf('id="languageSelect"') < indexHtml.indexOf('id="rsvpBlocksSection"'),
  "SL: languageSelect precedes rsvpBlocksSection in HTML",
);
assert(
  indexHtml.indexOf('id="llmModelSelect"') < indexHtml.indexOf('id="languageSelect"'),
  "SL: languageSelect after llmModelSelect in HTML",
);

// --- Happy path: createSlowSession persists language (source contract) ---
assert(studySrc.includes("language: lang"), "SL: createSlowSession stores language field");
assert(studySrc.includes("language: getStudyLanguage()"), "SL: slow upload passes getStudyLanguage()");
assert(studySrc.includes("language,"), "SL: createSlowSession accepts language param");

// --- Happy path: syncStudyLanguage updates storage + select ---
const selectEl = { value: "English" };
const { els } = await import("../src/js/ui.js");
els.languageSelect = selectEl;
const synced = syncStudyLanguage("Deutsch");
assert(synced === "Deutsch", "SL: syncStudyLanguage returns valid lang");
assert(localStorage.getItem(LS_STUDY_LANG_KEY) === "Deutsch", "SL: syncStudyLanguage writes localStorage");
assert(selectEl.value === "Deutsch", "SL: syncStudyLanguage updates select");

// --- Edge: invalid language falls back to English ---
localStorage.clear();
localStorage.setItem(LS_STUDY_LANG_KEY, "Klingon");
assert(getStudyLanguage() === "English", "SL: getStudyLanguage rejects unknown stored value");
const fallback = syncStudyLanguage("NotALanguage");
assert(fallback === "English", "SL: syncStudyLanguage rejects invalid lang");

// --- Edge: resume syncs session language ---
assert(
  studySrc.includes("syncStudyLanguage(session.language)"),
  "SL: resumeSlowSession syncs language from saved session",
);

// --- Edge: phase0 uses session language when present ---
assert(
  studySrc.includes("session?.language || getStudyLanguage()"),
  "SL: phase0 generation prefers session language",
);

// --- Failure: visibility contract — rsvpBlocksSection hidden must not hide language ---
function applySlowVisibility() {
  if (rsvpSection) rsvpSection.hidden = true;
}
applySlowVisibility();
assert(rsvpSection.hidden === true, "SL: rsvp section hidden in slow mode");
assert(!languageSelect.hidden, "SL: language select still visible when rsvp section hidden");

// --- Failure: updateCreateScreenModeVisibility only hides rsvpBlocksSection ---
assert(
  studySrc.includes('els.rsvpBlocksSection.hidden = !isRsvp'),
  "SL: visibility toggle targets rsvpBlocksSection only",
);
assert(!studySrc.includes("languageSelect.hidden"), "SL: language select never explicitly hidden");

// --- Failure: export includes language for slow sessions ---
assert(exportSrc.includes("Language: ${String(session.language"), "SL: slow export mentions language");

// --- STUDY_LANG_OPTIONS unchanged ---
assert(STUDY_LANG_OPTIONS.length >= 4, "SL: at least 4 language options");
assert(STUDY_LANG_OPTIONS.some((o) => o.value === "Español"), "SL: Español option exists");

// --- ui.js exports syncStudyLanguage ---
assert(uiSrc.includes("export function syncStudyLanguage"), "SL: syncStudyLanguage exported");

console.log(`\n20260607_slow-language-select: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
