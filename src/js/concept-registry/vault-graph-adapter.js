/**
 * Vault graph adapter — nodes/edges for global concept registry view.
 * @see specs/20260626-cross-doc-vault/contracts/vault-graph.md
 */

import { getAllConcepts, getConceptById } from "./registry-store.js";
import { getConnectionsForGraph } from "./connection-store.js";
import { getSession, getAllSessions, loadProjectStore } from "../session-store.js";
import { getSessionsByProject } from "../project-store.js";

/**
 * @param {object} params
 */
export async function buildVaultGraph({ focusedDocId = null, projectId = null } = {}) {
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  const projectDocIds = normalizeProjectDocIds(await resolveProjectDocIds(projectId));
  let concepts = getAllConcepts();
  if (projectDocIds) {
    concepts = concepts.filter((c) =>
      (c.sourceDocIds || []).some((d) => projectDocIds.has(d)),
    );
  }

  for (const concept of concepts) {
    nodes.push({
      id: concept.id,
      label: concept.canonicalName,
      maturity: concept.maturity,
      mastery: concept.mastery,
      scope: "global",
    });
    nodeIds.add(concept.id);
  }

  if (focusedDocId) {
    const session = await getSession(focusedDocId);
    for (const entry of session?.shared?.conceptInventory || []) {
      if (entry.globalConceptId && nodeIds.has(entry.globalConceptId)) continue;
      const localId = `local:${focusedDocId}:${String(entry.canonicalId || entry.id || "").trim()}`;
      if (!localId.endsWith(":")) {
        nodes.push({
          id: localId,
          label: String(entry.label || entry.name || entry.canonicalId || "Concept").trim(),
          maturity: "gray",
          scope: "local",
        });
        nodeIds.add(localId);
      }
    }
  }

  addRegistryConnectionEdges(edges, nodeIds, projectDocIds, concepts);
  addCoOccurrenceEdges(edges, concepts, focusedDocId, projectDocIds, nodeIds);
  addExplicitLinkEdges(edges, concepts, nodeIds);

  return { nodes, edges };
}

/** @param {Set<string>|Iterable<string>|null|undefined} value */
function normalizeProjectDocIds(value) {
  if (value == null) return null;
  return value instanceof Set ? value : new Set(value ?? []);
}

async function resolveProjectDocIds(projectId) {
  const pid = String(projectId || "").trim();
  if (!pid || pid === "all") return null;
  const store = loadProjectStore();
  const sessions = getSessionsByProject(store, await getAllSessions(), pid, {
    includeDescendants: true,
  });
  return new Set(sessions.map((s) => String(s.docId || "").trim()).filter(Boolean));
}

function addRegistryConnectionEdges(edges, nodeIds, projectDocIds, concepts) {
  const conceptSet =
    projectDocIds == null
      ? null
      : new Set(
          (Array.isArray(concepts) ? concepts : [])
            .map((c) => c.id)
            .filter(Boolean),
        );
  const connections = getConnectionsForGraph();
  for (const conn of connections) {
    const source = conn.sourceId;
    const target = conn.targetId;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    if (conceptSet && (!conceptSet.has(source) || !conceptSet.has(target))) continue;
    edges.push({
      source,
      target,
      type: String(conn.type || "ASSOCIATED").toLowerCase(),
      weight: conn.weight,
      registryConnection: true,
    });
  }
}

async function addCoOccurrenceEdges(edges, concepts, focusedDocId, projectDocIds, nodeIds) {
  const registryPairs = new Set(
    edges
      .filter((e) => e.registryConnection)
      .map((e) => `${e.source}|${e.target}`),
  );
  const sessions = (await getAllSessions()).filter((s) => {
    if (projectDocIds && !projectDocIds.has(s.docId)) return false;
    if (focusedDocId && s.docId !== focusedDocId) return false;
    return true;
  });

  for (const session of sessions) {
    const inventory = session?.shared?.conceptInventory || [];
    const globalIds = inventory
      .map((e) => e.globalConceptId || null)
      .filter(Boolean);
    const localIds = inventory.map(
      (e) =>
        e.globalConceptId ||
        `local:${session.docId}:${String(e.canonicalId || e.id || "").trim()}`,
    );

    for (let i = 0; i < localIds.length; i++) {
      for (let j = i + 1; j < localIds.length; j++) {
        if (!localIds[i] || !localIds[j]) continue;
        const pairKey = `${localIds[i]}|${localIds[j]}`;
        const pairKeyRev = `${localIds[j]}|${localIds[i]}`;
        if (registryPairs.has(pairKey) || registryPairs.has(pairKeyRev)) continue;
        if (!nodeIds.has(localIds[i]) || !nodeIds.has(localIds[j])) continue;
        edges.push({
          source: localIds[i],
          target: localIds[j],
          type: "co_occurrence",
          weight: 1,
        });
      }
    }
    void globalIds;
  }
  void concepts;
}

function addExplicitLinkEdges(edges, concepts, nodeIds) {
  for (const concept of concepts) {
    const blocks = concept.content?.blocks || [];
    for (const block of blocks) {
      if (block.supersededBy) continue;
      for (const other of concepts) {
        if (other.id === concept.id) continue;
        const slug = other.slug;
        const name = other.canonicalName.toLowerCase();
        const text = String(block.text || "").toLowerCase();
        if (
          (slug && text.includes(slug.replace(/-/g, " "))) ||
          (name && text.includes(name))
        ) {
          if (nodeIds.has(concept.id) && nodeIds.has(other.id)) {
            edges.push({
              source: concept.id,
              target: other.id,
              type: "explicit_link",
              weight: 1,
            });
          }
        }
      }
    }
  }
}

/**
 * @param {string} conceptId
 */
export function getConceptPageData(conceptId) {
  const concept = getConceptById(conceptId);
  if (!concept) return null;
  const blocks = concept.content?.blocks || [];
  const activeBlocks = blocks.filter((b) => !b.supersededBy);
  const historyBlocks = blocks.filter((b) => b.supersededBy);
  return { concept, activeBlocks, historyBlocks };
}

