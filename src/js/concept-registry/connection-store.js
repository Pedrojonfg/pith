/**
 * Registry-level typed/weighted concept connections.
 * @see specs/20260620-typed-weighted-connections/contracts/registry-connection-store.md
 */

import { CONNECTION_DECAY_DAYS } from "../config/flags.js";
import {
  CONNECTION_INITIAL_WEIGHT,
  CONNECTION_TYPES,
  CONNECTION_WEIGHT_FLOOR,
  CONNECTION_WEIGHT_MAX,
  coerceRegistryConnectionType,
  mapEpistemicTypeToRegistry,
  normalizeConnection,
  normalizeConnections,
} from "./connection-types.js";
import { getConceptById, loadRegistry, saveRegistry } from "./registry-store.js";

export const CONNECTION_REINFORCE_DELTA = 0.15;
export const CONNECTION_DECAY_DELTA = 0.1;

export {
  CONNECTION_INITIAL_WEIGHT,
  CONNECTION_TYPES,
  mapEpistemicTypeToRegistry,
  normalizeConnection,
  normalizeConnections,
} from "./connection-types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clampWeight(w) {
  const v = Number(w);
  if (!Number.isFinite(v)) return CONNECTION_INITIAL_WEIGHT;
  return Math.max(CONNECTION_WEIGHT_FLOOR, Math.min(CONNECTION_WEIGHT_MAX, v));
}

function connectionKey(sourceId, targetId) {
  return `${String(sourceId || "").trim()}|${String(targetId || "").trim()}`;
}

/**
 * Both endpoints must exist in registry with yellow+ maturity.
 */
export function bothEndpointsPromotable(sourceId, targetId) {
  const a = getConceptById(sourceId);
  const b = getConceptById(targetId);
  if (!a || !b) return false;
  const ok = (c) => c.maturity === "yellow" || c.maturity === "green";
  return ok(a) && ok(b);
}

/**
 * @param {object[]} connections
 * @param {number} [now]
 * @param {{ decayDays?: number }} [options]
 */
export function applyLazyDecayToConnections(connections, now = Date.now(), options = {}) {
  const decayDays =
    typeof options.decayDays === "number" && Number.isFinite(options.decayDays)
      ? options.decayDays
      : CONNECTION_DECAY_DAYS;
  const thresholdMs = decayDays * MS_PER_DAY;
  let changed = false;
  const out = (Array.isArray(connections) ? connections : []).map((raw) => {
    const c = normalizeConnection(raw);
    const last = c.evidence.lastReinforcedAt;
    if (last == null || !Number.isFinite(last)) return c;
    if (now - last < thresholdMs) return c;
    const nextWeight = clampWeight(c.weight - CONNECTION_DECAY_DELTA);
    if (nextWeight === c.weight) return c;
    changed = true;
    return {
      ...c,
      weight: nextWeight,
      evidence: {
        ...c.evidence,
        lastReinforcedAt: now,
      },
    };
  });
  return { connections: out, changed };
}

/**
 * @param {{ sourceId: string, targetId: string, type?: string }} params
 */
export function upsertRegistryConnection({ sourceId, targetId, type }) {
  const src = String(sourceId || "").trim();
  const tgt = String(targetId || "").trim();
  if (!src || !tgt || src === tgt) return null;
  if (!bothEndpointsPromotable(src, tgt)) return null;

  const registry = loadRegistry();
  const connections = normalizeConnections(registry);
  const key = connectionKey(src, tgt);
  const connType = coerceRegistryConnectionType(type);
  const idx = connections.findIndex((c) => connectionKey(c.sourceId, c.targetId) === key);
  const now = Date.now();

  if (idx >= 0) {
    const prev = connections[idx];
    connections[idx] = {
      ...prev,
      type: connType !== CONNECTION_TYPES.ASSOCIATED ? connType : prev.type,
    };
    registry.connections = connections;
    saveRegistry(registry);
    return connections[idx];
  }

  const created = normalizeConnection({
    sourceId: src,
    targetId: tgt,
    type: connType,
    weight: CONNECTION_INITIAL_WEIGHT,
    evidence: { reinforcedCount: 0, lastReinforcedAt: null, createdAt: now },
  });
  connections.push(created);
  registry.connections = connections;
  saveRegistry(registry);
  return created;
}

/**
 * @param {string[]} conceptIds
 * @param {number} [now]
 */
export function reinforceConnectionsForConcepts(conceptIds, now = Date.now()) {
  const ids = [...new Set((Array.isArray(conceptIds) ? conceptIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean))];
  if (ids.length < 2) return { updated: 0 };

  const registry = loadRegistry();
  let connections = normalizeConnections(registry);
  const idSet = new Set(ids);
  let updated = 0;

  connections = connections.map((c) => {
    if (!idSet.has(c.sourceId) || !idSet.has(c.targetId)) return c;
    const nextWeight = clampWeight(c.weight + CONNECTION_REINFORCE_DELTA);
    updated += 1;
    return {
      ...c,
      weight: nextWeight,
      evidence: {
        ...c.evidence,
        reinforcedCount: (c.evidence.reinforcedCount || 0) + 1,
        lastReinforcedAt: now,
      },
    };
  });

  if (updated > 0) {
    registry.connections = connections;
    saveRegistry(registry);
  }
  return { updated };
}

/**
 * Load connections with lazy decay applied and persisted when changed.
 */
export function getConnectionsForGraph() {
  const registry = loadRegistry();
  const normalized = normalizeConnections(registry);
  const { connections, changed } = applyLazyDecayToConnections(normalized);
  if (changed) {
    registry.connections = connections;
    saveRegistry(registry);
  }
  return connections;
}

/**
 * @param {string[]} conceptIds
 */
export function reinforceConnectionsFireAndForget(conceptIds) {
  Promise.resolve()
    .then(() => reinforceConnectionsForConcepts(conceptIds))
    .catch((err) => {
      console.warn("[connection-store] reinforce failed", err?.message || err);
    });
}
