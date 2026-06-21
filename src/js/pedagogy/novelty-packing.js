/**
 * Soft novelty/familiarity bias for deterministic block packing.
 * @see specs/20260701-pedagogical-principles/spec.md §8 R6
 */

import { getPedagogicalFlags, isNoveltyBiasedPackingEnabled } from "../config/flags.js";

/**
 * Blended familiarity: higher = more familiar (should mix with novel targets).
 * @param {object} concept
 * @param {Record<string, { belief?: number }>} [beliefState]
 */
export function computeConceptFamiliarity(concept, beliefState = null) {
  const flags = getPedagogicalFlags();
  const blendWeight = flags.NOVELTY_BLEND_WEIGHT;
  const conceptId = String(concept?.canonicalId || concept?.id || "").trim();

  const beliefs = beliefState?.beliefs || beliefState?.concepts || {};
  const beliefEntry = conceptId ? beliefs[conceptId] : null;
  const belief = Number.isFinite(beliefEntry?.belief)
    ? beliefEntry.belief
    : Number.isFinite(beliefEntry?.mastery)
      ? beliefEntry.mastery
      : null;

  const noveltyScore = Number.isFinite(concept?.noveltyScore) ? concept.noveltyScore : null;

  if (belief != null && noveltyScore != null) {
    return (1 - blendWeight) * belief + blendWeight * (1 - noveltyScore);
  }
  if (belief != null) return belief;
  if (noveltyScore != null) return 1 - noveltyScore;
  return null;
}

/**
 * Reorder concepts within each module bucket toward target novel/familiar ratio.
 * Identity when flag off or no signals.
 * @param {object[]} inventory
 * @param {object} [options]
 */
export function applyNoveltyPackingBias(inventory, options = {}) {
  const inv = Array.isArray(inventory) ? inventory.slice() : [];
  if (!isNoveltyBiasedPackingEnabled()) return inv;
  if (!inv.length) return inv;

  const flags = getPedagogicalFlags();
  const targetNovel = flags.TARGET_NOVELTY_RATIO;
  const beliefState = options.beliefState || null;

  const scored = inv.map((c, index) => ({
    concept: c,
    index,
    familiarity: computeConceptFamiliarity(c, beliefState),
  }));

  const withSignal = scored.filter((s) => s.familiarity != null);
  const withoutSignal = scored.filter((s) => s.familiarity == null);
  if (!withSignal.length) return inv;

  withSignal.sort((a, b) => (a.familiarity ?? 0) - (b.familiarity ?? 0));

  const novelCount = Math.max(1, Math.round(withSignal.length * targetNovel));
  const novel = withSignal.slice(0, novelCount);
  const familiar = withSignal.slice(novelCount);

  const interleaved = [];
  let ni = 0;
  let fi = 0;
  while (ni < novel.length || fi < familiar.length) {
    if (ni < novel.length) interleaved.push(novel[ni++]);
    if (fi < familiar.length) interleaved.push(familiar[fi++]);
  }

  const ordered = [
    ...interleaved.map((s) => s.concept),
    ...withoutSignal.sort((a, b) => a.index - b.index).map((s) => s.concept),
  ];
  return ordered;
}
