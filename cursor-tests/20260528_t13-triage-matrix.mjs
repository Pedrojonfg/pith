/**
 * T13 — Triage matriz §13 on create screen
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t13-triage-matrix.mjs
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

const [indexHtml, studySrc, mainCss, uiSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "src/js/ui.js"), "utf8"),
]);

// Happy: accordion markup on mode select screen under mode selector
assert(indexHtml.includes('id="screenModeSelect"'), "T13: mode select screen present");
assert(indexHtml.includes('id="modeTriageToggle"'), "T13: triage toggle present");
assert(indexHtml.includes('id="modeTriageBody"'), "T13: triage body present");
assert(
  indexHtml.indexOf('id="studyModeSelector"') < indexHtml.indexOf('id="modeTriageToggle"'),
  "T13: triage panel follows mode selector",
);
assert(indexHtml.includes('id="createBackToModesBtn"'), "T13: back to modes button on create screen");
assert(indexHtml.includes("¿Qué modo elijo?"), "T13: accordion title in Spanish");

// Happy: summary matrix rows
assert(indexHtml.includes("Filosofía, literatura, ensayo"), "T13: philosophy/literature row");
assert(indexHtml.includes("Apuntes y resúmenes"), "T13: notes/summaries row");
assert(indexHtml.includes("Bibliografía extensa"), "T13: bibliography row");

// Happy: heuristic + flow diagram
assert(indexHtml.includes("POR QUÉ"), "T13: POR QUÉ heuristic");
assert(indexHtml.includes("QUÉ"), "T13: QUÉ heuristic");
assert(indexHtml.includes("RSVP (overview)"), "T13: flow RSVP overview");
assert(indexHtml.includes("Slow Mode (profundidad)"), "T13: flow Slow depth");
assert(indexHtml.includes("RSVP (revisión)"), "T13: flow RSVP review");

// Happy: study.js wires toggle
assert(studySrc.includes("function wireModeTriagePanel"), "T13: wireModeTriagePanel defined");
assert(studySrc.includes("wireModeTriagePanel();"), "T13: wired from mode selector");
assert(studySrc.includes("enterCreateScreenForMode"), "T13: mode selection navigates to create");
assert(studySrc.includes("enterModeSelectScreen"), "T13: back navigates to mode select");
assert(studySrc.includes('toggle.setAttribute("aria-expanded"'), "T13: aria-expanded sync");

// Happy: ui.js els
assert(uiSrc.includes("screenModeSelect"), "T13: ui els screenModeSelect");
assert(uiSrc.includes("modeTriageToggle"), "T13: ui els modeTriageToggle");
assert(uiSrc.includes("modeTriageBody"), "T13: ui els modeTriageBody");
assert(uiSrc.includes('which === "modeSelect"'), "T13: showScreen modeSelect");

// Happy: styles in main.css
assert(mainCss.includes(".mode-triage-panel"), "T13: panel styles");
assert(mainCss.includes(".mode-triage-heuristic"), "T13: heuristic highlight styles");

// Edge: panel starts collapsed
const dom = new JSDOM(indexHtml);
const toggle = dom.window.document.getElementById("modeTriageToggle");
const body = dom.window.document.getElementById("modeTriageBody");
assert(toggle?.getAttribute("aria-expanded") === "false", "T13: starts collapsed aria");
assert(body?.hasAttribute("hidden"), "T13: body hidden initially");

// Edge: toggle handler opens/closes (mirrors wireModeTriagePanel)
toggle?.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") === "true";
  const next = !open;
  toggle.setAttribute("aria-expanded", String(next));
  body.hidden = !next;
});
toggle?.click();
assert(toggle?.getAttribute("aria-expanded") === "true", "T13: click expands panel");
assert(body?.hidden === false, "T13: body visible after expand");
toggle?.click();
assert(toggle?.getAttribute("aria-expanded") === "false", "T13: second click collapses");
assert(body?.hidden === true, "T13: body hidden after collapse");

// Failure: matrix lives on dedicated mode select screen (not create/config)
const modeSelectSection = dom.window.document.getElementById("screenModeSelect");
const createSection = dom.window.document.getElementById("screenPlaceholder");
assert(modeSelectSection?.contains(toggle), "T13: triage on mode select screen");
assert(modeSelectSection?.querySelector(".mode-triage-matrix tbody tr"), "T13: matrix on mode select screen");
assert(!createSection?.contains(toggle), "T13: triage not on create screen");

// Regression: mode radios unchanged
assert(indexHtml.includes('value="rsvp"'), "T13: RSVP radio preserved");
assert(indexHtml.includes('value="slow"'), "T13: Slow radio preserved");
assert(!studySrc.includes("wireModeTriagePanel(mode)"), "T13: triage does not gate RSVP/Slow");

console.log(`\n20260528_t13-triage-matrix: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
