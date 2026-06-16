import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const mainCss = read("src/css/main.css");
const enforcementCss = read("src/css/design-enforcement.css");
const indexHtml = read("index.html");
const swUpdate = read("src/js/sw-update.js");
const sw = read("sw.js");
const clozeCss = read("src/css/cloze-mode.css");
const recallCss = read("src/css/recall-mode.css");
const graphCss = read("src/css/graph.css");
const sidebarCss = read("src/css/sidebar.css");
const uiJs = read("src/js/ui.js");
const studyJs = read("src/js/study.js");

function expectContains(text, snippet, label) {
  assert.ok(text.includes(snippet), `Missing ${label}: ${snippet}`);
}

function expectNotContains(text, snippet, label) {
  assert.ok(!text.includes(snippet), `Forbidden ${label}: ${snippet}`);
}

// --- Happy path: global tokens ---
expectContains(mainCss, '--font-sans: "DM Sans"', "DM Sans token");
expectContains(mainCss, "--bg-base: #111318", "dark bg token");
expectContains(mainCss, "--accent: #18c4aa", "accent token");
expectContains(mainCss, "--radius-sm: 3px", "radius token");
expectContains(indexHtml, "family=DM+Sans", "DM Sans webfont import");
expectContains(indexHtml, 'href="src/css/design-enforcement.css"', "enforcement css linked last");

// --- Happy path: pass-2 enforcement layer ---
expectContains(enforcementCss, "session-complete-stats", "session complete stats grid");
expectContains(enforcementCss, "app-home-screen", "hub ambient glow selector");
expectContains(enforcementCss, "feTurbulence", "base noise texture");
expectContains(enforcementCss, "box-shadow: none !important", "shadow ban");

// --- Per-screen checklist ---
const screens = [
  { name: "home", html: 'id="screenAppHome"', css: ".app-home-screen" },
  { name: "mode-select", html: 'id="screenModeSelect"', css: ".mode-select-screen" },
  { name: "slow", html: 'id="screenSlowReader"', css: ".slow-screen" },
  { name: "cloze", html: 'id="screenClozeStudy"', css: ".cloze-study-card" },
  { name: "recall", html: 'id="screenRecall"', css: ".recall-screen" },
  { name: "review", html: 'id="screenReview"', css: ".review-sm2-view" },
];

for (const screen of screens) {
  expectContains(indexHtml, screen.html, `${screen.name} screen markup`);
  expectContains(
    enforcementCss.includes(screen.css) || mainCss.includes(screen.css) || clozeCss.includes(screen.css) || recallCss.includes(screen.css)
      ? enforcementCss + mainCss + clozeCss + recallCss
      : "",
    screen.css,
    `${screen.name} screen css hook`,
  );
}

// --- Edge case: light mode + reduced motion ---
expectContains(mainCss, '[data-theme="light"]', "light mode section");
expectContains(mainCss, "prefers-reduced-motion: reduce", "reduced motion safeguard");

// --- Mode CSS tokens ---
expectContains(clozeCss, "var(--success", "cloze success token");
expectContains(recallCss, "var(--text-primary", "recall text token");
expectNotContains(graphCss, "drop-shadow", "graph node glow");
expectNotContains(sidebarCss, "#7dd3fc", "legacy blue accent fallback");

// --- Copy: no default emoji (DESIGN.md §12.6) ---
expectNotContains(indexHtml, "📦", "emoji in index.html");
expectNotContains(uiJs, "📦", "emoji in ui.js");
expectNotContains(studyJs, "📦", "emoji in study.js");

// --- Session complete summary wiring ---
expectContains(indexHtml, 'id="sessionCompleteStats"', "session stats mount");
expectContains(uiJs, "updateSessionCompleteSummary", "summary renderer");
expectContains(studyJs, "computeSessionCompleteSummary", "summary computer");

// --- Failure guard: legacy anti-patterns in globals ---
expectNotContains(mainCss, "font-family: \"JetBrains Mono\"", "legacy monospace body font");
expectNotContains(mainCss, "font-family: \"Orbitron\"", "legacy display font");
expectNotContains(mainCss, "background: linear-gradient(135deg, #77b4ff, #4a8dff)", "gradient primary button");

// --- Contract: SW version sync ---
const swVersionMatch = swUpdate.match(/SW_VERSION = "([^"]+)"/);
assert.ok(swVersionMatch, "SW_VERSION is not defined");
const swVersion = swVersionMatch[1];
expectContains(indexHtml, `sw-update.js?v=${swVersion}`, "versioned sw-update import");
expectContains(indexHtml, `main.js?v=${swVersion}`, "versioned main import");
expectContains(sw, 'const CACHE_NAME = "pith-v39"', "cache bump");
expectContains(sw, "/src/css/design-enforcement.css", "enforcement css in sw cache");

console.log("20260616_design-system-enforcement: OK (pass 2)");
