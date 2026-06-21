/**
 * Canonical block question answer signal routing (RSVP + Questions).
 * @see specs/20260621-rsvp-embedded-assessment/contracts/block-answer-signals.md
 */

import { syncAssessmentSignalsToShared } from "./session-store.js";
import { mapMcqOutcomeToQuality, registerOrUpdateSmItem, confirmComprehensionForConcepts } from "./sm2-ingest.js";
import { promoteFromMcqBlock, promoteFromSocraticBlock } from "./concept-registry/ingest.js";
import { normalizeStudyMode } from "./session.js";

/** Engagement quality after successful socratic tutor feedback (no new LLM). */
const SOCRATIC_ENGAGEMENT_QUALITY = 4;

function resolveBlockConceptIds(block) {
  if (Array.isArray(block?.concept_ids) && block.concept_ids.length) {
    return block.concept_ids.map((id) => String(id || "").trim()).filter(Boolean);
  }
  if (Array.isArray(block?.concepts) && block.concepts.length) {
    return block.concepts
      .map((c) => String(c?.canonicalId || c?.id || c?.label || c).trim())
      .filter(Boolean);
  }
  return [];
}

function resolveBlockId(block, blockIndex) {
  return String(block?.block_id ?? block?.id ?? blockIndex).trim();
}

function resolveBlockTitle(block, blockIndex) {
  const title = String(block?.title || "").trim();
  return title || `Block ${Number(blockIndex) + 1}`;
}

/**
 * @param {object} params
 * @param {string} params.docId
 * @param {object} params.slice
 * @param {string} params.sourceMode
 * @param {number} params.blockIndex
 * @param {object} params.block
 * @param {'test'|'socratic'} params.questionType
 * @param {number} params.questionIndex
 * @param {object} [params.mcqOutcome]
 * @param {string} [params.socraticAnswer]
 */
export async function finalizeBlockQuestionAnswer({
  docId,
  slice,
  sourceMode,
  blockIndex,
  block,
  questionType,
  questionIndex,
  mcqOutcome,
  socraticAnswer,
}) {
  const id = String(docId || "").trim();
  if (!id || !slice || typeof slice !== "object") return;

  const mode = normalizeStudyMode(sourceMode);
  if (mode !== "rsvp" && mode !== "questions") return;

  await syncAssessmentSignalsToShared(id, slice, mode);

  const safeBlock = block && typeof block === "object" ? block : {};
  const blockId = resolveBlockId(safeBlock, blockIndex);
  const conceptIds = resolveBlockConceptIds(safeBlock);
  const title = resolveBlockTitle(safeBlock, blockIndex);
  const preview = conceptIds.slice(0, 3).join(", ");
  const promotionSource = mode === "questions" ? "questions" : "rsvp";

  if (questionType === "test") {
    const outcome = mcqOutcome && typeof mcqOutcome === "object" ? mcqOutcome : { correct: false };
    const quality = mapMcqOutcomeToQuality(outcome);
    await registerOrUpdateSmItem(id, {
      sourceType: "rsvp_block",
      sourceId: blockId,
      title,
      contentPreview: preview,
      conceptIds,
      quality,
      reviewProvenance: "document",
    });
    await promoteFromMcqBlock({
      docId: id,
      conceptIds,
      correct: outcome.correct === true,
      firstTry: outcome.firstTry !== false,
      usedHint: outcome.usedHint === true,
      skipped: outcome.skipped === true,
      source: promotionSource,
    });
    return;
  }

  if (questionType === "socratic") {
    const qi = Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : 0;
    await confirmComprehensionForConcepts(id, conceptIds, "socratic", SOCRATIC_ENGAGEMENT_QUALITY);
    await registerOrUpdateSmItem(id, {
      sourceType: "rsvp_block",
      sourceId: `${blockId}:socratic:${qi}`,
      title,
      contentPreview: preview,
      conceptIds,
      quality: SOCRATIC_ENGAGEMENT_QUALITY,
      reviewProvenance: "document",
    });
    await promoteFromSocraticBlock({
      docId: id,
      conceptIds,
      quality: SOCRATIC_ENGAGEMENT_QUALITY,
      source: promotionSource,
      contentText: String(socraticAnswer || "").trim(),
    });
  }
}

export { SOCRATIC_ENGAGEMENT_QUALITY };
