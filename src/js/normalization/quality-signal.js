/**
 * Discrete document-quality tiers for normalization (R4).
 * Placeholder thresholds — calibrate post-launch.
 */

/** @typedef {"good"|"degraded"|"poor"} QualityTier */

/**
 * @typedef {{
 *   code: string,
 *   measured: string,
 *   threshold: string,
 *   actual: string|number|boolean,
 * }} QualityReasonDetail
 */

/**
 * @param {{
 *   extractionConfidence?: "high"|"medium"|"low",
 *   totalPages?: number,
 *   lowExtractionPageCount?: number,
 *   lowExtractionPagesAfterVision?: number[]|null,
 *   tablesDetected?: number,
 *   tablesEmittedOk?: number,
 *   headingsFallbackUsed?: boolean,
 *   charCount?: number,
 * }} inputs
 * @returns {{ tier: QualityTier, reasons: string[], reasonDetails: QualityReasonDetail[] }}
 */
export function computeDocumentQualitySignal(inputs = {}) {
  const extractionConfidence = inputs.extractionConfidence || "low";
  const totalPages = Math.max(0, Number(inputs.totalPages) || 0);
  const lowExtractionPageCount = Math.max(0, Number(inputs.lowExtractionPageCount) || 0);
  const lowAfterVision = Array.isArray(inputs.lowExtractionPagesAfterVision)
    ? inputs.lowExtractionPagesAfterVision
    : null;
  const lowCount = lowAfterVision ? lowAfterVision.length : lowExtractionPageCount;
  const tablesDetected = Math.max(0, Number(inputs.tablesDetected) || 0);
  const tablesEmittedOk = Math.max(0, Number(inputs.tablesEmittedOk) || 0);
  const headingsFallbackUsed = Boolean(inputs.headingsFallbackUsed);
  const charCount = Math.max(0, Number(inputs.charCount) || 0);

  /** @type {string[]} */
  const reasons = [];
  /** @type {QualityReasonDetail[]} */
  const reasonDetails = [];

  const addReason = (code, measured, threshold, actual) => {
    reasons.push(code);
    reasonDetails.push({ code, measured, threshold, actual });
  };

  if (totalPages >= 2 && lowCount > totalPages * 0.5) {
    addReason(
      "majority_low_extraction_pages",
      "lowExtractionPageCount",
      "> 50% of totalPages",
      { lowCount, totalPages, ratio: totalPages > 0 ? lowCount / totalPages : 0 },
    );
  }
  if (totalPages >= 3 && charCount < 500) {
    addReason(
      "very_low_char_count",
      "charCount",
      ">= 500 when totalPages >= 3",
      { charCount, totalPages },
    );
  }
  if (
    extractionConfidence === "low" &&
    headingsFallbackUsed &&
    charCount < 2000
  ) {
    addReason(
      "low_confidence_with_heading_fallback",
      "extractionConfidence + headingsFallbackUsed + charCount",
      "confidence=low AND heading fallback AND charCount < 2000",
      { extractionConfidence, headingsFallbackUsed, charCount },
    );
  }

  if (
    reasons.includes("majority_low_extraction_pages") ||
    reasons.includes("very_low_char_count")
  ) {
    return { tier: "poor", reasons, reasonDetails };
  }

  if (tablesDetected > 0 && tablesEmittedOk === 0) {
    addReason(
      "tables_not_emitted",
      "tablesEmittedOk",
      "> 0 when tablesDetected > 0",
      { tablesDetected, tablesEmittedOk },
    );
  }
  if (headingsFallbackUsed) {
    addReason(
      "heading_fallback",
      "headingsFallbackUsed",
      "false",
      headingsFallbackUsed,
    );
  }
  if (lowCount > 0) {
    addReason(
      "some_low_extraction_pages",
      "lowExtractionPageCount",
      "0",
      { lowCount, totalPages },
    );
  }
  if (extractionConfidence === "low") {
    addReason(
      "low_extraction_confidence",
      "extractionConfidence",
      "high or medium",
      extractionConfidence,
    );
  }

  if (reasons.length > 0) {
    return { tier: "degraded", reasons, reasonDetails };
  }

  return { tier: "good", reasons: [], reasonDetails: [] };
}
