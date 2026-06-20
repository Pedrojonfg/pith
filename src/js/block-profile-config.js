/**
 * Pre-packing knowledge profile → block _config mapping (20260620-rsvp-generation-pedagogy-hardening R1).
 */

/**
 * @param {object} blockIndexEntry
 * @returns {{ gap_focus: object[], explanation_profile: string|null }}
 */
export function mapKnowledgeProfileToBlockConfig(blockIndexEntry) {
  const entry = blockIndexEntry && typeof blockIndexEntry === "object" ? blockIndexEntry : {};
  const learning_goal = String(entry.learning_goal || "").trim();
  const concept_ids = Array.isArray(entry.concept_ids)
    ? entry.concept_ids.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  if (!learning_goal) {
    return { gap_focus: [], explanation_profile: null };
  }
  const gap_focus = concept_ids.map((concept_id) => ({
    concept_id,
    reason: learning_goal,
    label: concept_id,
  }));
  if (learning_goal === "prerequisite_review") {
    return { gap_focus, explanation_profile: "brief_deep" };
  }
  if (learning_goal === "relational") {
    return { gap_focus, explanation_profile: "relational_compressed" };
  }
  return { gap_focus: [], explanation_profile: null };
}

/** @param {object[]} blockIndex */
export function applyKnowledgeProfileToBlockIndex(blockIndex) {
  if (!Array.isArray(blockIndex)) return blockIndex;
  return blockIndex.map((entry) => {
    const mapped = mapKnowledgeProfileToBlockConfig(entry);
    if (!mapped.explanation_profile && (!mapped.gap_focus || mapped.gap_focus.length === 0)) {
      return entry;
    }
    return {
      ...entry,
      _initial_block_config: {
        gap_focus: mapped.gap_focus,
        explanation_profile: mapped.explanation_profile || "thorough",
      },
    };
  });
}
