/**
 * T01 — sidebar reader completa
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t01-sidebar-reader.mjs
 */
import { charOffsetToPage } from "../src/js/slow/pagination.js";
import {
  annotationExcerpt,
  collectDictionaryTerms,
  groupAnnotationsByType,
  resolveSidebarOpen,
  typeLabelEs,
} from "../src/js/slow/sidebar.js";

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

const scopeText = "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega.";
const breakpoints = [
  { pageIndex: 0, charStart: 0, charEnd: 40 },
  { pageIndex: 1, charStart: 40, charEnd: 100 },
];

const annotations = [
  { id: "a1", type: "≈", charStart: 6, charEnd: 10, userText: "" },
  { id: "a2", type: "?", charStart: 50, charEnd: 55, userText: "¿Qué es gamma?" },
  { id: "a3", type: "≈", charStart: 12, charEnd: 17, userText: "" },
];

assert(typeLabelEs("≈") === "Paráfrasis", "T01: Spanish label for paraphrase");
assert(typeLabelEs("?") === "Pregunta", "T01: Spanish label for question");

const groups = groupAnnotationsByType(annotations);
assert(groups.length === 2, "T01: two annotation groups");
assert(groups[0][0] === "≈" && groups[0][1].length === 2, "T01: approx group has 2 items");
assert(groups[1][0] === "?" && groups[1][1].length === 1, "T01: question group has 1 item");

const groupTitle = `${groups[0][0]} ${typeLabelEs(groups[0][0])} (${groups[0][1].length})`;
assert(groupTitle === "≈ Paráfrasis (2)", "T01: group header format");

const excerptLong = annotationExcerpt(scopeText, { charStart: 0, charEnd: 80, userText: "" });
assert(excerptLong.length <= 40, "T01: excerpt max 40 chars");
assert(excerptLong.endsWith("…"), "T01: long excerpt truncated with ellipsis");

const excerptUser = annotationExcerpt(scopeText, { charStart: 0, charEnd: 5, userText: "Nota corta" });
assert(excerptUser === "Nota corta", "T01: userText preferred over scope slice");

const page0 = charOffsetToPage(breakpoints, 6) + 1;
const page1 = charOffsetToPage(breakpoints, 50) + 1;
assert(page0 === 1, "T01: charStart 6 maps to page 1");
assert(page1 === 2, "T01: charStart 50 maps to page 2");

const session = {
  slow: {
    phase0: {
      conceptsToFind: [{ term: "Beta", authorUsage: "uso del autor" }],
    },
  },
};
const terms = collectDictionaryTerms(session, [{ term: "Alpha", definition: "def A" }]);
assert(terms.length === 2, "T01: dictionary merges phase0 + session");
assert(terms.some((t) => t.term === "Beta"), "T01: phase0 term included");
assert(terms.some((t) => t.term === "Alpha"), "T01: session term included");

const deduped = collectDictionaryTerms(session, [{ term: "beta", definition: "dup" }]);
assert(deduped.length === 1, "T01: duplicate terms deduped case-insensitively");

assert(resolveSidebarOpen({ slow: {} }) === true, "T01: sidebar open by default");
assert(resolveSidebarOpen({ slow: { sidebarOpen: false } }) === false, "T01: sidebarOpen false respected");
assert(resolveSidebarOpen({ slow: { sidebarOpen: true } }) === true, "T01: sidebarOpen true respected");

assert(annotationExcerpt("", { charStart: 0, charEnd: 0, userText: "" }) === "", "T01: empty excerpt edge case");

console.log(`\n20260528_t01-sidebar-reader: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
