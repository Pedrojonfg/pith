/**
 * T04 — editable Phase 0, fillable map, re-read rules
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t04-phase0-editing-fillable.mjs
 */
import {
  applyFillableMapMode,
  buildFillableBlanksFromMap,
  computePhase0SeenKey,
  fillBlankFromAnnotation,
  isPhase0Reread,
  loadPhase0Cache,
  markPhase0Seen,
  savePhase0Cache,
  slugGraphTermId,
  validatePhase0Orientation,
  LS_PHASE0_ORIENTATION_CACHE,
  LS_PHASE0_SEEN_KEYS,
} from "../src/js/slow/phase0.js";
import { matchConceptFindings } from "../src/js/slow/gamification.js";

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

const scope = { charStart: 10, charEnd: 500, label: "Section A" };
const keyA = computePhase0SeenKey("ethics.md", scope);
const keyB = computePhase0SeenKey("ethics.md", scope);
const keyOther = computePhase0SeenKey("ethics.md", { charStart: 10, charEnd: 501 });

assert(keyA === keyB, "T04 happy: seen key stable for same file+scope");
assert(keyA !== keyOther, "T04 edge: different scope range → different key");

localStorage.removeItem(LS_PHASE0_SEEN_KEYS);
localStorage.removeItem(LS_PHASE0_ORIENTATION_CACHE);
assert(!isPhase0Reread(keyA), "T04 happy: first read not marked reread");
markPhase0Seen(keyA);
assert(isPhase0Reread(keyA), "T04 happy: markPhase0Seen persists reread");

const orientation = {
  thesis: "La libertad requiere autodeterminación.",
  argumentMap: [
    { id: "P1", text: "Premisa uno", status: "argued" },
    { id: "C", text: "Conclusión", status: "argued" },
  ],
  conceptsToFind: [
    { term: "libertad", authorUsage: "capacidad de elección" },
    { term: "razón", authorUsage: "guía normativa" },
    { term: "voluntad", authorUsage: "facultad ejecutiva" },
  ],
  guideQuestion: "¿En qué sentido la razón limita la libertad?",
  prequestions: ["¿Qué asume el autor?"],
};

savePhase0Cache(keyA, orientation);
const cached = loadPhase0Cache(keyA);
assert(cached?.prequestions?.[0] === "¿Qué asume el autor?", "T04 happy: cache round-trips prequestions");
assert(loadPhase0Cache("") === null, "T04 fail: empty seen key returns null");

const blanks = buildFillableBlanksFromMap(orientation.argumentMap);
assert(blanks.length === 2 && blanks[0].nodeId === "P1" && blanks[0].userText === "", "T04 happy: blanks from map");

const fillable = applyFillableMapMode(orientation, true);
assert(fillable.fillableBlanks?.length === 2, "T04 happy: applyFillableMapMode adds blanks");

const session = {
  slow: {
    fillableMapMode: true,
    currentPageIndex: 2,
    phase0: {
      argumentMap: orientation.argumentMap,
      conceptsToFind: orientation.conceptsToFind,
      fillableBlanks: buildFillableBlanksFromMap(orientation.argumentMap),
    },
    findings: [],
  },
};

const filled = fillBlankFromAnnotation(
  session,
  { id: "ann1", userText: "P1: the author argues for rational choice" },
  2,
);
assert(filled?.nodeId === "P1" && filled.pageIndex === 2, "T04 happy: fill blank by node id in note");

const findingOff = { slow: { phase0: orientation, fillableMapMode: false, findings: [] } };
const f1 = matchConceptFindings(findingOff, { id: "f1", userText: "mentions libertad here" });
assert(f1?.revealedInPhase1 === false, "T04 happy: finding silent without fillable map");

const findingOn = { slow: { phase0: orientation, fillableMapMode: true, findings: [] } };
const f2 = matchConceptFindings(findingOn, { id: "f2", userText: "discusses libertad again" });
assert(f2?.revealedInPhase1 === true, "T04 happy: finding revealed in Phase 1 with fillable map");

const dup = matchConceptFindings(findingOn, { id: "f3", userText: "libertad otra vez" });
assert(dup === null && findingOn.slow.findings.length === 1, "T04 edge: duplicate concept not re-registered");

assert(slugGraphTermId("Free Will") === "free_will", "T04 happy: graphTermId slug");

const withBlanks = validatePhase0Orientation({
  ...orientation,
  fillableBlanks: [{ nodeId: "P1", userText: "filled", pageIndex: 1 }],
});
assert(withBlanks?.fillableBlanks?.[0]?.pageIndex === 1, "T04 happy: validate preserves fillableBlanks");

console.log(`\n20260606_t04-phase0-editing-fillable: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
