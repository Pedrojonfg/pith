import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";
import {
  ANNOTATION_TYPES,
  ANNOTATION_HIGHLIGHT_CLASS,
  IA_QUERY_TYPE,
  annotationHighlightClass,
  annotationsOnPage,
  buildAnnotationHighlightSegments,
  createNestedHighlightSpans,
  pickPrimaryAnnotation,
} from "../src/js/slow/annotations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "../src/css/slow-mode.css"), "utf8");

const slice = { charStart: 100, charEnd: 120 };
const plain = "abcdefghijklmnopqr";

// --- annotationHighlightClass: happy / edge / failure ---

for (const t of ANNOTATION_TYPES) {
  const slug = annotationHighlightClass(t.symbol);
  assert.notEqual(slug, "default", `type ${t.symbol} must have a highlight class`);
  assert.equal(slug, ANNOTATION_HIGHLIGHT_CLASS[t.symbol]);
}

assert.equal(annotationHighlightClass(IA_QUERY_TYPE), "ia-query");
assert.equal(annotationHighlightClass("unknown"), "default");
assert.equal(annotationHighlightClass(""), "default");

const slugs = new Set(Object.values(ANNOTATION_HIGHLIGHT_CLASS));
assert.equal(slugs.size, Object.keys(ANNOTATION_HIGHLIGHT_CLASS).length, "each type slug must be unique");

for (const slug of slugs) {
  assert.match(css, new RegExp(`\\.slow-ann-highlight--${slug}\\s*\\{`), `CSS missing .slow-ann-highlight--${slug}`);
}

// --- buildAnnotationHighlightSegments: happy path (single) ---

const single = buildAnnotationHighlightSegments(slice, plain, [
  { id: "a1", type: "≈", charStart: 102, charEnd: 106, createdAt: 1 },
]);
assert.equal(single.length, 3);
assert.deepEqual(
  single.map((s) => [s.segStart, s.segEnd, s.covering.length]),
  [
    [0, 2, 0],
    [2, 6, 1],
    [6, 18, 0],
  ],
);
assert.equal(single[1].text, "cdef");
assert.equal(single[1].covering[0].type, "≈");

// --- overlap: layered covering ---

const overlap = buildAnnotationHighlightSegments(slice, plain, [
  { id: "a1", type: "≈", charStart: 102, charEnd: 108, createdAt: 1 },
  { id: "a2", type: "⊘", charStart: 104, charEnd: 110, createdAt: 2 },
]);
const mid = overlap.find((s) => s.segStart === 4 && s.segEnd === 8);
assert.ok(mid, "overlap region must be its own segment");
assert.equal(mid.covering.length, 2);
assert.deepEqual(new Set(mid.covering.map((a) => a.type)), new Set(["⊘", "≈"]));

// --- edge: no annotations on page ---

assert.deepEqual(buildAnnotationHighlightSegments(slice, plain, []), []);
assert.deepEqual(
  buildAnnotationHighlightSegments(slice, plain, [
    { id: "off", type: "?", charStart: 50, charEnd: 55 },
  ]),
  [],
);

// --- edge: annotation outside page bounds filtered via annotationsOnPage ---

assert.equal(
  annotationsOnPage([{ id: "x", type: "?", charStart: 90, charEnd: 100 }], slice).length,
  0,
);
assert.equal(
  annotationsOnPage([{ id: "x", type: "?", charStart: 100, charEnd: 101 }], slice).length,
  1,
);

// --- failure: zero-length / inverted local range ignored ---

assert.deepEqual(
  buildAnnotationHighlightSegments(slice, plain, [
    { id: "bad", type: "≈", charStart: 105, charEnd: 105 },
  ]),
  [],
);

// --- pickPrimaryAnnotation: happy / edge / failure ---

assert.equal(pickPrimaryAnnotation([{ id: "a", createdAt: 5 }]).id, "a");
assert.equal(
  pickPrimaryAnnotation([
    { id: "old", createdAt: 1 },
    { id: "new", createdAt: 9 },
  ]).id,
  "new",
);
assert.equal(pickPrimaryAnnotation([]), null);
assert.equal(pickPrimaryAnnotation(null), null);

// --- createNestedHighlightSpans: DOM nesting (overlap blend layers) ---

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
const { document } = dom.window;
const textNode = document.createTextNode("efgh");
const nested = createNestedHighlightSpans(
  [
    { id: "a1", type: "≈", createdAt: 1, userText: "para" },
    { id: "a2", type: "⊘", createdAt: 2, userText: "obj" },
  ],
  document,
  textNode,
);

assert.equal(nested.className, "slow-ann-highlight slow-ann-highlight--reject");
assert.equal(nested.dataset.annId, "a2");
assert.equal(nested.childElementCount, 1);
const inner = nested.firstElementChild;
assert.equal(inner.className, "slow-ann-highlight slow-ann-highlight--approx");
assert.equal(inner.dataset.annId, "a1");
assert.equal(inner.textContent, "efgh");
assert.equal(nested.getAttribute("role"), null);

console.log("20260609_slow-inline-highlights: ok");
