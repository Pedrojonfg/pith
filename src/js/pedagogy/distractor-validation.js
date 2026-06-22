/**
 * Batched LLM validation for sourced factual distractors.
 * @see specs/20260702-factual-pools/contracts/distractor-validation.md
 */

import { DEFAULT_LLM_MODEL, llmChatCompletions } from "../llm.js";

/** ~80 tokens per item (fact + up to 6 candidates + verdict) */
export const DISTRACTOR_VALIDATION_MAX_TOKENS = 800;

const VALID_REJECT_REASONS = new Set(["ambiguous", "also_correct", "implausible"]);

function looksLikeTruncatedModelJson(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  const last = t.slice(-1);
  if (last !== "}" && last !== "]") return true;
  try {
    JSON.parse(t);
    return false;
  } catch {
    return t.includes("{") || t.includes("[");
  }
}

/**
 * @param {{ fact: string, candidateDistractors: string[] }[]} items
 */
export function buildValidationPrompt(items) {
  const payload = (Array.isArray(items) ? items : []).map((row) => ({
    fact: String(row?.fact || "").trim(),
    candidates: (Array.isArray(row?.candidateDistractors) ? row.candidateDistractors : [])
      .map((c) => String(c || "").trim())
      .filter(Boolean),
  }));
  return `You validate multiple-choice distractors for factual study questions.

For each item, approve candidates that are wrong but plausible tests of knowledge.
Reject a candidate if it is:
- ambiguous relative to the fact (reason: "ambiguous")
- technically also correct (reason: "also_correct")
- implausibly wrong — no real test of knowledge (reason: "implausible")

Return JSON only:
{"items":[{"fact":"...","approvedDistractors":["..."],"rejected":[{"candidate":"...","reason":"ambiguous|also_correct|implausible"}]}]}

Items:
${JSON.stringify(payload)}`;
}

/**
 * @param {string} text
 * @returns {{ items: object[] } | null}
 */
export function parseValidationBatchResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (looksLikeTruncatedModelJson(raw)) {
    const err = new Error("Validation response truncated");
    err.code = "TRUNCATED";
    throw err;
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    const err = new Error("Validation response is not JSON");
    err.code = "PARSE_ERROR";
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    const err = new Error("Validation JSON parse failed");
    err.code = "PARSE_ERROR";
    throw err;
  }
  if (!parsed || !Array.isArray(parsed.items)) {
    const err = new Error("Validation response missing items array");
    err.code = "SCHEMA_ERROR";
    throw err;
  }
  return parsed;
}

/**
 * @param {object[]} parsedItems
 * @param {{ fact: string, candidateDistractors: string[] }[]} inputItems
 */
export function normalizeValidationResults(parsedItems, inputItems) {
  const inputs = Array.isArray(inputItems) ? inputItems : [];
  const byFact = new Map();
  for (const row of Array.isArray(parsedItems) ? parsedItems : []) {
    const fact = String(row?.fact || "").trim();
    if (!fact) continue;
    const approved = (Array.isArray(row.approvedDistractors) ? row.approvedDistractors : [])
      .map((c) => String(c || "").trim())
      .filter(Boolean);
    const rejected = (Array.isArray(row.rejected) ? row.rejected : [])
      .map((r) => ({
        candidate: String(r?.candidate || "").trim(),
        reason: VALID_REJECT_REASONS.has(String(r?.reason || "").trim())
          ? String(r.reason).trim()
          : "ambiguous",
      }))
      .filter((r) => r.candidate);
    byFact.set(fact.toLowerCase(), { fact, approvedDistractors: approved, rejected });
  }

  return inputs.map((input) => {
    const fact = String(input?.fact || "").trim();
    const candidates = Array.isArray(input?.candidateDistractors)
      ? input.candidateDistractors.map((c) => String(c || "").trim()).filter(Boolean)
      : [];
    const hit = byFact.get(fact.toLowerCase());
    if (hit) return hit;
    return { fact, approvedDistractors: [...candidates], rejected: [] };
  });
}

/**
 * @param {{ fact: string, candidateDistractors: string[] }[]} items
 * @param {{
 *   llmModel?: string,
 *   callLlm?: (prompt: string) => Promise<string>,
 *   docId?: string|null,
 * }} [options]
 * @returns {Promise<{ results: object[], callCount: number }>}
 */
export async function validateDistractorBatch(items, options = {}) {
  const batch = (Array.isArray(items) ? items : []).filter(
    (row) => row && String(row.fact || "").trim() && Array.isArray(row.candidateDistractors),
  );
  if (!batch.length) {
    return { results: [], callCount: 0 };
  }

  const prompt = buildValidationPrompt(batch);
  const callLlm =
    typeof options.callLlm === "function"
      ? options.callLlm
      : async (userPrompt) => {
          const llmModel = options.llmModel || DEFAULT_LLM_MODEL;
          const content = await llmChatCompletions({
            llmModel,
            messages: [
              {
                role: "system",
                content:
                  "You validate factual MCQ distractors. Reply with JSON only matching the requested schema.",
              },
              { role: "user", content: userPrompt },
            ],
            max_tokens: Math.min(
              DISTRACTOR_VALIDATION_MAX_TOKENS,
              80 * batch.length + 120,
            ),
            temperature: 0.1,
          });
          try {
            const { logLlmUsage } = await import("../llm-usage-log.js");
            void logLlmUsage({
              docId: options.docId || null,
              phase: "distractor_validation",
              model: llmModel,
              meta: { itemCount: batch.length, generation_method: "template_validated" },
            });
          } catch {
            // logging optional in test/offline contexts
          }
          return content;
        };

  const raw = await callLlm(prompt);
  const parsed = parseValidationBatchResponse(raw);
  const results = normalizeValidationResults(parsed.items, batch);
  return { results, callCount: 1 };
}
