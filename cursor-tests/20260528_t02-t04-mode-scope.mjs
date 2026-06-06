/**
 * T02/T04 — mode selector + headings scope picker
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_t02-t04-mode-scope.mjs
 */
import { buildScopeOptions, parseHeadings } from "../src/js/slow/headings.js";
import {
  emptySessionsByMode,
  loadSessionForMode,
  normalizeStudyMode,
  storeSessionForMode,
} from "../src/js/session.js";

function createSlowSessionFixture() {
  return {
    studyMode: "slow",
    slow: { phase: "scope", criticalMode: true },
  };
}

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

// T04: markdown headings offsets
const md = "# Intro\n\nPara uno.\n\n## Section A\n\nTexto A.\n\n## Section B\n\nTexto B.";
const headings = parseHeadings(md, "markdown");
assert(headings.length === 3, "T04: finds h1 + 2 h2");
assert(headings[1].label === "Section A", "T04: section A label");
assert(headings[1].charStart < headings[2].charStart, "T04: ordered by offset");

const scopes = buildScopeOptions(md, "markdown");
assert(scopes[0].kind === "full", "T04: full doc first");
assert(scopes.some((s) => s.label === "Section A"), "T04: section scope exists");
const sectionA = scopes.find((s) => s.label === "Section A");
assert(sectionA.charEnd === headings[2].charStart, "T04: section A ends at next heading");

// T02: slow session shape (fixture mirrors createSlowSession)
const slow = createSlowSessionFixture();
assert(slow.studyMode === "slow", "T02: slow session studyMode");
assert(slow.slow.phase === "scope", "T02: initial phase scope");
assert(slow.slow.criticalMode === true, "T02: critical mode persisted");

// T02: dual slot isolation
localStorage.setItem("sessions_by_mode", JSON.stringify(emptySessionsByMode()));
storeSessionForMode("rsvp", { studyMode: "rsvp", n_blocks: 2 });
storeSessionForMode("slow", slow);
assert(loadSessionForMode("rsvp")?.n_blocks === 2, "T02: rsvp slot isolated");
assert(loadSessionForMode("slow")?.slow?.phase === "scope", "T02: slow slot isolated");

assert(normalizeStudyMode("") === "rsvp", "T02: default mode rsvp");
assert(normalizeStudyMode("slow") === "slow", "T02: slow normalized");

console.log(`\n20260528_t02-t04-mode-scope: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
