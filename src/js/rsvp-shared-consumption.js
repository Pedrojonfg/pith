/**
 * RSVP Tier-3 consumption of Tier-1 shared artifacts (20260620-rsvp-shared-consumption).
 */
import {
  resolvePreparedRsvpInventory,
  shouldSkipRsvpInventoryLlm,
} from "./session-types.js";
import {
  getBlockSplitCache,
  isBlockSplitCacheValid,
  setBlockSplitCache,
} from "./block-split-cache.js";

export { resolvePreparedRsvpInventory, shouldSkipRsvpInventoryLlm };

/**
 * @param {import('./session-store.js').DocumentSession | null | undefined} doc
 * @param {{ fingerprint: object, recommendation?: object | null }} params
 * @returns {object[] | null}
 */
export function seedBlockSplitCacheFromShared(doc, { fingerprint, recommendation = null } = {}) {
  const inventory = resolvePreparedRsvpInventory(doc);
  if (!inventory || !fingerprint) return null;
  const rec =
    recommendation ??
    doc?.shared?.blockRecommendation?.signals ??
    doc?.shared?.blockRecommendation ??
    getBlockSplitCache()?.recommendation ??
    null;
  setBlockSplitCache({ fingerprint, conceptInventory: inventory, recommendation: rec });
  return inventory;
}

/**
 * @param {import('./session-store.js').DocumentSession | null | undefined} doc
 * @param {{ fingerprint: object }} params
 * @returns {{ inventory: object[], source: 'shared' | 'cache' } | null}
 */
export function resolveRsvpInventoryForPack(doc, { fingerprint } = {}) {
  const prepared = resolvePreparedRsvpInventory(doc);
  if (prepared && fingerprint) {
    seedBlockSplitCacheFromShared(doc, { fingerprint });
    return { inventory: prepared, source: "shared" };
  }
  const cache = getBlockSplitCache();
  if (isBlockSplitCacheValid(cache, fingerprint)) {
    return { inventory: cache.conceptInventory, source: "cache" };
  }
  return null;
}
