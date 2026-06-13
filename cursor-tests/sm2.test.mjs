/**
 * SM-2 core unit tests — contract sm2-core.md
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/sm2.test.mjs
 */
import {
  MS_PER_DAY,
  THRESHOLD_RATIO,
  buildReviewQueue,
  createSmItem,
  getQueueStats,
  isOnTime,
  normalizeSmItem,
  updateSmItem,
} from "../src/js/sm2.js";

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

const BASE = {
  sourceType: "rsvp_block",
  sourceId: "block-1",
  docId: "doc-abc",
  title: "Test block",
  contentPreview: "preview",
};

function makeItem(overrides = {}) {
  return createSmItem({ ...BASE, ...overrides });
}

// 1. First review always on-time
{
  const item = makeItem({ lastReviewed: null });
  assert(isOnTime(item, Date.now()) === true, "first review is on-time");
}

// 2. Early review does not change interval
{
  const now = 1_000_000;
  const item = makeItem({
    interval: 10,
    scheduledDue: now + 10 * MS_PER_DAY,
    lastReviewed: now - 5 * MS_PER_DAY,
  });
  assert(isOnTime(item, now + MS_PER_DAY) === false, "mid-interval review is early");
  const updated = updateSmItem(item, 5, now + MS_PER_DAY);
  assert(updated.interval === item.interval, "early review preserves interval");
  assert(updated.repetitions === item.repetitions, "early review preserves repetitions");
  assert(updated.scheduledDue === item.scheduledDue, "early review preserves scheduledDue");
}

// 3. On-time q>=3 increases interval
{
  const now = 2_000_000;
  const item = makeItem({
    interval: 1,
    repetitions: 1,
    scheduledDue: now,
    lastReviewed: now - MS_PER_DAY,
  });
  assert(isOnTime(item, now) === true, "at scheduledDue is on-time");
  const updated = updateSmItem(item, 4, now);
  assert(updated.interval > item.interval, "on-time good answer grows interval");
  assert(updated.repetitions > item.repetitions, "on-time good answer increments repetitions");
}

// 4. On-time q<3 resets to interval 1
{
  const now = 3_000_000;
  const item = makeItem({
    interval: 12,
    repetitions: 4,
    scheduledDue: now,
    lastReviewed: now - 12 * MS_PER_DAY,
  });
  const updated = updateSmItem(item, 1, now);
  assert(updated.interval === 1, "fail resets interval to 1");
  assert(updated.repetitions === 0, "fail resets repetitions");
}

// 5. Queue sorts by scheduledDue
{
  const a = makeItem({ sourceId: "a", scheduledDue: 300 });
  const b = makeItem({ sourceId: "b", scheduledDue: 100 });
  const c = makeItem({ sourceId: "c", scheduledDue: 200 });
  const queue = buildReviewQueue([a, b, c]);
  assert(queue[0].sourceId === "b" && queue[1].sourceId === "c" && queue[2].sourceId === "a", "queue sorted asc");
}

// 6. Ease factor floor 1.3
{
  const now = 4_000_000;
  const item = makeItem({
    easeFactor: 1.35,
    interval: 1,
    repetitions: 0,
    scheduledDue: now,
    lastReviewed: null,
  });
  const updated = updateSmItem(item, 0, now);
  assert(updated.easeFactor >= 1.3, "ease factor never below 1.3");
}

// 7. Observation always recorded (early included)
{
  const now = 5_000_000;
  const item = makeItem({
    interval: 6,
    scheduledDue: now + 6 * MS_PER_DAY,
    lastReviewed: now,
    observations: [],
  });
  const early = updateSmItem(item, 5, now + MS_PER_DAY);
  assert(early.observations.length === 1, "early attempt records observation");
  assert(early.observations[0].wasEarly === true, "observation flags early");

  const onTimeItem = makeItem({ scheduledDue: now + 10 * MS_PER_DAY, lastReviewed: null });
  const onTime = updateSmItem(onTimeItem, 4, now + 10 * MS_PER_DAY);
  assert(onTime.observations.length === 1, "on-time attempt records observation");
  assert(onTime.observations[0].wasEarly === false, "observation flags on-time");
}

// 8. normalizeSmItem maps nextReview → scheduledDue
{
  const legacy = {
    id: "cloze:item-1",
    sourceMode: "cloze",
    question: "What is X?",
    answer: "Y",
    nextReview: 42_000,
    reviewCount: 2,
    easeFactor: 2.5,
    interval: 3,
  };
  const norm = normalizeSmItem(legacy);
  assert(norm !== null, "legacy item normalizes");
  assert(norm.scheduledDue === 42_000, "nextReview → scheduledDue");
  assert(norm.sourceType === "cloze_item", "sourceMode cloze → cloze_item");
  assert(norm.repetitions === 2, "reviewCount → repetitions");
  assert(norm.title === "What is X?", "question → title");
}

// getQueueStats sanity
{
  const now = 10_000;
  const stats = getQueueStats(
    [
      makeItem({ sourceId: "due", scheduledDue: now - 1 }),
      makeItem({ sourceId: "later", scheduledDue: now + 2 * MS_PER_DAY }),
    ],
    now,
  );
  assert(stats.dueNow === 1, "dueNow counts overdue");
  assert(stats.dueToday === 1, "dueToday counts within 24h window");
  assert(stats.total === 2, "total count");
}

// 9. normalizeSmItem rejects unrecoverable (failure)
{
  assert(normalizeSmItem(null) === null, "normalize null → null");
  assert(normalizeSmItem({ id: "x" }) === null, "normalize missing sourceType → null");
}

// 10. upsert dedup by (sourceType, sourceId) — contract via session-store in integration

console.log(`sm2.test.mjs: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
