/**
 * T06 — pagination section boundary snap
 */
import { snapPageEndToSection } from "../src/js/slow/pagination.js";

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

const boundaries = [
  { charStart: 0, charEnd: 500 },
  { charStart: 500, charEnd: 1200 },
  { charStart: 1200, charEnd: 2000 },
];

assert(snapPageEndToSection(480, boundaries, 200, 2000) === 500, "snap within slack");
assert(snapPageEndToSection(480, boundaries, 200, 2000) !== 510, "snap not mid-section");
assert(snapPageEndToSection(1000, boundaries, 50, 2000) === 1000, "no snap outside slack");

console.log(`\n20260609_doc-hierarchy-pagination: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
