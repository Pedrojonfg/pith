/**
 * Apply interview synthesis results to session + assessment signals.
 * @see specs/20260620-nodoc-interview-capture/contracts/interview-capture-store.md
 */

import { mergeAssessmentSignals, computeAssessmentWeight } from "../assessment-signals.js";
import { inferDocMeta } from "../session-types.js";
import { synthesizeInterviewToMarkdown } from "./interview-api.js";

/**
 * @param {object[]} articulatedConceptIds
 * @param {object[]} concepts
 */
export function buildUnpromptedArticulationSignals(articulatedConceptIds, concepts) {
  const ids = new Set(
    (Array.isArray(articulatedConceptIds) ? articulatedConceptIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const now = Date.now();
  const signals = [];
  for (const c of Array.isArray(concepts) ? concepts : []) {
    const canonicalId = String(c?.canonicalId || "").trim();
    if (!canonicalId || !ids.has(canonicalId)) continue;
    signals.push({
      canonicalId,
      conceptLabel: String(c.label || canonicalId).trim(),
      blockIndex: null,
      sourceMode: "questions",
      signalOrigin: "unprompted_articulation",
      wrongCount: 0,
      correctCount: 1,
      lastResult: "correct",
      lastAt: now,
      weight: computeAssessmentWeight(0, 1, "correct"),
    });
  }
  return signals;
}

/**
 * @param {object} doc
 * @param {{ transcript: object[], studyLang: string, sessionTitle: string, llmModel?: string }} params
 */
export async function applyInterviewSynthesis(doc, params) {
  if (!doc?.shared) {
    // [debug-enrich]
    console.error("[interview.synthesis.applyInterviewSynthesis] Invalid session");
    throw new Error("Invalid session for synthesis.");
  }
  // [debug-enrich]
  console.info("[interview.synthesis.applyInterviewSynthesis] Start:", {
    docId: doc?.docId || null,
    sessionTitle: params?.sessionTitle ?? null,
    transcriptTurns: Array.isArray(params?.transcript) ? params.transcript.length : 0,
  });
  const result = await synthesizeInterviewToMarkdown(params);

  doc.shared.rawMarkdown = result.rawMarkdown;
  doc.shared.docMeta = {
    ...(doc.shared.docMeta || {}),
    ...inferDocMeta(result.rawMarkdown),
    titleInferred: String(params.sessionTitle || doc.shared.docMeta?.titleInferred || "").trim(),
  };
  doc.shared.conceptInventory = result.concepts;
  doc.shared.interviewSynthesisComplete = true;

  const incoming = buildUnpromptedArticulationSignals(
    result.articulatedConceptIds,
    result.concepts,
  );
  if (incoming.length) {
    const existing = Array.isArray(doc.shared.assessmentSignals) ? doc.shared.assessmentSignals : [];
    doc.shared.assessmentSignals = mergeAssessmentSignals(existing, incoming);
  }

  // [debug-enrich]
  console.info("[interview.synthesis.applyInterviewSynthesis] Done:", {
    docId: doc?.docId || null,
    conceptCount: result.concepts?.length ?? 0,
    articulatedCount: incoming.length,
    markdownLen: result.rawMarkdown?.length ?? 0,
  });
  return { doc, articulatedCount: incoming.length };
}
