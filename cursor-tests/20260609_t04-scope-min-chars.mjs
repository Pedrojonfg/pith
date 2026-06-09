import assert from "node:assert/strict";
import {
  buildScopeOptions,
  resolveMinScopeChars,
  formatCharCount,
  applyHeadingOverrides,
} from "../src/js/slow/headings.js";

function testMinScopeCharsFilter() {
  const text = "# Big Section\n\n" + "x".repeat(1000) + "\n\n# Tiny\n\nshort";
  const options = buildScopeOptions(text, "markdown", { documentType: "book" });
  assert.equal(options[0].label, "Full document");
  const tiny = options.find((o) => o.label === "Tiny");
  assert.equal(tiny, undefined);
  const big = options.find((o) => o.label === "Big Section");
  assert.ok(big);
}

function testFormatCharCount() {
  assert.equal(formatCharCount(420000), "~420k");
  assert.equal(formatCharCount(9000), "~9k");
  assert.equal(formatCharCount(150), "~150");
}

function testResolveMinScopeChars() {
  assert.equal(resolveMinScopeChars("paper", [], "x".repeat(1000)), 200);
  assert.equal(resolveMinScopeChars("book", [], "x"), 500);
  assert.equal(resolveMinScopeChars("auto", new Array(10).fill({}), "x"), 500);
}

function testHeadingOverridesRename() {
  const headings = [
    { id: "intro", label: "Intro", charStart: 0, charEnd: 10, level: 1 },
  ];
  const out = applyHeadingOverrides(headings, [
    { type: "rename", headingId: "intro", newLabel: "Introduction" },
  ]);
  assert.equal(out[0].label, "Introduction");
}

testMinScopeCharsFilter();
testFormatCharCount();
testResolveMinScopeChars();
testHeadingOverridesRename();

console.log("20260609_t04-scope-min-chars: all tests passed");
