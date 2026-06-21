/**
 * Session-scoped pool rotation — no repeat until exhausted.
 * @see specs/20260702-factual-pools/contracts/factual-stem-pools.md
 */

/**
 * @param {{ usedByCategory?: Record<string, number[]> }} [sessionState]
 */
export function createStemRotator(sessionState = null) {
  const state = sessionState && typeof sessionState === "object" ? sessionState : {};
  if (!state.usedByCategory || typeof state.usedByCategory !== "object") {
    state.usedByCategory = {};
  }

  /**
   * @param {string[]} pool
   * @param {string} category
   */
  function selectFromPool(pool, category) {
    const list = Array.isArray(pool) ? pool : [];
    if (!list.length) return "";
    const key = String(category || "default");
    if (!Array.isArray(state.usedByCategory[key])) {
      state.usedByCategory[key] = [];
    }
    const used = state.usedByCategory[key];
    const available = list.map((_, i) => i).filter((i) => !used.includes(i));
    const pickIdx =
      available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : Math.floor(Math.random() * list.length);
    if (available.length > 0) used.push(pickIdx);
    return list[pickIdx];
  }

  return { selectFromPool, state };
}

/**
 * @param {object} session
 * @returns {{ usedByCategory: Record<string, number[]> }}
 */
export function ensureFactualStemRotationState(session) {
  if (!session._meta || typeof session._meta !== "object") session._meta = {};
  if (!session._meta.factualStemRotation || typeof session._meta.factualStemRotation !== "object") {
    session._meta.factualStemRotation = { usedByCategory: {} };
  }
  if (!session._meta.factualStemRotation.usedByCategory) {
    session._meta.factualStemRotation.usedByCategory = {};
  }
  return session._meta.factualStemRotation;
}
