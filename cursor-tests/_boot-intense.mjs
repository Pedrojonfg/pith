/**
 * Intense boot probe — import every module in main.js dependency chain.
 * Run: node cursor-tests/_boot-intense.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const dom = new JSDOM(html, { url: "http://127.0.0.1:3456/" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  CustomEvent: dom.window.CustomEvent,
  fetch: async () => ({ ok: false, status: 404 }),
});
dom.window.localStorage.setItem("ds_api_key", "sk-test");

const modules = [
  "src/js/offline.js",
  "src/js/config.js",
  "src/js/ui.js",
  "src/js/session.js",
  "src/js/study.js",
  "src/js/graph/view.js",
  "src/js/graph/adapters.js",
  "src/js/graph/proximity.js",
  "src/js/graph/build.js",
  "src/js/graph/canvas.js",
  "src/js/graph/ids.js",
  "src/js/slow/sidebar.js",
  "src/js/main.js",
];

const missing = modules.filter((m) => !existsSync(join(root, m)));
if (missing.length) {
  console.error("MISSING FILES:", missing.join(", "));
  process.exit(1);
}

const errors = [];
for (const mod of modules) {
  const url = pathToFileURL(join(root, mod)).href + "?probe=1";
  try {
    await import(url);
    console.log("OK", mod);
  } catch (e) {
    console.error("FAIL", mod, "—", e.message);
    errors.push({ mod, message: e.message, stack: e.stack?.split("\n").slice(0, 4).join("\n") });
  }
}

try {
  await import(pathToFileURL(join(root, "src/js/main.js")).href + "?v=20260606_1");
  const visible = [...dom.window.document.querySelectorAll(".screen")]
    .filter((s) => s.getAttribute("aria-hidden") === "false")
    .map((s) => s.id);
  console.log("\nVisible after bootstrap:", visible.join(", ") || "(NONE)");
  if (!visible.length) errors.push({ mod: "bootstrap", message: "no visible screen" });
} catch (e) {
  errors.push({ mod: "bootstrap", message: e.message, stack: e.stack });
}

if (errors.length) {
  console.error("\n=== ERRORS ===");
  for (const err of errors) console.error(JSON.stringify(err, null, 2));
  process.exit(1);
}

console.log("\nAll imports OK");
