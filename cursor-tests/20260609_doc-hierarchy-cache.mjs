/**
 * T03 — hierarchy-cache.js localStorage TTL + LRU
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_doc-hierarchy-cache.mjs
 */
import assert from "node:assert/strict";
import { resetStorage } from "./setup-dom.mjs";
import {
  _internals,
  getCachedHierarchy,
  hashText,
  setCachedHierarchy,
} from "../src/js/normalization/hierarchy-cache.js";

const { CACHE_PREFIX, INDEX_KEY, TTL_MS, MAX_ENTRIES } = _internals;

const SAMPLE_TREE = [
  {
    title: "Intro",
    level: 1,
    startOffset: 0,
    endOffset: 100,
    children: [],
  },
];

function entryKey(hash) {
  return `${CACHE_PREFIX}${hash}`;
}

function testHashTextStable() {
  const text = "# Title\n\nBody paragraph.";
  assert.equal(hashText(text), hashText(text));
  assert.notEqual(hashText(text), hashText(text + " "));
  assert.match(hashText(text), /^[0-9a-f]+$/);
}

function testHashTextEdgeEmpty() {
  assert.equal(hashText(""), hashText(""));
  assert.equal(hashText(null), hashText(undefined));
}

function testCacheMiss() {
  resetStorage();
  const hash = hashText("missing doc");
  assert.equal(getCachedHierarchy(hash), null);
  assert.equal(localStorage.getItem(entryKey(hash)), null);
}

function testCacheHit() {
  resetStorage();
  const hash = hashText("cached doc");
  setCachedHierarchy(hash, { tree: SAMPLE_TREE, method: "llm" });

  const hit = getCachedHierarchy(hash);
  assert.deepEqual(hit, { tree: SAMPLE_TREE, method: "llm" });

  const raw = JSON.parse(localStorage.getItem(entryKey(hash)));
  assert.equal(typeof raw.cachedAt, "number");
  assert.ok(raw.cachedAt <= Date.now());
}

function testCacheHitTouchesLru() {
  resetStorage();
  const hashes = Array.from({ length: MAX_ENTRIES }, (_, i) =>
    hashText(`doc-${i}`),
  );
  for (const h of hashes) {
    setCachedHierarchy(h, { tree: SAMPLE_TREE, method: "deterministic" });
  }

  const touched = hashes[0];
  const evicted = hashes[1];
  getCachedHierarchy(touched);

  setCachedHierarchy(hashText("overflow-new"), {
    tree: SAMPLE_TREE,
    method: "trivial",
  });

  assert.notEqual(
    localStorage.getItem(entryKey(touched)),
    null,
    "recently touched entry should survive LRU eviction",
  );
  assert.equal(
    localStorage.getItem(entryKey(evicted)),
    null,
    "untouched LRU tail should be evicted",
  );
}

function testCacheExpired() {
  resetStorage();
  const hash = hashText("expired doc");
  const now = 1_700_000_000_000;
  const realNow = Date.now;
  Date.now = () => now;

  try {
    setCachedHierarchy(hash, { tree: SAMPLE_TREE, method: "llm" });
    Date.now = () => now + TTL_MS + 1;
    assert.equal(getCachedHierarchy(hash), null);
    assert.equal(localStorage.getItem(entryKey(hash)), null);
    const index = JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    assert.ok(!index.includes(hash));
  } finally {
    Date.now = realNow;
  }
}

function testLruEvictsOldest() {
  resetStorage();
  const hashes = [];
  for (let i = 0; i < MAX_ENTRIES + 1; i++) {
    const h = hashText(`lru-doc-${i}`);
    hashes.push(h);
    setCachedHierarchy(h, { tree: SAMPLE_TREE, method: "llm" });
  }

  const index = JSON.parse(localStorage.getItem(INDEX_KEY));
  assert.equal(index.length, MAX_ENTRIES);
  assert.equal(localStorage.getItem(entryKey(hashes[0])), null);
  assert.notEqual(localStorage.getItem(entryKey(hashes[MAX_ENTRIES])), null);
}

function testCorruptEntryTreatedAsMiss() {
  resetStorage();
  const hash = hashText("corrupt");
  localStorage.setItem(entryKey(hash), "{not json");
  localStorage.setItem(INDEX_KEY, JSON.stringify([hash]));
  assert.equal(getCachedHierarchy(hash), null);
  assert.equal(localStorage.getItem(entryKey(hash)), null);
}

testHashTextStable();
testHashTextEdgeEmpty();
testCacheMiss();
testCacheHit();
testCacheHitTouchesLru();
testCacheExpired();
testLruEvictsOldest();
testCorruptEntryTreatedAsMiss();

console.log("20260609_doc-hierarchy-cache: all tests passed");
