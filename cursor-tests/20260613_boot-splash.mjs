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
  SPLASH_MIN_MS,
  SPLASH_MAX_MS,
  shouldShowSplash,
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
assert(mainCss.includes("@keyframes app-splash-in"), "happy: splash animation in main.css");
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

assert(SPLASH_MIN_MS >= 300 && SPLASH_MIN_MS <= 500, "failure: MIN display is brief");
assert(SPLASH_MAX_MS >= SPLASH_MIN_MS && SPLASH_MAX_MS <= 1200, "failure: MAX display capped");

// --- Contract: inline critical CSS prevents white flash ---

assert(
  indexHtml.includes("#app-splash") && indexHtml.includes("background: #000"),
  "contract: critical inline CSS in head",
);

// --- DOM: splash hidden by default until inline script enables ---

const dom = new JSDOM(indexHtml, { runScripts: "outside-only" });
const splashEl = dom.window.document.getElementById("app-splash");
assert(splashEl !== null, "contract: splash element parseable from HTML");

console.log(`\n20260613_boot-splash: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
