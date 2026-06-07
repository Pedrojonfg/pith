/**
 * T05 — long-press edit + ⟷ graphLinks
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t05-longpress-graphlinks.mjs
 */
import {
  addAnnotation,
  addGraphLink,
  addLiteratureGraphLink,
  deleteAnnotation,
  findAnnotation,
  updateAnnotation,
} from "../src/js/slow/annotations.js";
import { buildConceptPickerOptions } from "../src/js/slow/sidebar.js";
import { extractWordAtOffset, lookupSessionTerm } from "../src/js/dictionary.js";

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

function makeSession() {
  return {
    slow: {
      readingScope: { charStart: 0, charEnd: 200 },
      normalizedTextFull: "x".repeat(200),
      annotations: [],
      phase0: {
        conceptsToFind: [
          { term: "Autonomía", authorUsage: "Capacidad de autodeterminación", graphTermId: "autonomia" },
        ],
      },
    },
  };
}

const session = makeSession();
const ann = addAnnotation(session, { type: "⟷", charStart: 5, charEnd: 12, userText: "relaciona con libertad" });
assert(ann?.id, "T05 happy: addAnnotation returns id");
assert(Array.isArray(ann.graphLinks) && ann.graphLinks.length === 0, "T05 happy: new annotation starts with empty graphLinks");

const link = addGraphLink(session, ann.id, { termId: "autonomia", relation: "relaciona con libertad" });
assert(link?.termId === "autonomia", "T05 happy: addGraphLink persists termId");
assert(link?.relation === "relaciona con libertad", "T05 happy: addGraphLink persists relation");
const stored = findAnnotation(session, ann.id);
assert(stored?.graphLinks?.length === 1, "T05 happy: graphLinks array mutated on session");

const lit = addLiteratureGraphLink(session, ann.id, "https://example.org/paper");
assert(lit?.termId === "literature", "T05 happy: literature link uses literature termId");
assert(stored?.graphLinks?.length === 2, "T05 happy: second graphLink appended");

const noTerm = addGraphLink(session, ann.id, { termId: "", relation: "x" });
assert(noTerm === null, "T05 failure: empty termId rejected");
const missing = addGraphLink(session, "missing-id", { termId: "x", relation: "y" });
assert(missing === null, "T05 failure: unknown annotation id rejected");

updateAnnotation(session, ann.id, { userText: "updated note", type: "?" });
assert(findAnnotation(session, ann.id)?.userText === "updated note", "T05 happy: updateAnnotation patches userText");
assert(findAnnotation(session, ann.id)?.type === "?", "T05 happy: updateAnnotation patches type");

assert(deleteAnnotation(session, ann.id) === true, "T05 happy: deleteAnnotation removes entry");
assert(deleteAnnotation(session, ann.id) === false, "T05 failure: second delete is false");
assert(findAnnotation(session, ann.id) === null, "T05 happy: findAnnotation null after delete");

const options = buildConceptPickerOptions({
  slow: {
    phase0: {
      conceptsToFind: [{ term: "Dignidad", authorUsage: "Valor intrínseco", graphTermId: "dignidad" }],
    },
  },
});
assert(options.some((o) => o.termId === "dignidad"), "T05 happy: picker includes phase0 concept");
assert(options.every((o) => o.term && o.termId), "T05 edge: every picker option has term + termId");

const emptyPicker = buildConceptPickerOptions({ slow: { phase0: { conceptsToFind: [] } } });
assert(Array.isArray(emptyPicker), "T05 edge: empty session returns array not throw");

const word = extractWordAtOffset("La autonomía implica libertad.", 5);
assert(word === "autonomía", "T05 happy: extractWordAtOffset finds accented word");

const punct = extractWordAtOffset("Hello, world!", 6);
assert(punct === "world", "T05 edge: skips punctuation to next word");

const none = extractWordAtOffset("   ...   ", 3);
assert(none === "", "T05 failure: whitespace/punctuation-only offset returns empty");

const hit = lookupSessionTerm("Autonomía", {
  sessionConcepts: [{ term: "Libertad", definition: "Ausencia de coacción" }],
  phase0Concepts: [{ term: "Autonomía", authorUsage: "Autodeterminación" }],
});
assert(hit?.source === "phase0" && hit.definition.includes("Autodeterminación"), "T05 happy: lookup finds phase0 term");

const sessionHit = lookupSessionTerm("libertad", {
  sessionConcepts: [{ term: "Libertad", definition: "Ausencia de coacción" }],
  phase0Concepts: [],
});
assert(sessionHit?.source === "session", "T05 edge: session concepts searched when phase0 misses");

const miss = lookupSessionTerm("", { sessionConcepts: [], phase0Concepts: [] });
assert(miss === null, "T05 failure: empty needle returns null");

console.log(`\n20260606_t05-longpress-graphlinks: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
