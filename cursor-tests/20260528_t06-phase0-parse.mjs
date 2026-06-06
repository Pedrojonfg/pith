/**
 * T06 — Phase 0 JSON validation
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t06-phase0-parse.mjs
 */
import { validatePhase0Orientation } from "../src/js/slow/phase0.js";

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

const valid = validatePhase0Orientation({
  thesis: "La libertad requiere autodeterminación racional.",
  argumentMap: [{ id: "P1", text: "Premisa", status: "pending" }],
  conceptsToFind: [
    { term: "libertad", authorUsage: "capacidad de elección" },
    { term: "razón", authorUsage: "guía normativa" },
    { term: "voluntad", authorUsage: "facultad ejecutiva" },
  ],
  guideQuestion: "¿En qué sentido la razón limita la libertad?",
});

assert(valid.thesis.includes("libertad"), "T06: thesis parsed");
assert(valid.conceptsToFind.length === 3, "T06: concepts count");

const invalid = validatePhase0Orientation({});
assert(invalid === null, "T06: rejects empty orientation");

console.log(`\n20260528_t06-phase0-parse: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
