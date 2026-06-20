/**
 * Source fidelity prompt rules — Phase A/C of 20260613-source-fidelity.
 * Pure module: no DOM, no LLM calls.
 */

export const SOURCE_FIDELITY_MARKER = "SOURCE_FIDELITY_RULES";

export const SOURCE_FIDELITY_RULES = `SOURCE FIDELITY (supreme authority):
- The uploaded study material is the supreme authority for definitions, classifications, taxonomies, and examples.
- Paraphrase for RSVP length — never substitute encyclopedic or domain-default definitions when the author uses a specific sense.
- Do NOT introduce concepts, authors, dates, or categories absent from: the source chunk + block title + block inventory scope.
- If the source does not provide an example, contrast, or narrative hook, omit that content or state briefly that the text does not develop it — do NOT fill with external knowledge.
- Analogies are permitted, and encouraged, when at least one of the following holds: (a) the analogy connects two concepts that are both already present in the source material; (b) the analogy is explicitly marked as an external comparison (e.g. prefixed "As an analogy:" / "Como analogía:") so the student cannot mistake it for something the source itself says; or (c) the concept is abstract enough that a brief external bridge is genuinely necessary for first-pass understanding, and no equivalent bridge exists in the source. Do not add an analogy by default or out of habit — only when it earns its place under (a), (b), or (c). Even when used, an analogy must never supply facts, data, dates, examples, or claims that get treated as if the source stated them: the analogy illustrates a relationship, it does not become a new factual claim.
- On conflict between generic domain knowledge and the author's definition or usage, the author's definition wins.
- Questions and feedback must be answerable only from the source chunk and explanation grounded in that chunk.`;

/**
 * RSVP explanation structure guided by source content, not generic pedagogy.
 * @param {{ isVocabularyBlock?: boolean, requireConnection?: boolean, strictMode?: boolean, extractedClaims?: object[] }} opts
 */
export function buildSourceFirstRsvpStructure({
  isVocabularyBlock = false,
  requireConnection = false,
  strictMode = false,
  extractedClaims = null,
} = {}) {
  if (strictMode && Array.isArray(extractedClaims)) {
    const types = new Set(
      extractedClaims
        .map((c) => String(c?.type || "").trim().toLowerCase())
        .filter(Boolean),
    );
    const lines = [
      "STRICT MODE — write explanation ONLY from extracted claims JSON below.",
      "Omit any pedagogical section whose claim type is absent from the extraction.",
    ];
    if (types.has("example")) lines.push("- Include an example paragraph only because extraction contains example claims.");
    else lines.push("- Do NOT add a concrete example paragraph — extraction has no example claims.");
    if (types.has("contrast")) lines.push("- Include contrast only because extraction contains contrast claims.");
    else lines.push("- Do NOT add a contrast paragraph — extraction has no contrast claims.");
    if (requireConnection) {
      lines.push("- Connection paragraph: link to prior blocks using only claims and prior block context.");
    }
    return lines.join("\n");
  }

  if (isVocabularyBlock) {
    return `VOCABULARY BLOCK structure:
- Write ONLY definitions — one paragraph per term from the block signature.
- Each definition MUST track wording and technical sense from the source chunk for that term.
- Plain-language paraphrase is fine; generic textbook definitions are NOT.
- Include a brief example sentence only if the chunk provides one for that term.`;
  }

  return `CONTENT STRUCTURE (draft in this order; never expose step names in output):
1. Hook — 1 sentence: why this concept matters per the source (not invented stakes).
2. Core definition — 1-3 sentences: preserve the author's technical sense in plain RSVP prose.
3. Technical layer — 2-4 sentences: formal terms as the source presents them.
4. Example — ONLY if the source chunk contains an example; otherwise omit entirely.
5. Contrast — ONLY if the source mentions confusion, opposition, or contrast; otherwise omit.
6. Connection — 1-2 sentences${requireConnection ? " linking to the previous block title" : ""}.

WRITING RULES:
- Short sentences (max ~15 words). One idea per sentence.
- Do NOT contradict or replace source definitions; paraphrase short sentences.
- Do NOT copy 80-word source sentences verbatim.
- 200-300 words maximum unless vocabulary block.`;
}

/**
 * @param {string} basePrompt
 * @param {{ strictMode?: boolean, extractedClaims?: object[] | null }} opts
 */
export function mergeFidelityIntoSystemPrompt(basePrompt, { strictMode = false, extractedClaims = null } = {}) {
  const base = String(basePrompt || "");
  let out = `${base}\n\n${SOURCE_FIDELITY_RULES}`;
  if (strictMode && Array.isArray(extractedClaims) && extractedClaims.length) {
    out += `\n\nEXTRACTED CLAIMS (sole source for strict rewrite):\n${JSON.stringify(extractedClaims)}`;
  }
  return out;
}

/** @param {object} opts — passed to buildBlockGenerationSystemPrompt */
export function includesSourceFidelityInPrompt(promptText) {
  const t = String(promptText || "");
  return t.includes(SOURCE_FIDELITY_MARKER) || t.includes("supreme authority");
}
