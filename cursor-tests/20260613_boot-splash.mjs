/**
 * Boot splash — brief brand veil on cold start.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260613_boot-splash.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import {
  SPLASH_SESSION_KEY,
  SPLASH_FADE_MS,
  SPLASH_GLOW_MS,
  SPLASH_CYCLE_MS,
  SPLASH_MAX_MS,
  shouldShowSplash,
  dismissSplash,
  initSplash,
} from "../src/js/splash.js";

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

const [indexHtml, mainJs, mainCss, swJs, swUpdate] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/main.js"), "utf8"),
  readFile(join(root, "src/css/main.css"), "utf8"),
  readFile(join(root, "sw.js"), "utf8"),
  readFile(join(root, "src/js/sw-update.js"), "utf8"),
]);

// --- Happy path ---

assert(indexHtml.includes('id="app-splash"'), "happy: splash overlay in index.html");
assert(indexHtml.includes("Space Grotesk"), "happy: Space Grotesk font linked");
assert(indexHtml.includes('class="app-splash-word">Pith'), "happy: Pith wordmark markup");
assert(indexHtml.includes("initSplash()"), "happy: initSplash called from boot script");
assert(indexHtml.includes("dismissSplash(true)"), "happy: boot failure dismisses splash");
assert(mainJs.includes('from "./splash.js'), "happy: main.js imports splash");
assert(mainJs.includes("dismissSplash(false)"), "happy: bootstrap finally dismisses splash");
assert(mainCss.includes("@keyframes app-splash-fade"), "happy: splash fade animation in main.css");
assert(mainCss.includes("@keyframes app-splash-halo"), "happy: splash halo animation in main.css");
assert(mainCss.includes("app-splash--active"), "happy: splash loops while active");
assert(indexHtml.includes("app-splash-halo"), "happy: halo element in markup");
assert(indexHtml.includes("app-splash--active"), "happy: inline boot script activates animation");
assert(indexHtml.includes("@keyframes app-splash-fade"), "happy: critical inline fade keyframes");
assert(indexHtml.includes("opacity: 0"), "happy: wordmark starts invisible for fade-in");
assert(mainCss.includes('background: #000'), "happy: splash black background");
assert(swJs.includes("/src/js/splash.js"), "happy: splash.js in SW static assets");

const versionMatch = swUpdate.match(/SW_VERSION = "([^"]+)"/);
const version = versionMatch?.[1] ?? "";
assert(version.length > 0, "happy: SW_VERSION exported");
assert(indexHtml.includes(`main.js?v=${version}`), "happy: index.html main.js version sync");
assert(indexHtml.includes(`splash.js?v=${version}`), "happy: index.html splash.js version sync");

// --- Edge: session skip ---

const sessionStore = new Map();
const sessionStorage = {
  getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
  setItem: (k, v) => sessionStore.set(k, String(v)),
};
assert(
  shouldShowSplash({ sessionStorage, matchMedia: () => ({ matches: false }) }) === true,
  "edge: first visit shows splash",
);
sessionStore.set(SPLASH_SESSION_KEY, "1");
assert(
  shouldShowSplash({ sessionStorage, matchMedia: () => ({ matches: false }) }) === false,
  "edge: same session skip after seen",
);

// --- Edge: reduced motion ---

assert(
  shouldShowSplash({
    sessionStorage: { getItem: () => null, setItem: () => {} },
    matchMedia: (q) => ({ matches: q.includes("reduce") }),
  }) === false,
  "edge: prefers-reduced-motion skips splash",
);

// --- Edge: inline early skip script ---

assert(
  indexHtml.includes('sessionStorage.getItem("pith_splash_seen")'),
  "edge: inline script checks session before modules load",
);

// --- Failure: timing constants bounded ---

assert(SPLASH_FADE_MS === 150, "failure: fade phase is 150ms");
assert(SPLASH_GLOW_MS === 300, "failure: glow phase is 300ms");
assert(SPLASH_CYCLE_MS === 450, "failure: full cycle is 450ms");
assert(SPLASH_MAX_MS >= SPLASH_CYCLE_MS && SPLASH_MAX_MS <= 1200, "failure: MAX display capped");

const splashSrc = await readFile(join(root, "src/js/splash.js"), "utf8");
assert(
  splashSrc.includes('classList.remove("app-splash--active")'),
  "contract: dismiss stops looping animation",
);
assert(
  !splashSrc.includes("SPLASH_MIN_MS"),
  "contract: no artificial minimum display delay",
);

// --- Edge: dismiss on bootstrap-ready (DOM simulation) ---

const dom = new JSDOM(
  `<div id="app-splash" class="app-splash--active"><span class="app-splash-word">Pith</span></div>`,
);
globalThis.document = dom.window.document;
initSplash();
dismissSplash(false);
const live = dom.window.document.getElementById("app-splash");
assert(live?.classList.contains("app-splash--out"), "edge: bootstrap dismiss adds out class");
assert(!live?.classList.contains("app-splash--active"), "edge: bootstrap dismiss stops active loop");

assert(
  indexHtml.includes("#app-splash") && indexHtml.includes("background: #000"),
  "contract: critical inline CSS in head",
);

// --- Contract: inline critical CSS prevents white flash ---

console.log(`\n20260613_boot-splash: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
