/**
 * Phase A — conceptGraph edges with source_id/target_id (DPP T1.3 shape).
 * @see specs/20260711-adaptive-prepacking-activation/
 */
import assert from "node:assert/strict";
import { buildProbeGraph } from "../src/js/adaptive-probing/probe-graph.js";
import { deriveInventoryEdges } from "../src/js/assessment-coverage.js";

function edgeKeySet(edges) {
  return new Set((edges || []).map((e) => `${e.from}\u2192${e.to}`));
}

function graphShape(graph) {
  return {
    nodes: [...graph.nodes].sort(),
    edges: [...edgeKeySet(graph.edges)].sort(),
    cyclesBroken: graph.meta.cyclesBroken,
    warningWeights: graph.warnings.map((w) => w.edge_weight).sort((a, b) => a - b),
  };
}

function testSourceIdParityWithFromTo() {
  const inventory = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ];
  const legacy = {
    edges: [
      { from: "a", to: "b", type: "PREREQUISITE", weight: 0.9 },
      { from: "b", to: "c", type: "PREREQUISITE", weight: 0.2 },
      { from: "c", to: "a", type: "PREREQUISITE", weight: 0.5 },
    ],
  };
  const dpp = {
    edges: [
      { source_id: "a", target_id: "b", type: "PREREQUISITE", weight: 0.9 },
      { source_id: "b", target_id: "c", type: "PREREQUISITE", weight: 0.2 },
      { source_id: "c", target_id: "a", type: "PREREQUISITE", weight: 0.5 },
    ],
  };
  const fromLegacy = buildProbeGraph({ conceptInventory: inventory, conceptGraph: legacy });
  const fromDpp = buildProbeGraph({ conceptInventory: inventory, conceptGraph: dpp });
  assert.deepEqual(graphShape(fromDpp), graphShape(fromLegacy));
}

function testDeriveInventoryEdgesAcceptsSourceId() {
  const inventory = [{ id: "x" }, { id: "y" }];
  const edges = deriveInventoryEdges(inventory, {
    edges: [{ source_id: "x", target_id: "y", type: "prerequisite" }],
  });
  assert.equal(edges.length, 1);
  assert.equal(edges[0].from, "x");
  assert.equal(edges[0].to, "y");
}

function testDppMidSizeFixtureNonEmptyDag() {
  const inventory = [];
  for (let i = 1; i <= 12; i += 1) {
    inventory.push({ id: `c${i}`, label: `Concept ${i}` });
  }
  // Realistic DPP-ish chain + branches (prerequisite edges only).
  const conceptGraph = {
    nodes: inventory.map((c) => ({ id: c.id, label: c.label })),
    edges: [
      { source_id: "c1", target_id: "c2", type: "prerequisite", weight: 1 },
      { source_id: "c1", target_id: "c3", type: "prerequisite", weight: 1 },
      { source_id: "c2", target_id: "c4", type: "prerequisite", weight: 0.9 },
      { source_id: "c3", target_id: "c5", type: "prerequisite", weight: 0.9 },
      { source_id: "c4", target_id: "c6", type: "prerequisite", weight: 0.8 },
      { source_id: "c5", target_id: "c6", type: "prerequisite", weight: 0.8 },
      { source_id: "c6", target_id: "c7", type: "prerequisite", weight: 1 },
      { source_id: "c7", target_id: "c8", type: "prerequisite", weight: 1 },
      { source_id: "c8", target_id: "c9", type: "prerequisite", weight: 1 },
      { source_id: "c9", target_id: "c10", type: "prerequisite", weight: 1 },
      { source_id: "c3", target_id: "c11", type: "prerequisite", weight: 0.7 },
      { source_id: "c11", target_id: "c12", type: "prerequisite", weight: 0.7 },
      // Non-prerequisite should be ignored by probe graph
      { source_id: "c1", target_id: "c12", type: "related", weight: 0.5 },
    ],
  };
  const graph = buildProbeGraph({ conceptInventory: inventory, conceptGraph });
  assert.equal(graph.nodes.length, 12);
  assert.ok(graph.edges.length >= 8, `expected non-trivial DAG, got ${graph.edges.length} edges`);
  assert.equal(graph.propagationEnabled, true);
  assert.ok(graph.meta.edgeCount >= 8);
}

function main() {
  testSourceIdParityWithFromTo();
  testDeriveInventoryEdgesAcceptsSourceId();
  testDppMidSizeFixtureNonEmptyDag();
  console.log("20260711_probe-graph-source-id.mjs: OK");
}

main();
