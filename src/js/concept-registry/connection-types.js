/**
 * Registry connection relationship types (v1).
 * @see specs/20260620-typed-weighted-connections/data-model.md
 */

export const CONNECTION_TYPES = Object.freeze({
  PREREQUISITE: "PREREQUISITE",
  CONTRADICTS: "CONTRADICTS",
  EXEMPLIFIES: "EXEMPLIFIES",
  PART_OF: "PART_OF",
  ASSOCIATED: "ASSOCIATED",
  INFLUENCED: "INFLUENCED",
});

const VALID_TYPES = new Set(Object.values(CONNECTION_TYPES));

const EPISTEMIC_TO_REGISTRY = Object.freeze({
  prerequisite_of: CONNECTION_TYPES.PREREQUISITE,
  prerequisite: CONNECTION_TYPES.PREREQUISITE,
  PREREQUISITE: CONNECTION_TYPES.PREREQUISITE,
  contradicts: CONNECTION_TYPES.CONTRADICTS,
  CONTRADICTS: CONNECTION_TYPES.CONTRADICTS,
  exemplifies: CONNECTION_TYPES.EXEMPLIFIES,
  is_a: CONNECTION_TYPES.EXEMPLIFIES,
  defines: CONNECTION_TYPES.EXEMPLIFIES,
  EXEMPLIFIES: CONNECTION_TYPES.EXEMPLIFIES,
  part_of: CONNECTION_TYPES.PART_OF,
  PART_OF: CONNECTION_TYPES.PART_OF,
  ASSOCIATED: CONNECTION_TYPES.ASSOCIATED,
  influenced: CONNECTION_TYPES.INFLUENCED,
  INFLUENCED: CONNECTION_TYPES.INFLUENCED,
});

/**
 * @param {string} [epistemicType]
 * @param {string} [registryType]
 * @returns {string}
 */
export function mapEpistemicTypeToRegistry(epistemicType, registryType) {
  const reg = String(registryType || "").trim();
  if (reg && VALID_TYPES.has(reg)) return reg;
  const key = String(epistemicType || "").trim().toLowerCase();
  if (EPISTEMIC_TO_REGISTRY[key]) return EPISTEMIC_TO_REGISTRY[key];
  if (EPISTEMIC_TO_REGISTRY[epistemicType]) return EPISTEMIC_TO_REGISTRY[epistemicType];
  return CONNECTION_TYPES.ASSOCIATED;
}

/**
 * @param {string} [raw]
 * @returns {string}
 */
export function coerceRegistryConnectionType(raw) {
  const t = String(raw || "").trim().toUpperCase();
  return VALID_TYPES.has(t) ? t : CONNECTION_TYPES.ASSOCIATED;
}

export const CONNECTION_INITIAL_WEIGHT = 0.3;
export const CONNECTION_WEIGHT_FLOOR = 0.05;
export const CONNECTION_WEIGHT_MAX = 1.0;

function clampWeight(w) {
  const v = Number(w);
  if (!Number.isFinite(v)) return CONNECTION_INITIAL_WEIGHT;
  return Math.max(CONNECTION_WEIGHT_FLOOR, Math.min(CONNECTION_WEIGHT_MAX, v));
}

function connectionKey(sourceId, targetId) {
  return `${String(sourceId || "").trim()}|${String(targetId || "").trim()}`;
}

/**
 * @param {object} [raw]
 */
export function normalizeConnection(raw) {
  const sourceId = String(raw?.sourceId || raw?.source || raw?.from || "").trim();
  const targetId = String(raw?.targetId || raw?.target || raw?.to || "").trim();
  const type = coerceRegistryConnectionType(raw?.type);
  const weight = clampWeight(
    raw?.weight != null ? raw.weight : CONNECTION_INITIAL_WEIGHT,
  );
  const evidenceRaw = raw?.evidence && typeof raw.evidence === "object" ? raw.evidence : {};
  const reinforcedCount = Number.isFinite(evidenceRaw.reinforcedCount)
    ? Math.max(0, evidenceRaw.reinforcedCount)
    : 0;
  const lastReinforcedAt =
    evidenceRaw.lastReinforcedAt == null
      ? null
      : Number.isFinite(evidenceRaw.lastReinforcedAt)
        ? evidenceRaw.lastReinforcedAt
        : null;
  const createdAt = Number.isFinite(evidenceRaw.createdAt)
    ? evidenceRaw.createdAt
    : Number.isFinite(raw?.createdAt)
      ? raw.createdAt
      : Date.now();

  return {
    sourceId,
    targetId,
    type,
    weight,
    evidence: {
      reinforcedCount,
      lastReinforcedAt,
      createdAt,
    },
  };
}

/**
 * @param {object} registry
 */
export function normalizeConnections(registry) {
  const list = Array.isArray(registry?.connections)
    ? registry.connections
    : Array.isArray(registry)
      ? registry
      : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const c = normalizeConnection(raw);
    if (!c.sourceId || !c.targetId || c.sourceId === c.targetId) continue;
    const key = connectionKey(c.sourceId, c.targetId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
