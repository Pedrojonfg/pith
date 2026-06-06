/**
 * T08 — annotations offset CRUD
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t08-annotations.mjs
 */
import { addAnnotation, deleteAnnotation, visibleAnnotationTypes } from "../src/js/slow/annotations.js";

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

const session = {
  slow: {
    readingScope: { charStart: 0, charEnd: 1000 },
    normalizedTextFull: "x".repeat(1000),
    annotations: [],
    criticalMode: true,
  },
};

const ann = addAnnotation(session, { type: "≈", charStart: 10, charEnd: 20, userText: "para" });
assert(ann?.charStart === 10, "T08: annotation stored");
assert(session.slow.annotations.length === 1, "T08: push to session");

const primary = visibleAnnotationTypes(false);
const critical = visibleAnnotationTypes(true);
assert(primary.length >= 5, "T08: primary types visible");
assert(critical.length > primary.length, "T08: critical mode expands menu");

assert(deleteAnnotation(session, ann.id), "T08: delete works");
assert(session.slow.annotations.length === 0, "T08: removed from session");

console.log(`\n20260528_t08-annotations: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
