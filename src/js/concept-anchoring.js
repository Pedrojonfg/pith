/**
 * Per-concept source anchor computation during DPP (R3/R4).
 * @see specs/20260703-semantic-concept-anchoring
 */

import { snapToSentenceBoundary } from "./text-boundaries.js";
import {
  findDeterministicAnchorForConcept,
  proportionalAnchorForConcept,
  DEFAULT_CONCEPT_TARGET_WORDS,
} from "./chunk-alignment.js";
import { getChunksFromHierarchy } from "./normalization/hierarchy.js";
import { geminiEmbedContent } from "./llm.js?v=20260625_02";
import { getEmbeddingOutputDimensionality, isSemanticAnchoringEnabled } from "./config/flags.js";
import { cosineSimilarity } from "./vault/embedding-math.js";
import { logLlmUsage } from "./llm-usage-log.js";

/** Calibratable — minimum cosine similarity for embedding section match (R4). */
export const SEMANTIC_ANCHOR_SIMILARITY_FLOOR = 0.35;

/**
 * @param {string} text
 * @param {{ docId?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<number[]|null>}
 */
async function embedConceptAnchorEphemeral(text, opts = {}) {
  const sourceText = String(text || "").trim();
  if (!sourceText) return null;
  try {
    const json = await geminiEmbedContent(
      {
        model: "models/gemini-embedding-001",
        content: { parts: [{ text: sourceText }] },
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: getEmbeddingOutputDimensionality(),
      },
      { signal: opts.signal },
    );
    void logLlmUsage({
      docId: opts.docId || null,
      phase: "concept_anchor_embedding",
      model: "gemini-embedding-001",
      meta: { callType: "concept_anchor_embedding" },
    });
    const values = json?.embedding?.values;
    return Array.isArray(values) && values.length ? values : null;
  } catch (err) {
    console.warn("[concept-anchoring] ephemeral embed failed:", err?.message || err);
    return null;
  }
}

/**
 * @param {object} concept
 * @returns {string}
 */
export function buildConceptAnchorEmbedText(concept) {
  const parts = [
    String(concept?.title || concept?.label || "").trim(),
    String(concept?.definition || concept?.scope_one_line || "").trim(),
    String(concept?.source_phrase || "").trim(),
  ].filter(Boolean);
  return parts.join(" ").trim();
}

/**
 * @param {object} doc
 * @param {object} ctx
 * @returns {Promise<{ anchored: number, failed: boolean }>}
 */
