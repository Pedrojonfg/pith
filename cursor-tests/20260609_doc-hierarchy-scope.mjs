/**
 * T05 — scope picker from docHierarchy
 */
import { buildScopeOptions } from "../src/js/slow/headings.js";
import { buildTrivialHierarchy } from "../src/js/normalization/hierarchy.js";

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

const NO_HEADINGS = "A".repeat(3500);
const tree = buildTrivialHierarchy(NO_HEADINGS);

const withHierarchy = buildScopeOptions(NO_HEADINGS, "markdown", {
  docHierarchy: { tree },
});
assert(withHierarchy.length >= 2, "hierarchy path yields full + sections");
assert(withHierarchy.some((o) => o.label === "Document" || o.kind === "chapter"), "inferred section visible");

const legacy = buildScopeOptions(NO_HEADINGS, "markdown", { docHierarchy: null });
assert(legacy.length >= 1, "null docHierarchy uses legacy path");

console.log(`\n20260609_doc-hierarchy-scope: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
