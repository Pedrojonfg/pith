import test from "node:test";
import assert from "node:assert/strict";
import {
  MS_PER_DAY,
  SM2_DEFAULTS,
  buildReviewQueue,
  createSmItem,
  getQueueStats,
  isOnTime,
  normalizeSmItem,
  updateSmItem,
} from "../../src/js/sm2.js";

const NOW = 1_700_000_000_000;

const base = (o = {}) => ({
  id: "item-1",
  sourceType: "rsvp_block",
  sourceId: "block-1",
  docId: "doc-1",
  title: "Test item",
  contentPreview: "",
  interval: SM2_DEFAULTS.interval,
  easeFactor: SM2_DEFAULTS.easeFactor,
  repetitions: SM2_DEFAULTS.repetitions,
  scheduledDue: NOW,
  lastReviewed: null,
  observations: [],
  createdAt: NOW,
  reviewProvenance: "document",
  ...o,
});

test("createSmItem builds canonical item with defaults", () => {
  const item = createSmItem({
    id: "c1",
    sourceType: "cloze_item",
    sourceId: "cloze-42",
    docId: "doc-abc",
    title: "  Cloze title  ",
    createdAt: NOW,
    scheduledDue: NOW,
  });
  assert.equal(item.title, "Cloze title");
  assert.equal(item.interval, 1);
  assert.equal(item.easeFactor, 2.5);
  assert.equal(item.repetitions, 0);
  assert.equal(item.lastReviewed, null);
  assert.deepEqual(item.observations, []);
});

test("createSmItem rejects invalid sourceType and missing ids", () => {
  assert.throws(() => createSmItem({ sourceType: "nope", sourceId: "a", docId: "b" }), /valid sourceType/);
  assert.throws(() => createSmItem({ sourceType: "rsvp_block", sourceId: "", docId: "b" }), /sourceId and docId/);
});

test("normalizeSmItem maps legacy fields and clamps ease factor", () => {
  const item = normalizeSmItem({
    sourceMode: "cloze",
    sourceId: "c",
    docId: "d",
    nextReview: NOW + 5000,
    reviewCount: 2,
    easeFactor: 1.2,
  });
  assert.equal(item.sourceType, "cloze_item");
  assert.equal(item.scheduledDue, NOW + 5000);
  assert.equal(item.repetitions, 2);
  assert.equal(item.easeFactor, 1.3);
  assert.equal(normalizeSmItem(null), null);
  assert.equal(normalizeSmItem({}), null);
});

test("isOnTime: first review on-time, far-early review is not", () => {
  assert.equal(isOnTime(base(), NOW), true);
  const early = base({ lastReviewed: NOW - MS_PER_DAY, interval: 10, scheduledDue: NOW + 7 * MS_PER_DAY });
  assert.equal(isOnTime(early, NOW), false);
});

test("updateSmItem: early review logs observation, keeps schedule", () => {
  const before = base({
    lastReviewed: NOW - MS_PER_DAY,
    interval: 10,
    repetitions: 2,
    scheduledDue: NOW + 7 * MS_PER_DAY,
  });
  const after = updateSmItem(before, 4, NOW);
  assert.equal(after.interval, 10);
  assert.equal(after.repetitions, 2);
  assert.equal(after.scheduledDue, before.scheduledDue);
  assert.equal(after.observations[0].wasEarly, true);
  assert.equal(after.observations[0].daysEarly, 7);
});

test("updateSmItem: on-time pass sequence 1 -> 6 -> interval*EF", () => {
  const first = updateSmItem(base(), 4, NOW);
  assert.deepEqual([first.repetitions, first.interval], [1, 1]);
  assert.equal(first.scheduledDue, NOW + MS_PER_DAY);

  const second = updateSmItem(
    base({ lastReviewed: NOW - MS_PER_DAY, repetitions: 1, interval: 1 }),
    5,
    NOW,
  );
  assert.deepEqual([second.repetitions, second.interval, second.easeFactor], [2, 6, 2.6]);

  const third = updateSmItem(
    base({ lastReviewed: NOW - MS_PER_DAY, repetitions: 2, interval: 6, easeFactor: 2.6 }),
    4,
    NOW,
  );
  assert.deepEqual([third.repetitions, third.interval], [3, 16]);
});

test("updateSmItem: failing on-time review resets; EF floor 1.3; quality clamped", () => {
  const failed = updateSmItem(
    base({ lastReviewed: NOW - MS_PER_DAY, repetitions: 3, interval: 16, easeFactor: 2.6 }),
    2,
    NOW,
  );
  assert.deepEqual([failed.repetitions, failed.interval], [0, 1]);

  const floor = updateSmItem(base({ lastReviewed: NOW - MS_PER_DAY, easeFactor: 1.3 }), 0, NOW);
  assert.equal(floor.easeFactor, 1.3);

  assert.equal(updateSmItem(base(), 9, NOW).observations[0].quality, 5);
  assert.equal(updateSmItem(base(), -2, NOW).observations[0].quality, 0);
});

test("buildReviewQueue sorts by due date and caps gap_fill items", () => {
  const mk = (id, due, extra = {}) => ({ sourceType: "rsvp_block", sourceId: id, docId: "d1", scheduledDue: due, id, ...extra });
  const sorted = buildReviewQueue([mk("a", NOW + 3), mk("b", NOW + 1), mk("c", NOW + 2)], NOW, {
    applySessionCap: false,
  });
  assert.deepEqual(sorted.map((i) => i.id), ["b", "c", "a"]);

  const items = Array.from({ length: 5 }, (_, i) => mk(`gf-${i}`, NOW + i, { reviewProvenance: "gap_fill" }));
  items.push(mk("doc", NOW + 10, { reviewProvenance: "document" }));
  const capped = buildReviewQueue(items, NOW, { maxGapFillPerSession: 3 });
  assert.equal(capped.filter((i) => i.reviewProvenance === "gap_fill").length, 3);
  assert.ok(capped.some((i) => i.id === "doc"));
});

test("getQueueStats counts dueNow, dueToday, total", () => {
  const mk = (id, due) => ({ sourceType: "rsvp_block", sourceId: id, docId: "d1", scheduledDue: due, id });
  const stats = getQueueStats(
    [mk("a", NOW - 1), mk("b", NOW + MS_PER_DAY - 1), mk("c", NOW + 2 * MS_PER_DAY)],
    NOW,
  );
  assert.deepEqual(stats, { dueNow: 1, dueToday: 2, total: 3 });
});