export async function computeConceptAnchorsForDocument(doc, ctx = {}) {
  const inventory = Array.isArray(doc?.shared?.conceptInventory) ? doc.shared.conceptInventory : [];
  const materialText = String(doc?.shared?.rawMarkdown || "").trim();
  const semanticEnabled = isSemanticAnchoringEnabled();
  // [debug-enrich]
  console.info("[concept-anchoring.computeConceptAnchorsForDocument] Start:", {
    docId: doc?.docId || null,
    inventorySize: inventory.length,
    materialLen: materialText.length,
    semanticEnabled,
    hasHierarchy: Boolean(doc?.shared?.docHierarchy?.tree),
  });
  if (!inventory.length || !materialText) {
    // [debug-enrich]
    console.warn("[concept-anchoring.computeConceptAnchorsForDocument] Skip — empty inventory or text");
    return { anchored: 0, failed: false };
  }

  const docHierarchy = doc.shared?.docHierarchy;
  /** @type {Map<string, number[]>} */
  const sectionEmbeddingCache = new Map();
  let sectionEmbedCalls = 0;
  let anchored = 0;
  let failedConcepts = 0;
  const qualityCounts = { strong: 0, weak: 0, semantic: 0, proportional_fallback: 0 };

  const sections = getChunksFromHierarchy(docHierarchy?.tree, materialText);
  // [debug-enrich]
  console.debug("[concept-anchoring.computeConceptAnchorsForDocument] Sections:", {
    sectionCount: Array.isArray(sections) ? sections.length : 0,
  });
  const embedOpts = { docId: doc.docId, signal: ctx.signal };

  const getSectionEmbedding = async (section) => {
    const key = `${section.startOffset}:${section.endOffset}`;
    if (sectionEmbeddingCache.has(key)) return sectionEmbeddingCache.get(key);
    const text = String(section.text || materialText.slice(section.startOffset, section.endOffset)).trim();
    if (!text) return null;
    const vec = await embedConceptAnchorEphemeral(text.slice(0, 8000), embedOpts);
    sectionEmbedCalls += 1;
    if (vec) sectionEmbeddingCache.set(key, vec);
    return vec;
  };

  for (let i = 0; i < inventory.length; i += 1) {
    const concept = inventory[i];
    if (!concept || typeof concept !== "object") continue;

    try {
      let result = findDeterministicAnchorForConcept(concept, materialText, {
        targetWords: DEFAULT_CONCEPT_TARGET_WORDS,
        conceptOrder: concept.order,
        inventoryLength: inventory.length,
      });

      if (result.quality === "strong" || result.quality === "weak") {
        if (result.range) {
          const charStart = snapToSentenceBoundary(materialText, result.range.charStart, "start");
          const charEnd = snapToSentenceBoundary(materialText, result.range.charEnd, "end");
          concept.anchorRange = { charStart, charEnd };
          concept.anchorQuality = result.quality;
          concept.anchorMethod = "term_match";
          concept.anchorMatchedTerms = result.matchedTerms || [];
          anchored += 1;
          qualityCounts[result.quality] = (qualityCounts[result.quality] || 0) + 1;
        }
        continue;
      }

      if (semanticEnabled && (!result.quality || result.quality === "proportional_fallback")) {
        const conceptText = buildConceptAnchorEmbedText(concept);
        const conceptVec = conceptText ? await embedConceptAnchorEphemeral(conceptText, embedOpts) : null;
        if (conceptVec) {
          let bestSim = -1;
          /** @type {typeof sections[0]|null} */
          let bestSection = null;
          for (const section of sections) {
            const secVec = await getSectionEmbedding(section);
            if (!secVec) continue;
            const sim = cosineSimilarity(conceptVec, secVec);
            if (sim > bestSim) {
              bestSim = sim;
              bestSection = section;
            }
          }
          if (bestSection && bestSim >= SEMANTIC_ANCHOR_SIMILARITY_FLOOR) {
            const sectionText = materialText.slice(bestSection.startOffset, bestSection.endOffset);
            const narrow = findDeterministicAnchorForConcept(concept, sectionText, {
              targetWords: DEFAULT_CONCEPT_TARGET_WORDS,
              textOffset: bestSection.startOffset,
            });
            let charStart = bestSection.startOffset;
            let charEnd = bestSection.endOffset;
            if (narrow.range && (narrow.quality === "strong" || narrow.quality === "weak")) {
              charStart = narrow.range.charStart;
              charEnd = narrow.range.charEnd;
            }
            charStart = snapToSentenceBoundary(materialText, charStart, "start");
            charEnd = snapToSentenceBoundary(materialText, charEnd, "end");
            concept.anchorRange = { charStart, charEnd };
            concept.anchorQuality = "semantic";
            concept.anchorMethod = "embedding";
            concept.anchorMatchedTerms = narrow.matchedTerms || [];
            anchored += 1;
            qualityCounts.semantic += 1;
            continue;
          }
        }
      }

      const prop = proportionalAnchorForConcept(concept, inventory, materialText, {
        targetWords: DEFAULT_CONCEPT_TARGET_WORDS,
      });
      if (prop.range) {
        const charStart = snapToSentenceBoundary(materialText, prop.range.charStart, "start");
        const charEnd = snapToSentenceBoundary(materialText, prop.range.charEnd, "end");
        concept.anchorRange = { charStart, charEnd };
        concept.anchorQuality = "proportional_fallback";
        concept.anchorMethod = "proportional";
        anchored += 1;
        qualityCounts.proportional_fallback += 1;
      }
    } catch (err) {
      failedConcepts += 1;
      // [debug-enrich]
      console.warn("[concept-anchoring.computeConceptAnchorsForDocument] Concept failed:", {
        conceptId: concept?.id || null,
        message: err?.message || err,
      });
      concept.anchorRange = concept.anchorRange ?? null;
      concept.anchorQuality = concept.anchorQuality ?? null;
      concept.anchorMethod = concept.anchorMethod ?? null;
    }
  }

  // [debug-enrich]
  console.info("[concept-anchoring.computeConceptAnchorsForDocument] Done:", {
    docId: doc?.docId || null,
    anchored,
    failedConcepts,
    sectionEmbedCalls,
    qualityCounts,
    note: "DPP phase T1.2b",
  });
  return { anchored, failed: false };
}

/** Test helper — expose section embed call pattern. */
export function __sectionEmbeddingCacheSize(cache) {
  return cache instanceof Map ? cache.size : 0;
}
