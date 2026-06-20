/**
 * Promote document epistemic graph edges to registry connections.
 * @see specs/20260620-typed-weighted-connections/contracts/registry-connection-store.md
 */

import { mapEpistemicTypeToRegistry } from "./connection-types.js";
import { upsertRegistryConnection } from "./connection-store.js";

/**
 * @param {object} doc
 * @param {object} [graphOverride]
 * @returns {number}
 */
export function promoteGraphConnectionsToRegistry(doc, graphOverride) {
  const graph = graphOverride || doc?.shared?.conceptGraph;
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!edges.length) return 0;

  const inventory = doc?.shared?.conceptInventory || [];
  const localToGlobal = new Map();
  for (const entry of inventory) {
    const localId = String(entry?.canonicalId || entry?.id || "").trim();
    const globalId = String(entry?.globalConceptId || "").trim();
    if (localId && globalId) localToGlobal.set(localId, globalId);
  }

  let promoted = 0;
  for (const edge of edges) {
    const fromLocal = String(
      edge?.source_id || edge?.sourceId || edge?.from || edge?.source || "",
    ).trim();
    const toLocal = String(
      edge?.target_id || edge?.targetId || edge?.to || edge?.target || "",
    ).trim();
    if (!fromLocal || !toLocal) continue;

    const sourceId = localToGlobal.get(fromLocal) || fromLocal;
    const targetId = localToGlobal.get(toLocal) || toLocal;
    const type = mapEpistemicTypeToRegistry(edge?.type, edge?.registry_type);
    const result = upsertRegistryConnection({ sourceId, targetId, type });
    if (result) promoted += 1;
  }
  return promoted;
}
