import { readFile } from "node:fs/promises";
const mockMain = new URL("./mock-main.mjs", import.meta.url).href;
const mockUi = new URL("./mock-ui.mjs", import.meta.url).href;

/** Feature closure suites (validate tooling index). */
export const FEATURE_TEST_SUITES = Object.freeze({
  "20260611-rsvp-block-recommend": "cursor-tests/20260611_rsvp-block-recommend.mjs",
  "20260611-rsvp-assessment-reposition": "cursor-tests/20260611_rsvp-assessment-reposition.mjs",
  "20260612-mode-continuity": "cursor-tests/20260612_mode-continuity.mjs",
  "20260612-rsvp-assessment-questions-parity":
    "cursor-tests/20260612_rsvp-assessment-questions-parity.mjs",
});

/** Strip ?v= cache busters; stub browser-only modules for Node tests. */
export async function resolve(specifier, context, nextResolve) {
  const base = specifier.split("?")[0];
  if (base.endsWith("/main.js") || base.endsWith("\\main.js")) {
    return { url: mockMain, shortCircuit: true };
  }
  if (
    (base.endsWith("/ui.js") || base.endsWith("\\ui.js")) &&
    !specifier.includes("realui=1")
  ) {
    return { url: mockUi, shortCircuit: true };
  }
  if (specifier.includes("?")) {
    const url = new URL(specifier, context.parentURL);
    url.search = "";
    return { url: url.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/** Force app src/js/*.js to load as native ESM in Node tests. */
export async function load(url, context, nextLoad) {
  if (url.includes("/src/js/") && url.endsWith(".js")) {
    const source = await readFile(new URL(url), "utf8");
    return { format: "module", source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
