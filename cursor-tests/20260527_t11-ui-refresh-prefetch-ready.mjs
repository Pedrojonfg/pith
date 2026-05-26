/**
 * T11 — UI refresh on prefetch ready (FR-009)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_t11-ui-refresh-prefetch-ready.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resetStorage } from "./setup-dom.mjs";
import { els } from "./mock-ui.mjs";
import {
  getSortedSessionConcepts,
  renderDictionary,
  syncConceptsFromBlock,
  updateDictionaryButtonVisibility,
} from "../src/js/dictionary.js";
import {
  applyPrefetchReadySideEffects,
  setOnPrefetchReady,
  state,
  storeActiveSession,
} from "../src/js/session.js";

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

function makeDomElement(tag) {
  const el = {
    tagName: String(tag || "").toUpperCase(),
    innerHTML: "",
    textContent: "",
    className: "",
    style: {},
    hidden: false,
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    children: [],
    _attrs: {},
    setAttribute(k, v) {
      this._attrs[k] = String(v);
    },
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
  };
  return el;
}

globalThis.document = {
  getElementById: () => null,
  createElement: (tag) => makeDomElement(tag),
  body: makeDomElement("body"),
};

// --- Static: study.js wires FR-009 contract ---
const studySrc = await readFile(join(root, "src/js/study.js"), "utf8");
assert(studySrc.includes("setOnPrefetchReady"), "wireStudyHandlers registers prefetch hook");
assert(
  studySrc.includes("refreshUiOnPrefetchReady") &&
    studySrc.includes("updateDictionaryButtonVisibility()"),
  "prefetch hook refreshes dictionary button visibility",
);
assert(
  studySrc.includes("o.wrap.getAttribute(\"aria-hidden\")") &&
    studySrc.includes("o.dictionaryWrap") &&
    studySrc.includes("getSortedSessionConcepts()"),
  "prefetch hook re-renders transition overlay dictionary when open",
);
assert(
  studySrc.includes("syncConceptsFromBlock") && studySrc.includes("persistNextBlock"),
  "persistNextBlock syncs concepts_by_block after regen/adjust",
);

// --- Behavioral: hook updates aggregate + dictionary button (block index 1, prefetch block 2) ---
resetStorage();
const session = {
  n_blocks: 3,
  blocks_list_text: "1. One\n2. Two\n3. Three",
  blocks: [{ explanation: "done", questions: [] }, {}, {}],
};
storeActiveSession(session);
state.activeSession = session;
state.activeBlockIndex = 1;
els.screenTest._ariaHidden = "false";
els.dictionaryBtn.hidden = true;

const dictionaryWrap = makeDomElement("div");

function refreshUiLikeStudy() {
  updateDictionaryButtonVisibility();
  const concepts = getSortedSessionConcepts();
  renderDictionary({
    containerEl: dictionaryWrap,
    title: `Conceptos hasta ahora (${concepts.length} términos)`,
    concepts,
    collapsedByDefault: true,
  });
}

setOnPrefetchReady(() => {
  refreshUiLikeStudy();
});

applyPrefetchReadySideEffects(
  2,
  {
    id: 3,
    title: "Three",
    explanation: "Block three prefetch.",
    questions: [],
    concepts: [{ term: "PrefetchTerm", definition: "From block 3 prefetch" }],
  },
  { n_test: 2, n_socratic: 0 },
);

const sorted = getSortedSessionConcepts();
assert(
  sorted.some((c) => c.term === "PrefetchTerm"),
  "prefetch ready: aggregate dictionary includes prefetched block terms",
);
assert(
  dictionaryWrap.children.length > 0,
  "prefetch hook re-rendered dictionary container",
);
function collectText(node) {
  if (!node) return "";
  const parts = [node.textContent || ""];
  for (const c of node.children || []) parts.push(collectText(c));
  return parts.join(" ");
}
assert(
  collectText(dictionaryWrap).includes("PrefetchTerm"),
  "overlay-style dictionary lists prefetched term",
);

// --- persistNextBlock path: syncConceptsFromBlock on regen ---
resetStorage();
syncConceptsFromBlock(1, [{ term: "RegenTerm", definition: "after adjust" }]);
assert(
  getSortedSessionConcepts().some((c) => c.term === "RegenTerm"),
  "syncConceptsFromBlock (persistNextBlock path) updates aggregate",
);

setOnPrefetchReady(null);

console.log(`\nT11 UI refresh on prefetch ready: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
