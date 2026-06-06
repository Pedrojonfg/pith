/**
 * Slow Mode — intensive validation suite (T01–T15 contracts)
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260528_validate-intense.mjs
 */
import { JSDOM } from "jsdom";
import {
  LS_ACTIVE_SESSION_KEY,
  LS_SESSIONS_BY_MODE_KEY,
} from "../src/js/config.js";
import { buildMarkdown } from "../src/js/export.js";
import {
  loadSessionForMode,
  loadSessionsByMode,
  migrateLegacyActiveSession,
  normalizeStudyMode,
  storeActiveSession,
  storeSessionForMode,
} from "../src/js/session.js";
import { buildIAContext } from "../src/js/slow/ai-context.js";
import {
  addAnnotation,
  annotationsOnPage,
  deleteAnnotation,
  visibleAnnotationTypes,
} from "../src/js/slow/annotations.js";
import {
  buildSectionBoundaries,
  isLastPageOfSection,
} from "../src/js/slow/checkpoints.js";
import {
  computeDepthScore,
  convertAnnotationsToFlashcards,
  matchConceptFindings,
} from "../src/js/slow/gamification.js";
import {
  buildScopeOptions,
  parseHeadings,
  scopeCharCount,
  SCOPE_CHAR_WARN,
} from "../src/js/slow/headings.js";
import {
  charOffsetToPage,
  closestPageAfterRecompute,
  computePageBreakpoints,
  getPageCount,
  getPageSlice,
  invalidatePaginationCache,
} from "../src/js/slow/pagination.js";
import {
  buildMapReduceChunks,
  buildSectionBoundariesForScope,
  parsePhase0Orientation,
  PHASE0_MAP_REDUCE_THRESHOLD,
  validatePhase0Orientation,
} from "../src/js/slow/phase0.js";
import { comparePhase0ToAnnotations } from "../src/js/slow/phase3.js";

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ── DOM for pagination ──
const dom = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

function makeContainer(w, h) {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: w });
  Object.defineProperty(el, "clientHeight", { value: h });
  document.body.appendChild(el);
  return el;
}

function makeSlowSession(overrides = {}) {
  const text = overrides.text ?? "Intro\n\n## Alpha\n\n".repeat(200) + "Omega end.";
  return {
    studyMode: "slow",
    llmModel: "deepseek",
    materialMeta: { fileName: "essay.md" },
    slow: {
      normalizedTextFull: text,
      normalizedFormat: "markdown",
      readingScope: overrides.scope ?? { kind: "full", charStart: 0, charEnd: text.length, label: "full" },
      phase: "phase1",
      criticalMode: false,
      phase0: overrides.phase0 ?? null,
      annotations: overrides.annotations ?? [],
      maxReadCharEnd: overrides.maxReadCharEnd ?? 0,
      checkpointsDismissed: [],
      typography: { fontSizePx: 18, lineHeight: 1.6, fontFamily: "sans-serif" },
    },
  };
}

// ═══════════════════════════════════════════════════════════════
section("T01 — sessionsByMode (intense)");
// ═══════════════════════════════════════════════════════════════
localStorage.clear();
migrateLegacyActiveSession();
assert(loadSessionsByMode().rsvp === null, "T01: empty bootstrap");

const legacy = { studyMode: "rsvp", n_blocks: 5, blocks_list_text: "1. A" };
localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify(legacy));
localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
migrateLegacyActiveSession();
assert(loadSessionForMode("rsvp")?.n_blocks === 5, "T01 happy: legacy migrates once");

migrateLegacyActiveSession();
const again = loadSessionsByMode();
assert(again.rsvp?.n_blocks === 5 && again.slow === null, "T01 edge: migration idempotent");

storeSessionForMode("slow", { studyMode: "slow", slow: { phase: "scope" } });
storeSessionForMode("rsvp", { studyMode: "rsvp", n_blocks: 9 });
assert(loadSessionForMode("rsvp")?.n_blocks === 9, "T01: rsvp slot overwrite independent");
assert(loadSessionForMode("slow")?.slow?.phase === "scope", "T01: slow slot intact");

storeActiveSession({ studyMode: "slow", slow: { phase: "phase1", tag: "x" } });
const stored = JSON.parse(localStorage.getItem(LS_SESSIONS_BY_MODE_KEY));
assert(stored.slow?.slow?.tag === "x", "T01: storeActiveSession writes slow slot");
assert(stored.rsvp?.n_blocks === 9, "T01: rsvp slot preserved on slow write");

localStorage.setItem(LS_SESSIONS_BY_MODE_KEY, "{bad-json");
const afterCorrupt = loadSessionsByMode();
assert(afterCorrupt.rsvp === null && afterCorrupt.slow === null, "T01 fail: corrupt JSON → empty slots");

