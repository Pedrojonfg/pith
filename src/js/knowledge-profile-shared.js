/**
 * Shared-layer knowledge profile (20260702-shared-pre-mode-assessment).
 * @see specs/20260702-shared-pre-mode-assessment/data-model.md
 */

/**
 * @param {unknown} raw
 * @returns {Record<string, { mastery: string, confidence: number }>}
 */
export function buildPerConceptFromPackProfile(raw) {
  /** @type {Record<string, { mastery: string, confidence: number }>} */
  const perConcept = {};
  if (!raw || typeof raw !== "object") return perConcept;

  const items = Array.isArray(raw.items) ? raw.items : [];
  for (const row of items) {
    const id = String(row?.concept_id || "").trim();
    if (!id) continue;
    perConcept[id] = {
      mastery: String(row?.mastery || "none"),
      confidence: Number(row?.confidence) || 0,
    };
  }

  const byConceptId = raw.byConceptId && typeof raw.byConceptId === "object" ? raw.byConceptId : null;
  if (byConceptId) {
    for (const [id, entry] of Object.entries(byConceptId)) {
      if (!entry?.assessed) continue;
      perConcept[id] = {
        mastery: entry.correct ? "full" : "none",
        confidence: entry.correct ? 0.85 : 0.2,
      };
    }
  }
  return perConcept;
}

/**
 * @param {object | null} packProfile
 * @param {{ source?: string | null }} [options]
 * @returns {object | null}
 */
export function buildSharedKnowledgeProfile(packProfile, options = {}) {
  if (!packProfile || typeof packProfile !== "object") return null;
  const perConcept = buildPerConceptFromPackProfile(packProfile);
  const hasItems = Array.isArray(packProfile.items) && packProfile.items.length > 0;
  if (!Object.keys(perConcept).length && !hasItems) {
    return null;
  }
  return {
    computedAt: Date.now(),
    source: options.source === "assessment" ? "assessment" : null,
    perConcept,
    packProfile,
  };
}

/**
 * Profile shape for packInventoryToBlocks / getMasteryWeight.
 * @param {object | null | undefined} session
 * @returns {object | null}
 */
export function resolvePackKnowledgeProfile(session) {
  const shared = session?.shared;
  const kp = shared?.knowledgeProfile;
  if (kp?.packProfile && typeof kp.packProfile === "object") {
    return kp.packProfile;
  }
  if (kp?.perConcept && typeof kp.perConcept === "object") {
    const byConceptId = {};
    for (const [id, row] of Object.entries(kp.perConcept)) {
      const mastery = String(row?.mastery || "none");
      byConceptId[id] = {
        assessed: true,
        correct: mastery === "full",
      };
    }
    return {
      byConceptId,
      items: Object.entries(kp.perConcept).map(([concept_id, row]) => ({
        concept_id,
        mastery: row.mastery,
        confidence: row.confidence,
      })),
    };
  }
  const legacy = session?._meta?.knowledge_profile;
  return legacy && typeof legacy === "object" ? legacy : null;
}

/**
 * @param {object} doc
 */
export function migrateKnowledgeProfileToShared(doc) {
  if (!doc?.shared) return doc;
  if (doc.shared.knowledgeProfile != null) return doc;
  const legacy = doc._meta?.knowledge_profile;
  if (!legacy || typeof legacy !== "object") return doc;
  doc.shared.knowledgeProfile = buildSharedKnowledgeProfile(legacy, { source: "assessment" });
  return doc;
}

/**
 * @param {object} doc
 * @param {object | null} packProfile
 * @param {"accepted"|"skipped"} outcome
 */
export function persistSharedKnowledgeProfile(doc, packProfile, outcome) {
  if (!doc.shared) doc.shared = {};
  if (outcome === "skipped" || !packProfile) {
    doc.shared.knowledgeProfile = null;
  } else {
    doc.shared.knowledgeProfile = buildSharedKnowledgeProfile(packProfile, { source: "assessment" });
  }
  doc.shared.assessmentGate = {
    resolvedAt: Date.now(),
    outcome,
  };
  if (doc._meta?.knowledge_profile) {
    delete doc._meta.knowledge_profile;
  }
  return doc;
}

/** @param {object} doc */
export function isAssessmentGateResolved(doc) {
  const gate = doc?.shared?.assessmentGate;
  return Boolean(gate?.resolvedAt && (gate.outcome === "accepted" || gate.outcome === "skipped"));
}

/**
 * Reset learner-progress fields for assessment redo (§5 table).
 * @param {object} doc
 */
export function resetSessionForAssessmentRedo(doc) {
  if (!doc?.shared) return doc;
  doc.shared.knowledgeProfile = null;
  doc.shared.modeRecommendation = null;
  doc.shared.assessmentGate = null;
  doc.shared.annotations = [];
  doc.shared.smItems = [];
  doc.shared.assessmentSignals = [];
  doc.modes = {};
  if (doc._meta) {
    delete doc._meta.knowledge_profile;
    delete doc._meta.assessment_skipped;
    delete doc._meta.packing_ignored_profile;
  }
  const prep = doc.shared.preparation;
  if (prep && typeof prep === "object") {
    prep.status = "ready";
    if (prep.phaseResults?.["T1.5"]) {
      delete prep.phaseResults["T1.5"];
    }
  }
  return doc;
}

/**
 * Mastery ratio for recommender (0–1).
 * @param {object | null | undefined} knowledgeProfile
 */
export function computeMasteryRatio(knowledgeProfile) {
  const per = knowledgeProfile?.perConcept;
  if (!per || typeof per !== "object") return 0;
  const entries = Object.values(per);
  if (!entries.length) return 0;
  const full = entries.filter((e) => e?.mastery === "full").length;
  return full / entries.length;
}
