import test from "node:test";
import assert from "node:assert/strict";
import {
  structuralBonus,
  finalImportance,
  orderInventoryByAffinity,
  repairPrerequisiteBlockOrder,
  resolvePackingEdges,
} from "../../src/js/concept-graph/packing.js";
import {
  STRUCTURAL_BONUS_SCALE,
  getEdgeAffinityWeight,
  getEdgeOrderingWeight,
} from "../../src/js/config/packing-weights.js";

test("edge weights: known types mapped, unmapped fall back to defaults", () => {
  assert.equal(getEdgeAffinityWeight("part_of"), 0.9);
  assert.equal(getEdgeOrderingWeight("prerequisite_of"), 1.0);
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(getEdgeAffinityWeight("made_up_type"), 0.1);
    assert.equal(getEdgeOrderingWeight("made_up_type"), 0);
  } finally {
    console.warn = warn;
  }
});

test("structuralBonus is affinity-only, scaled, and capped", () => {
  const edges = [
    { source_id: "a", target_id: "b", type: "prerequisite_of" },
    { source_id: "a", target_id: "c", type: "part_of" },
  ];
  const bonus = structuralBonus("a", edges);
  assert.ok(bonus > 0);
  assert.ok(bonus <= STRUCTURAL_BONUS_SCALE + 1e-9);
  assert.equal(finalImportance({ id: "a", importance: 3 }, edges), 3 + bonus);

  const many = Array.from({ length: 10 }, (_, i) => ({ source_id: "a", target_id: `x${i}`, type: "part_of" }));
  assert.equal(structuralBonus("a", many), STRUCTURAL_BONUS_SCALE);
  assert.equal(structuralBonus("", many), 0);
  assert.equal(structuralBonus("a", null), 0);
});

test("orderInventoryByAffinity keeps part_of pair adjacent and is deterministic", () => {
  const inv = [
    { id: "a", order: 1 },
    { id: "x", order: 2 },
    { id: "b", order: 3 },
  ];
  const edges = [{ source_id: "a", target_id: "b", type: "part_of" }];
  const ids = orderInventoryByAffinity(inv, edges).map((c) => c.id);
  assert.equal(Math.abs(ids.indexOf("a") - ids.indexOf("b")), 1);
  assert.deepEqual(orderInventoryByAffinity(inv, edges).map((c) => c.id), ids);
  // no strong edges -> unchanged order
  assert.deepEqual(orderInventoryByAffinity(inv, []).map((c) => c.id), ["a", "x", "b"]);
});

test("repairPrerequisiteBlockOrder moves prerequisite before dependent and renumbers", () => {
  const blocks = [
    { id: 1, title: "B", concept_ids: ["b"] },
    { id: 2, title: "A", concept_ids: ["a"] },
  ];
  const edges = [{ source_id: "a", target_id: "b", type: "prerequisite_of" }];
  const fixed = repairPrerequisiteBlockOrder(blocks, edges);
  assert.deepEqual(fixed.map((b) => b.concept_ids[0]), ["a", "b"]);
  assert.deepEqual(fixed.map((b) => b.id), [1, 2]);
});

test("repairPrerequisiteBlockOrder terminates on prerequisite cycles", () => {
  const blocks = [
    { id: 1, concept_ids: ["a"] },
    { id: 2, concept_ids: ["b"] },
  ];
  const edges = [
    { source_id: "a", target_id: "b", type: "prerequisite_of" },
    { source_id: "b", target_id: "a", type: "prerequisite_of" },
  ];
  assert.equal(repairPrerequisiteBlockOrder(blocks, edges).length, 2);
});

test("resolvePackingEdges prefers options, then conceptGraph, then doc", () => {
  const e1 = [{ type: "x" }];
  const e2 = [{ type: "y" }];
  assert.equal(resolvePackingEdges({ edges: e1 }), e1);
  assert.equal(resolvePackingEdges({ conceptGraph: { edges: e2 } }), e2);
  assert.deepEqual(resolvePackingEdges({}, () => ({ shared: { conceptGraph: { edges: e1 } } })), e1);
  assert.deepEqual(resolvePackingEdges({}, () => { throw new Error("boom"); }), []);
});