assert(normalizeStudyMode("SLOW") === "rsvp", "T01 fail: unknown mode → rsvp");
assert(normalizeStudyMode("slow") === "slow", "T01: slow normalized");

// ═══════════════════════════════════════════════════════════════
section("T04 — headings + scope (intense)");
// ═══════════════════════════════════════════════════════════════
const md = "# Cap\n\nbody\n\n## Sec A\n\naaa\n\n## Sec B\n\nbbb";
const mdHeads = parseHeadings(md, "markdown");
assert(mdHeads.length === 3, "T04 happy: markdown h1+h2×2");
assert(mdHeads[1].charStart < mdHeads[2].charStart, "T04: ordered offsets");

const html = "<h1>Title</h1><p>x</p><h2>Sub</h2><p>y</p>";
const htmlHeads = parseHeadings(html, "html_min");
assert(htmlHeads.length === 2 && htmlHeads[0].label === "Title", "T04 happy: html_min headings");

assert(parseHeadings("", "markdown").length === 0, "T04 edge: empty text");
assert(parseHeadings("no headings here", "markdown").length === 0, "T04 edge: no headings");

const scopes = buildScopeOptions(md, "markdown");
const secA = scopes.find((s) => s.label === "Sec A");
assert(secA && secA.charEnd === md.indexOf("## Sec B"), "T04: section A ends at next heading");
assert(scopes[0].kind === "full", "T04: full doc first option");

const longScope = { charStart: 0, charEnd: SCOPE_CHAR_WARN + 1 };
assert(scopeCharCount(longScope) > SCOPE_CHAR_WARN, "T04 edge: 60k+ scope detectable");

// Scope invariants
for (const opt of scopes) {
  assert(opt.charStart >= 0 && opt.charEnd <= md.length && opt.charStart < opt.charEnd, `T04 invariant: ${opt.label}`);
}

// ═══════════════════════════════════════════════════════════════
section("T05 — pagination (intense)");
// ═══════════════════════════════════════════════════════════════
invalidatePaginationCache();
const container = makeContainer(380, 100);
const typo = { fontSizePx: 16, lineHeight: 1.5, fontFamily: "serif" };
const longText = "Lorem ipsum dolor sit amet. ".repeat(500).trim();

const bp = computePageBreakpoints(longText, container, typo);
assert(getPageCount(bp) >= 3, "T05 happy: long text → multiple pages");

let covered = 0;
for (const p of bp) covered += p.charEnd - p.charStart;
assert(covered === longText.length, "T05 invariant: breakpoints cover full text without gaps");

for (let i = 1; i < bp.length; i += 1) {
  assert(bp[i].charStart === bp[i - 1].charEnd, "T05 invariant: contiguous pages");
}

const bpCached = computePageBreakpoints(longText, container, typo);
assert(bpCached.length === bp.length, "T05 edge: cache returns same breakpoints");

const bigTypo = { ...typo, fontSizePx: 28 };
const bpBig = computePageBreakpoints(longText, container, bigTypo);
assert(getPageCount(bpBig) >= getPageCount(bp), "T05 edge: larger font → more pages");

const page2Start = getPageSlice(bp, 1).charStart;
const preserved = closestPageAfterRecompute(bp, 1, bpBig);
assert(getPageSlice(bpBig, preserved).charStart <= page2Start + 50, "T05: typography change preserves approximate char anchor");

assert(charOffsetToPage(bp, 0) === 0, "T05: offset 0 → page 0");
assert(charOffsetToPage(bp, longText.length - 1) === bp[bp.length - 1].pageIndex, "T05: last char → last page");

const emptyBp = computePageBreakpoints("", container, typo);
assert(emptyBp.length === 1 && emptyBp[0].charEnd === 0, "T05 fail: empty text → single empty page");

// ═══════════════════════════════════════════════════════════════
section("T06 — phase0 parse + map-reduce chunking (intense)");
// ═══════════════════════════════════════════════════════════════
const validJson = `\`\`\`json
{
  "thesis": "Claim X",
  "argumentMap": [{"id":"P1","text":"Because Y","status":"argued"}],
  "conceptsToFind": [
    {"term":"a","authorUsage":"u1"},
    {"term":"b","authorUsage":"u2"},
    {"term":"c","authorUsage":"u3"}
  ],
  "guideQuestion": "Why X?"
}
\`\`\``;
const parsed = parsePhase0Orientation(validJson);
assert(parsed?.thesis === "Claim X", "T06 happy: JSON fence stripped and parsed");

