/**
 * Discrete document-quality tiers for normalization (R4).
 * Placeholder thresholds — calibrate post-launch.
 */

/** @typedef {"good"|"degraded"|"poor"} QualityTier */

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
 * @returns {{ tier: QualityTier, reasons: string[] }}
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

  if (totalPages >= 2 && lowCount > totalPages * 0.5) {
    reasons.push("majority_low_extraction_pages");
  }
  if (totalPages >= 3 && charCount < 500) {
    reasons.push("very_low_char_count");
  }
  if (
    extractionConfidence === "low" &&
    headingsFallbackUsed &&
    charCount < 2000
  ) {
    reasons.push("low_confidence_with_heading_fallback");
  }

  if (
    reasons.includes("majority_low_extraction_pages") ||
    reasons.includes("very_low_char_count")
  ) {
    return { tier: "poor", reasons };
  }

  if (tablesDetected > 0 && tablesEmittedOk === 0) {
    reasons.push("tables_not_emitted");
  }
  if (headingsFallbackUsed) reasons.push("heading_fallback");
  if (lowCount > 0) reasons.push("some_low_extraction_pages");
  if (extractionConfidence === "low") reasons.push("low_extraction_confidence");

  if (reasons.length > 0) {
    return { tier: "degraded", reasons };
  }

  return { tier: "good", reasons: [] };
}
