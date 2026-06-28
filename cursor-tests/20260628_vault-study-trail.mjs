/**
 * Vault Study Trail — feature 20260628-vault-study-trail
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260628_vault-study-trail.mjs
 */
import {
  buildStudyTrailRows,
  formatStudyTrailRelativeTime,
  mapObservationToTrailRow,
  MAX_STUDY_TRAIL_EVENTS,
} from "../src/js/vault/study-trail.js";

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

const NOW = Date.parse("2026-06-28T12:00:00.000Z");

function MS_HOURS(n) {
  return n * 3_600_000;
}
function MS_DAYS(n) {
  return n * 86_400_000;
}

// --- Happy: map cloze correct ---

const clozeRow = mapObservationToTrailRow({
  type: "cloze_correct",
  timestamp: NOW - 120_000,
});
assert(clozeRow.modeLabel === "Cloze", "happy: cloze mode label");
assert(clozeRow.resultLabel === "Correct", "happy: cloze correct badge");
assert(
  formatStudyTrailRelativeTime(NOW - 120_000, NOW) === "2 minutes ago",
  "happy: relative time minutes",
);

// --- Happy: reverse chronological + cap ---

const observations = [];
for (let i = 0; i < 55; i += 1) {
  observations.push({
    type: i % 2 === 0 ? "review_correct" : "mcq_wrong",
    timestamp: NOW - i * 60_000,
  });
}
const built = buildStudyTrailRows(observations);
assert(built.rows.length === MAX_STUDY_TRAIL_EVENTS, "happy: caps at 50 rows");
assert(built.overflow === 5, "happy: overflow count");
assert(built.rows[0].type === "review_correct", "happy: newest first");

// --- Edge: relative time buckets ---

assert(formatStudyTrailRelativeTime(NOW - 30_000, NOW) === "just now", "edge: just now");
assert(formatStudyTrailRelativeTime(NOW - MS_HOURS(2), NOW) === "2 hours ago", "edge: hours");
assert(formatStudyTrailRelativeTime(NOW - MS_DAYS(1), NOW) === "yesterday", "edge: yesterday");
assert(formatStudyTrailRelativeTime(NOW - MS_DAYS(3), NOW) === "3 days ago", "edge: days");
assert(formatStudyTrailRelativeTime(NOW - MS_DAYS(14), NOW) === "2 weeks ago", "edge: weeks");

// --- Failure: unknown type ---

const unknown = mapObservationToTrailRow({ type: "mystery_signal", timestamp: 0 });
assert(unknown.resultLabel === "—", "failure: unknown result dash");
assert(formatStudyTrailRelativeTime(0) === "—", "failure: invalid timestamp");

// --- Empty trail ---

const empty = buildStudyTrailRows([]);
assert(empty.total === 0 && empty.rows.length === 0, "failure: empty observations");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