const withCritical = validatePhase0Orientation(
  {
    thesis: "T",
    argumentMap: [{ id: "C", text: "conclusion" }],
    conceptsToFind: [
      { term: "a", authorUsage: "1" },
      { term: "b", authorUsage: "2" },
      { term: "c", authorUsage: "3" },
    ],
    guideQuestion: "Q?",
    criticalExaminePoints: ["weak premise", "hidden assumption"],
  },
  { criticalMode: true },
);
assert(withCritical?.criticalExaminePoints?.length === 2, "T06 happy: critical points when mode on");

assert(validatePhase0Orientation(null) === null, "T06 fail: null input");
assert(
  validatePhase0Orientation({
    thesis: "T",
    argumentMap: [{ id: "P1", text: "x" }],
    conceptsToFind: [{ term: "only", authorUsage: "one" }],
    guideQuestion: "Q",
  }) === null,
  "T06 fail: rejects <3 concepts",
);

assert(PHASE0_MAP_REDUCE_THRESHOLD === SCOPE_CHAR_WARN, "T06 invariant: threshold aligned with scope warn");

const sessionForBoundaries = makeSlowSession({
  text: "# Doc\n\n## S1\n\n" + "x".repeat(100) + "\n\n## S2\n\nyyy",
  scope: { charStart: 0, charEnd: 200, label: "partial" },
});
const bounds = buildSectionBoundariesForScope(sessionForBoundaries);
assert(Array.isArray(bounds) && bounds.every((b) => b.charEnd > b.charStart), "T06: scope-relative section boundaries");

const hugeText = "a".repeat(120000);
const rawChunks = buildMapReduceChunks(hugeText, [], 50000);
assert(rawChunks.length === 3 && rawChunks.every((c) => c.text.length <= 50000), "T06 edge: no-headings split ≤50k");

// ═══════════════════════════════════════════════════════════════
section("T08 — annotations (intense)");
// ═══════════════════════════════════════════════════════════════
const annSession = makeSlowSession({ scope: { charStart: 0, charEnd: 100, label: "s" } });
const ann = addAnnotation(annSession, { type: "≈", charStart: 10, charEnd: 25, userText: "para" });
assert(ann.charEnd === 25, "T08 happy: annotation stored in scope coords");

const clamped = addAnnotation(annSession, { type: "?", charStart: 90, charEnd: 9999, userText: "edge" });
assert(clamped.charEnd <= 100, "T08 edge: charEnd clamped to scope");

const primary = visibleAnnotationTypes(false);
const critical = visibleAnnotationTypes(true);
const criticalSymbols = critical.filter((t) => t.tier === "critical").map((t) => t.symbol);
assert(primary.length === 5, "T08 happy: 5 primary types without critical mode");
assert(criticalSymbols.includes("⊘") && criticalSymbols.includes("⇑"), "T08 happy: critical types in menu when ON");
assert(!primary.some((t) => t.symbol === "⊘"), "T08 fail: critical hidden when mode OFF");

const pageSlice = { charStart: 0, charEnd: 50 };
const onPageBeforeDelete = annotationsOnPage(annSession.slow.annotations, pageSlice);
assert(onPageBeforeDelete.length >= 1, "T08: annotationsOnPage filters by overlap");

assert(deleteAnnotation(annSession, ann.id), "T08: delete removes annotation");
assert(annSession.slow.annotations.length === 1, "T08: one left after delete");

// ═══════════════════════════════════════════════════════════════
section("T09 — anti-spoiler IA context (intense)");
// ═══════════════════════════════════════════════════════════════
const spoilerText = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const slowSpoiler = {
  normalizedTextFull: spoilerText,
  readingScope: { charStart: 0, charEnd: spoilerText.length },
  maxReadCharEnd: 10,
};
assert(buildIAContext(slowSpoiler) === "ABCDEFGHIJ", "T09 happy: slice at maxReadCharEnd");
assert(!buildIAContext(slowSpoiler).includes("K"), "T09 fail: unread letter K excluded");

assert(buildIAContext({ ...slowSpoiler, maxReadCharEnd: 0 }) === "", "T09 edge: unread nothing → empty context");
assert(buildIAContext({ ...slowSpoiler, maxReadCharEnd: 999 }) === spoilerText, "T09 edge: read all → full scope");

// ═══════════════════════════════════════════════════════════════
section("T11 — checkpoints geometry (intense)");
// ═══════════════════════════════════════════════════════════════
const cpText = "## One\n\naaa\n\n## Two\n\nbbb";
const sections = buildSectionBoundaries(cpText, "markdown");
assert(sections.length >= 2, "T11 happy: sections from headings");

