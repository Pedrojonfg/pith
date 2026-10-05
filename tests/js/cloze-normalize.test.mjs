import test from "node:test";
import assert from "node:assert/strict";
import {
  RELATION_TYPE_LIST,
  parseModelJsonObject,
  normalizeEpistemicNode,
  normalizeEpistemicEdge,
  normalizeEpistemicGraph,
  normalizeSemanticAnalysis,
  normalizeClozeItem,
  getValidItems,
  mergeItemOptions,
} from "../../src/js/cloze/normalize.js";

const opts = (correct = 0) =>
  ["A", "B", "C", "D"].map((text, i) => ({ text, is_correct: i === correct }));
const rawItem = (o = {}) => ({
  id: "i1",
  item_type: "NODE-DEF",
  sentence_with_blank: "The _____ is key.",
  blank_text: "answer",
  options: opts(),
  ...o,
});

test("parseModelJsonObject strips code fences and rejects bad JSON", () => {
  assert.deepEqual(parseModelJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.equal(parseModelJsonObject("not json"), null);
  assert.equal(parseModelJsonObject(""), null);
});

test("normalizeEpistemicNode/Edge apply defaults and reject incomplete input", () => {
  const n = normalizeEpistemicNode({ title: " Entropy ", importance: 9 }, 0);
  assert.equal(n.id, "node_001");
  assert.equal(n.text, "Entropy");
  assert.equal(n.type, "CONCEPT");
  assert.equal(n.importance, 5);
  assert.equal(normalizeEpistemicNode({ id: "x" }), null);

  const e = normalizeEpistemicEdge({ source_id: "a", target_id: "b", type: "bogus" });
  assert.equal(e.type, "implies");
  assert.ok(RELATION_TYPE_LIST.includes("prerequisite_of"));
  assert.equal(normalizeEpistemicEdge({ source_id: "a" }), null);
});

test("normalizeEpistemicGraph returns null without nodes", () => {
  assert.equal(normalizeEpistemicGraph({ edges: [] }), null);
  const g = normalizeEpistemicGraph({ nodes: [{ id: "a", text: "A" }], edges: [{ source_id: "a", target_id: "b" }] });
  assert.equal(g.nodes.length, 1);
  assert.equal(g.edges.length, 1);
});

test("normalizeSemanticAnalysis drops node candidates with importance < 3", () => {
  const out = normalizeSemanticAnalysis({
    node_candidates: [
      { node_id: "hi", importance: 4 },
      { node_id: "lo", importance: 2 },
      { importance: 5 },
    ],
    edge_candidates: [{ edge_id: "e1", source_id: "a", target_id: "b" }],
  });
  assert.deepEqual(out.node_candidates.map((c) => c.node_id), ["hi"]);
  assert.equal(out.edge_candidates[0].relation_type, "implies");
});

test("normalizeClozeItem requires valid type, blank, and exactly one correct option", () => {
  assert.equal(normalizeClozeItem(rawItem({ item_type: "BAD" })), null);
  assert.equal(normalizeClozeItem(rawItem({ blank_text: "" })), null);
  const ok = normalizeClozeItem(rawItem());
  assert.equal(ok.options.length, 4);
  assert.equal(ok.options.filter((o) => o.is_correct).length, 1);
  assert.equal(ok.difficulty, "medium");
  assert.equal(ok.qa_status, "valid");
  const twoCorrect = normalizeClozeItem(rawItem({ options: opts().map((o) => ({ ...o, is_correct: true })) }));
  assert.equal(twoCorrect.options, null);
});

test("getValidItems keeps only valid items with four options", () => {
  const items = [rawItem(), rawItem({ id: "weak", qa_status: "weak" }), rawItem({ id: "noopts", options: [] })];
  assert.deepEqual(getValidItems(items).map((i) => i.id), ["i1"]);
});

test("mergeItemOptions needs 3 distractors and puts the blank text first as correct", () => {
  const item = rawItem({ options: undefined });
  assert.equal(mergeItemOptions(item, [{ text: "x" }, { text: "y" }]), null);
  const merged = mergeItemOptions(item, [{ text: "x" }, { text: "y" }, { text: "z" }, { text: "extra" }]);
  assert.equal(merged.options.length, 4);
  assert.equal(merged.options[0].text, "answer");
  assert.equal(merged.options[0].is_correct, true);
});
