/**
 * R4 — Contradiction detection via LLM for high-similarity pairs.
 */

import { DEFAULT_LLM_MODEL } from "../llm.js?v=20260622_10";
import { isVaultContradictionCheckEnabled, getMaxContradictionChecksPerDppRun } from "../config/flags.js";
import { isVaultEmbeddingsEnabled } from "./embeddings.js";
import { DEDUP_HARD_GATE_THRESHOLD } from "./embedding-thresholds.js";
import { upsertRegistryConnection } from "../concept-registry/connection-store.js";
import { CONNECTION_TYPES } from "../concept-registry/connection-types.js";
import { getConceptById } from "../concept-registry/registry-store.js";

const CLASSIFY_MAX_TOKENS = 120;

let checksThisRun = 0;

export function resetContradictionCheckBudget() {
  checksThisRun = 0;
}

/**
 * @param {object} conceptA
 * @param {object} conceptB
 * @param {{ llmModel?: string }} [options]
 * @returns {Promise<{ label: 'entailment'|'contradiction'|'neutral', confidence: number }>}
 */
export async function classifyConceptRelation(conceptA, conceptB, options = {}) {
  const nameA = String(conceptA?.canonicalName || conceptA?.label || "").trim();
  const nameB = String(conceptB?.canonicalName || conceptB?.label || "").trim();
  const defA = String(conceptA?.description || conceptA?.definition || "").trim();
  const defB = String(conceptB?.description || conceptB?.definition || "").trim();

  const { llmChatCompletions } = await import("../llm.js");
  const system = `You classify the relation between two learning concepts. Reply with JSON only: {"label":"entailment"|"contradiction"|"neutral","confidence":0.0-1.0}. entailment = same claim; contradiction = opposing claims; neutral = related but not same/opposite.`;
  const user = `Concept A: ${nameA}\n${defA ? `Definition A: ${defA}` : ""}\n\nConcept B: ${nameB}\n${defB ? `Definition B: ${defB}` : ""}`;

  const text = await llmChatCompletions({
    llmModel: options.llmModel || DEFAULT_LLM_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: CLASSIFY_MAX_TOKENS,
    temperature: 0.1,
  });
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { label: "neutral", confidence: 0.5 };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const label = ["entailment", "contradiction", "neutral"].includes(parsed.label)
      ? parsed.label
      : "neutral";
    const confidence = Number.isFinite(Number(parsed.confidence))
      ? Math.max(0, Math.min(1, Number(parsed.confidence)))
      : 0.5;
    return { label, confidence };
  } catch {
    return { label: "neutral", confidence: 0.5 };
  }
}

/**
 * @param {object} proposal
 * @param {{ llmModel?: string }} [options]
 */
export async function applyContradictionCheckToProposal(proposal, options = {}) {
  if (!isVaultContradictionCheckEnabled() || !isVaultEmbeddingsEnabled()) {
    return { ...proposal, contradictionLabel: null, vetoed: false };
  }
  if ((proposal.cosineScore ?? 0) < DEDUP_HARD_GATE_THRESHOLD) {
    return { ...proposal, contradictionLabel: null, vetoed: false };
  }

  const cap = getMaxContradictionChecksPerDppRun();
  if (checksThisRun >= cap) {
    return { ...proposal, contradictionLabel: "neutral", vetoed: false, capped: true };
  }
  checksThisRun += 1;

  const conceptA = getConceptById(proposal.sourceConceptId);
  const conceptB = getConceptById(proposal.targetConceptId);
  if (!conceptA || !conceptB) return { ...proposal, vetoed: false };

  const result = await classifyConceptRelation(conceptA, conceptB, options);

  if (result.label === "contradiction") {
    upsertRegistryConnection({
      sourceId: proposal.sourceConceptId,
      targetId: proposal.targetConceptId,
      type: CONNECTION_TYPES.CONTRADICTS,
    });
    return { ...proposal, contradictionLabel: result.label, vetoed: true };
  }

  const confidence =
    result.label === "entailment" ? "high" : result.label === "neutral" ? "low" : proposal.confidence;

  return {
    ...proposal,
    contradictionLabel: result.label,
    confidence,
    vetoed: false,
  };
}

/**
 * @param {object[]} proposals
 */
export async function filterProposalsWithContradictionCheck(proposals, options = {}) {
  const out = [];
  for (const p of proposals || []) {
    const checked = await applyContradictionCheckToProposal(p, options);
    if (!checked.vetoed) out.push(checked);
  }
  return out;
}