const sec0End = sections[0].charEnd;
const syntheticBp = [
  { pageIndex: 0, charStart: 0, charEnd: Math.max(1, sec0End - 5) },
  { pageIndex: 1, charStart: Math.max(1, sec0End - 5), charEnd: sec0End },
  { pageIndex: 2, charStart: sec0End, charEnd: cpText.length },
];
assert(isLastPageOfSection(syntheticBp, 1, sections[0]), "T11 happy: page 1 ends section 0");
assert(!isLastPageOfSection(syntheticBp, 0, sections[0]), "T11 fail: page 0 not section end");

// ═══════════════════════════════════════════════════════════════
section("T12/T13 — phase3 diff + gamification (intense)");
// ═══════════════════════════════════════════════════════════════
const phase0 = {
  argumentMap: [
    { id: "P1", text: "Premise" },
    { id: "C", text: "Conclusion" },
  ],
  conceptsToFind: [{ term: "libertad", authorUsage: "freedom" }],
};
const scopeText = "x".repeat(1000);
const nearAnn = [{ id: "a1", charStart: 480, charEnd: 520, type: "≈", userText: "libertad en el texto" }];
const diffHit = comparePhase0ToAnnotations(phase0, nearAnn, scopeText);
assert(diffHit.some((r) => r.hit), "T12 happy: annotation near anchor → hit");

const farAnn = [{ id: "a2", charStart: 5, charEnd: 8, type: "?", userText: "nope" }];
const diffMiss = comparePhase0ToAnnotations(phase0, farAnn, scopeText);
assert(diffMiss.some((r) => !r.hit), "T12 fail: distant annotation → miss");

const scoreSession = makeSlowSession({
  annotations: [
    { id: "1", type: "→", userText: "explico bien" },
    { id: "2", type: "⊘", userText: "objeto" },
    { id: "3", type: "≈", userText: "" },
  ],
});
const depth = computeDepthScore(scoreSession.slow.annotations);
assert(depth.total >= 6, "T13 happy: depth score sums types");
assert(depth.penalties.length === 1, "T13 fail: empty generative ≈ penalized");
assert(depth.generativeRatio > 0 && depth.generativeRatio < 1, "T13 edge: partial generative ratio");

const findingSession = { slow: { phase0, fillableMapMode: false, findings: [] } };
matchConceptFindings(findingSession, { id: "f1", userText: "discusses libertad here" });
assert(findingSession.slow.findings.length === 1, "T13 happy: concept match registers finding");

const fcSession = makeSlowSession({
  annotations: [
    { id: "fc1", type: "≈", userText: "idea clave" },
    { id: "fc2", type: "⚑", userText: "flag only" },
  ],
});
const cards = convertAnnotationsToFlashcards(fcSession);
assert(cards.length === 1 && cards[0].source === "slow_mode", "T13 happy: flashcard filter types");

// ═══════════════════════════════════════════════════════════════
section("T14 — export routing (intense)");
// ═══════════════════════════════════════════════════════════════
const slowExport = makeSlowSession({
  phase0: { thesis: "Tesis export", guideQuestion: "Q?" },
  annotations: [{ type: "≈", charStart: 1, charEnd: 5, userText: "nota" }],
});
slowExport.studyMode = "slow";
const slowMd = buildMarkdown(slowExport);
assert(slowMd.includes("# Slow Mode Session"), "T14 happy: slow export header");
assert(slowMd.includes("Tesis export") && slowMd.includes("≈"), "T14 happy: phase0 + annotations in export");
assert(slowMd.includes("Depth score"), "T14 happy: depth score section");

const rsvpMd = buildMarkdown({
  studyMode: "rsvp",
  n_blocks: 1,
  n_test: 2,
  n_socratic: 1,
  blocks_list_text: "1. Block",
  blocks: [{ title: "Block", explanation: "Exp", questions: [] }],
});
assert(rsvpMd.includes("# Study Session"), "T14 fail: RSVP still uses classic export");
assert(!rsvpMd.includes("# Slow Mode Session"), "T14: RSVP not routed to slow export");

// ═══════════════════════════════════════════════════════════════
section("Integration — round-trip persistence");
// ═══════════════════════════════════════════════════════════════
localStorage.clear();
const roundTrip = makeSlowSession({
  annotations: [{ id: "r1", type: "→", charStart: 0, charEnd: 3, userText: "start" }],
});
roundTrip.slow.maxReadCharEnd = 42;
roundTrip.slow.currentPageIndex = 2;
storeSessionForMode("slow", roundTrip);
const loaded = loadSessionForMode("slow");
assert(loaded?.slow?.maxReadCharEnd === 42, "Integration: maxReadCharEnd survives persist");
assert(loaded?.slow?.annotations?.[0]?.userText === "start", "Integration: annotations survive persist");
assert(loaded?.slow?.currentPageIndex === 2, "Integration: page index survives persist");

// ═══════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`20260528_validate-intense: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailed assertions:");
  for (const f of failures) console.log(`  • ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
