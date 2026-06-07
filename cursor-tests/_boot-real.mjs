import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";

const html = readFileSync("index.html", "utf8");
const dom = new JSDOM(html, { url: "http://127.0.0.1:3456/" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  CustomEvent: dom.window.CustomEvent,
});
dom.window.localStorage.setItem("ds_api_key", "sk-test");

try {
  await import(pathToFileURL("src/js/main.js").href + "?v=20260525_1");
  const visible = [...dom.window.document.querySelectorAll(".screen")]
    .filter((s) => s.getAttribute("aria-hidden") === "false")
    .map((s) => s.id);
  console.log("visible screens:", visible.join(", ") || "(NONE)");
  if (!visible.length) process.exit(1);
} catch (e) {
  console.error("main.js import FAIL:", e.message);
  process.exit(1);
}
