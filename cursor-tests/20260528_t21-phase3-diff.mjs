/**
 * T21 — comparePhase0ToAnnotations with real scope offsets
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t21-phase3-diff.mjs
 */
import {
  PROXIMITY,
  comparePhase0ToAnnotations,
  resolveArgumentMapNodeAnchor,
} from "../src/js/slow/phase3.js";
import { charOffsetToPage } from "../src/js/slow/pagination.js";

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

const scopeText = [
  "# Ensayo sobre la libertad",
  "",
  "La tesis central es que la libertad moral requiere autonomía racional.",
  "Primero, el autor argumenta que sin razón no hay responsabilidad personal.",
  "Segundo, sostiene que la voluntad deliberada distingue actos libres de reflejos.",
  "Por tanto, concluye que la educación ética debe cultivar el juicio crítico.",
].join("\n");

const phase0 = {
  argumentMap: [
    { id: "P1", text: "sin razón no hay responsabilidad personal", status: "argued" },
    { id: "P2", text: "voluntad deliberada distingue actos libres", status: "argued" },
    { id: "C", text: "educación ética debe cultivar el juicio crítico", status: "argued" },
  ],
  conceptsToFind: [
    { term: "libertad", authorUsage: "moral agency" },
    { term: "razón", authorUsage: "rational autonomy" },
  ],
  fillableBlanks: [
    {
      nodeId: "P2",
      userText: "nota rellenable sobre voluntad",
      annotationId: "fill-ann",
      pageIndex: 2,
    },
  ],
};

const p1Anchor = resolveArgumentMapNodeAnchor(phase0.argumentMap[0], scopeText, [], []);
const fillAnn = {
  id: "fill-ann",
  type: "→",
  charStart: scopeText.indexOf("voluntad deliberada"),
  charEnd: scopeText.indexOf("voluntad deliberada") + 22,
  userText: "Voluntad como criterio de libertad",
};
const p2Fillable = resolveArgumentMapNodeAnchor(
  phase0.argumentMap[1],
  scopeText,
  phase0.fillableBlanks,
  [fillAnn],
);
const cAnchor = resolveArgumentMapNodeAnchor(phase0.argumentMap[2], scopeText, [], []);

assert(p1Anchor.source === "text" && p1Anchor.anchor != null, "T21 setup: P1 anchor from real scope text");
assert(p2Fillable.source === "fillable", "T21 setup: fillable blank overrides P2 text search");
assert(cAnchor.source === "text" && cAnchor.anchor != null, "T21 setup: conclusion anchor resolved");

const p1Mid = Math.floor(p1Anchor.anchor);
const annotations = [
  {
    id: "near-p1",
    type: "≈",
    charStart: p1Mid - 30,
    charEnd: p1Mid + 10,
    userText: "Parafraseo: responsabilidad exige razón",
  },
  fillAnn,
  {
    id: "near-c",
    type: "⊘",
    charStart: Math.floor(cAnchor.anchor) - 15,
    charEnd: Math.floor(cAnchor.anchor) + 25,
    userText: "Objeto: falta evidencia empírica",
  },
  {
    id: "irrelevant",
    type: "⚑",
    charStart: p1Mid,
    charEnd: p1Mid + 5,
    userText: "solo marcador",
  },
];

const breakpoints = [
  { pageIndex: 0, charStart: 0, charEnd: scopeText.indexOf("Primero") },
  { pageIndex: 1, charStart: scopeText.indexOf("Primero"), charEnd: scopeText.indexOf("Segundo") },
  { pageIndex: 2, charStart: scopeText.indexOf("Segundo"), charEnd: scopeText.length },
];

const diff = comparePhase0ToAnnotations(phase0, annotations, scopeText);

const p1Row = diff.find((r) => r.node.id === "P1");
const p2Row = diff.find((r) => r.node.id === "P2");
const cRow = diff.find((r) => r.node.id === "C");

assert(p1Row?.hit === true, "T21 happy: annotation near P1 real offset → hit");
assert(
  p1Row?.snippet.includes("responsabilidad"),
  "T21 happy: P1 snippet from user paraphrase",
);
assert(p1Row?.matchedAnnotation?.id === "near-p1", "T21 happy: P1 matches closest relevant annotation");

assert(p2Row?.hit === true, "T21 happy: fillable-linked annotation marks P2");
assert(p2Row?.source === "fillable", "T21 happy: P2 anchor source is fillable");

assert(cRow?.hit === true, "T21 happy: critical annotation near conclusion → hit");
assert(cRow?.matchedAnnotation?.type === "⊘", "T21 happy: conclusion matched critical type");

const p1Page = charOffsetToPage(breakpoints, annotations[0].charStart) + 1;
const cPage = charOffsetToPage(breakpoints, annotations[2].charStart) + 1;
assert(p1Page >= 1 && cPage >= p1Page, "T21 edge: real offsets map to ordered 1-based pages");

const farCharStart = Math.floor(cAnchor.anchor) + PROXIMITY + 50;
const farAnnotations = [
  {
    id: "far",
    type: "≈",
    charStart: farCharStart,
    charEnd: farCharStart + 20,
    userText: "nota lejana del mapa",
  },
];
const diffMiss = comparePhase0ToAnnotations(phase0, farAnnotations, scopeText);
assert(
  diffMiss.every((r) => !r.hit),
  "T21 failure: annotation far from all anchors → all misses",
);

const emptyTextAnn = [
  {
    id: "empty",
    type: "≈",
    charStart: p1Mid,
    charEnd: p1Mid + 5,
    userText: "   ",
  },
];
assert(
  !comparePhase0ToAnnotations(phase0, emptyTextAnn, scopeText).find((r) => r.node.id === "P1")?.hit,
  "T21 failure: whitespace-only userText ignored",
);

const boundaryDist = Math.floor(p1Anchor.anchor + PROXIMITY);
const boundaryAnn = [
  {
    id: "edge",
    type: "→",
    charStart: boundaryDist - 3,
    charEnd: boundaryDist + 3,
    userText: "just inside proximity window",
  },
];
assert(
  comparePhase0ToAnnotations(phase0, boundaryAnn, scopeText).find((r) => r.node.id === "P1")?.hit,
  "T21 edge: annotation at PROXIMITY boundary counts as hit",
);

const flagOnly = comparePhase0ToAnnotations(phase0, [annotations[3]], scopeText);
assert(
  !flagOnly.find((r) => r.node.id === "P1")?.hit,
  "T21 failure: ⚑ type not in relevant set does not produce hit",
);

console.log(`\n20260528_t21-phase3-diff: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
