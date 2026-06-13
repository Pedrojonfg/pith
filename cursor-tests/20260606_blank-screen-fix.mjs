/**
 * Blank screen fix — circular import + showScreen fallback
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_blank-screen-fix.mjs
 * Real boot: node cursor-tests/_boot-real.mjs
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

const [uiSrc, mainSrc, offlineSrc, studySrc, exportSrc, sessionSrc, guideSrc, indexHtml, swSrc] =
  await Promise.all([
    readFile(join(root, "src/js/ui.js"), "utf8"),
    readFile(join(root, "src/js/main.js"), "utf8"),
    readFile(join(root, "src/js/offline.js"), "utf8"),
    readFile(join(root, "src/js/study.js"), "utf8"),
    readFile(join(root, "src/js/export.js"), "utf8"),
    readFile(join(root, "src/js/session.js"), "utf8"),
    readFile(join(root, "src/js/guide-chat.js"), "utf8"),
    readFile(join(root, "index.html"), "utf8"),
    readFile(join(root, "sw.js"), "utf8"),
  ]);

// Happy: isOfflineMode extracted — ui no longer imports main
assert(offlineSrc.includes("export const isOfflineMode"), "BS: offline.js exports isOfflineMode");
assert(!uiSrc.includes('from "./main.js'), "BS: ui.js does not import main.js");
assert(uiSrc.includes('from "./offline.js'), "BS: ui.js imports offline.js");
assert(!mainSrc.includes("export const isOfflineMode"), "BS: main.js no longer exports isOfflineMode");

// Happy: dependents switched to offline.js
for (const [name, src] of [
  ["study.js", studySrc],
  ["export.js", exportSrc],
  ["session.js", sessionSrc],
  ["guide-chat.js", guideSrc],
]) {
  assert(src.includes('from "./offline.js'), `BS: ${name} imports offline.js`);
  assert(!src.includes('isOfflineMode } from "./main.js'), `BS: ${name} no longer imports main for offline`);
}

// Happy: defensive showScreen
assert(uiSrc.includes("function resolveModeSelectScreenEl"), "BS: lazy mode select resolver");
assert(
  uiSrc.includes('which === "create" || (showModeSelect && !modeSelectEl)'),
  "BS: fallback to create when mode select element missing",
);
assert(uiSrc.includes('no visible screen'), "BS: ultimate fallback to setup");

// Happy: bootstrap guarded
assert(mainSrc.includes("Failed to open initial screen"), "BS: bootstrap try/catch");

// Happy: cache bust + SW bump
assert(indexHtml.includes("main.js?v=20260606_1"), "BS: index.html cache bust");
assert(swSrc.includes("pith-v"), "BS: service worker cache uses pith prefix");
assert(swSrc.includes("/src/css/slow-mode.css"), "BS: slow-mode.css in SW assets");

// Edge: simulate showScreen fallback when #screenModeSelect removed from DOM
const dom = new JSDOM(indexHtml);
const doc = dom.window.document;
const create = doc.getElementById("screenPlaceholder");
const setup = doc.getElementById("screenApiSetup");
doc.getElementById("screenModeSelect")?.remove();

function applyShowScreen(which) {
  const showModeSelect = which === "modeSelect";
  const modeSelectEl = doc.getElementById("screenModeSelect");
  const showModeSelectScreen = showModeSelect && !!modeSelectEl;
  const showCreate = which === "create" || (showModeSelect && !modeSelectEl);
  const showSetup = which === "setup";
  if (modeSelectEl) modeSelectEl.setAttribute("aria-hidden", String(!showModeSelectScreen));
  create?.setAttribute("aria-hidden", String(!showCreate));
  setup?.setAttribute("aria-hidden", String(!showSetup));
  const anyVisible = doc.querySelector('.screen[aria-hidden="false"]');
  if (!anyVisible && which !== "setup") setup?.setAttribute("aria-hidden", "false");
}

applyShowScreen("modeSelect");
const visibleAfterMissing = doc.querySelector('.screen[aria-hidden="false"]');
assert(visibleAfterMissing?.id === "screenPlaceholder" || visibleAfterMissing?.id === "screenApiSetup",
  "BS: modeSelect without element shows create or setup fallback");

// Failure: old broken pattern must not return
assert(!uiSrc.includes('from "./main.js?v=20260525_1"'), "BS: ui.js main import removed");

console.log(`\n20260606_blank-screen-fix: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
