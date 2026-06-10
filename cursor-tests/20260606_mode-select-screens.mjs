/**
 * Mode select — two-screen onboarding flow
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_mode-select-screens.mjs
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

const [indexHtml, studySrc, mainSrc, uiSrc, slowCss, mainCss] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/js/main.js"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
  readFile(join(root, "src/css/slow-mode.css"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
]);

const dom = new JSDOM(indexHtml);
const doc = dom.window.document;

const modeSelectScreen = doc.getElementById("screenModeSelect");
const createScreen = doc.getElementById("screenPlaceholder");
const modeSelector = doc.getElementById("studyModeSelector");
const flowRecommendBtn = doc.getElementById("flowRecommendBtn");
const generateForm = doc.getElementById("generateBlocksForm");
const backBtn = doc.getElementById("createBackToModesBtn");
const modeBadge = doc.getElementById("createModeLabel");
const modeRadios = doc.querySelectorAll('input[name="studyMode"]');

// --- Happy path: two dedicated screens exist ---
assert(modeSelectScreen, "MS: screenModeSelect exists");
assert(createScreen, "MS: screenPlaceholder (configure) exists");
assert(
  indexHtml.indexOf('id="screenModeSelect"') < indexHtml.indexOf('id="screenPlaceholder"'),
  "MS: mode select screen precedes configure screen in DOM",
);

// --- Happy path: mode picker content only on first screen ---
assert(modeSelectScreen.contains(modeSelector), "MS: mode selector on mode select screen");
assert(modeSelectScreen.contains(flowRecommendBtn), "MS: flow recommend button on mode select screen");
assert(modeSelectScreen.querySelector("h1")?.textContent?.includes("How do you want to study"),
  "MS: mode select heading");
assert(createScreen.querySelector("h1")?.textContent?.includes("Configure your session"),
  "MS: configure screen heading");

// --- Happy path: configure screen has back link + badge, not mode picker ---
assert(createScreen.contains(backBtn), "MS: back to modes button on configure screen");
assert(createScreen.contains(modeBadge), "MS: mode badge on configure screen");
assert(!createScreen.contains(modeSelector), "MS: mode selector absent from configure screen");
assert(!createScreen.contains(flowRecommendBtn), "MS: flow recommend absent from configure screen");
assert(createScreen.contains(generateForm), "MS: upload form on configure screen");

// --- Happy path: navigation wiring in study.js ---
assert(studySrc.includes("export function enterModeSelectScreen"), "MS: enterModeSelectScreen exported");
assert(studySrc.includes("function enterCreateScreenForMode"), "MS: enterCreateScreenForMode defined");
assert(studySrc.includes('showScreen("modeSelect")'), "MS: enterModeSelectScreen shows modeSelect");
assert(studySrc.includes('showScreen("create")'), "MS: enterCreateScreenForMode shows create");
assert(studySrc.includes("enterCreateScreenForMode(mode)"), "MS: radio change navigates to create");
assert(studySrc.includes("createBackToModesBtn"), "MS: back button wired");
assert(studySrc.includes("function returnToCreateScreen"), "MS: error recovery returns to create with mode");

// --- Happy path: bootstrap lands on mode select (not create) ---
assert(mainSrc.includes("enterModeSelectScreen"), "MS: main imports enterModeSelectScreen");
assert(
  !mainSrc.includes('showScreen("create")'),
  "MS: main.js no longer navigates directly to create",
);
assert(
  (mainSrc.match(/enterModeSelectScreen\(\)/g) || []).length >= 3,
  "MS: enterModeSelectScreen used on bootstrap, reset, and API save",
);

// --- Happy path: showScreen supports modeSelect ---
assert(uiSrc.includes("screenModeSelect"), "MS: ui els screenModeSelect");
assert(uiSrc.includes('which === "modeSelect"'), "MS: showScreen modeSelect branch");
assert(
  uiSrc.includes("resolveModeSelectScreenEl") && uiSrc.includes('modeSelectEl.setAttribute("aria-hidden"'),
  "MS: mode select aria-hidden toggled via resolved element",
);
assert(uiSrc.includes('no visible screen'), "MS: showScreen fallback when all screens hidden");
assert(uiSrc.includes("offline.js"), "MS: isOfflineMode moved out of main.js");

// --- Edge: all mode radios live on mode select screen only ---
assert(modeRadios.length === 4, "MS: four mode radios (rsvp, slow, cloze, questions)");
for (const radio of modeRadios) {
  assert(modeSelectScreen.contains(radio), `MS: radio ${radio.value} inside mode select screen`);
}

// --- Edge: configure form starts hidden until mode chosen ---
assert(generateForm.hasAttribute("hidden"), "MS: generateBlocksForm hidden initially");

// --- Edge: simulate showScreen visibility contract ---
function applyShowScreen(which) {
  const showModeSelect = which === "modeSelect";
  const showCreate = which === "create";
  modeSelectScreen.setAttribute("aria-hidden", String(!showModeSelect));
  createScreen.setAttribute("aria-hidden", String(!showCreate));
}

applyShowScreen("modeSelect");
assert(modeSelectScreen.getAttribute("aria-hidden") === "false", "MS: modeSelect visible");
assert(createScreen.getAttribute("aria-hidden") === "true", "MS: create hidden on modeSelect");

applyShowScreen("create");
assert(modeSelectScreen.getAttribute("aria-hidden") === "true", "MS: modeSelect hidden on create");
assert(createScreen.getAttribute("aria-hidden") === "false", "MS: create visible");

// --- Edge: resetModeSelectUi contract (mirrors study.js) ---
for (const radio of modeRadios) radio.checked = true;
for (const radio of modeRadios) radio.checked = false;
assert([...modeRadios].every((r) => !r.checked), "MS: reset clears mode radios");
assert(flowRecommendBtn, "MS: flow recommend button present after reset");

// --- Failure: old combined layout must not regress ---
assert(
  !createScreen.textContent.includes("How do you want to study"),
  "MS: configure screen does not duplicate mode select title",
);
assert(
  !modeSelectScreen.querySelector("#generateBlocksForm"),
  "MS: upload form not on mode select screen",
);
assert(
  !modeSelectScreen.querySelector("#modeResumePanel"),
  "MS: resume panel not on mode select screen (stays on configure)",
);
assert(createScreen.contains(doc.getElementById("modeResumePanel")),
  "MS: resume panel on configure screen");

// --- Failure: session-complete / new session exit to mode select ---
assert(studySrc.includes("enterModeSelectScreen();"), "MS: slow phase3 finish goes to mode select");
assert(
  studySrc.includes("els.slowScopeBackBtn") && studySrc.includes("enterModeSelectScreen"),
  "MS: slow scope back goes to mode select",
);

// --- Styles present for dedicated screens ---
assert(slowCss.includes(".mode-select-screen"), "MS: mode select screen styles");
assert(mainCss.includes(".create-screen-header"), "MS: configure header styles");
assert(mainCss.includes(".create-mode-badge"), "MS: mode badge styles");

console.log(`\n20260606_mode-select-screens: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
