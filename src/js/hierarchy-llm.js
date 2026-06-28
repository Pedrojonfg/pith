/**
 * Shared hierarchy LLM wiring for DPP and session inventory bootstrap.
 * @see specs/20260705-dpp-inventory-llm-optimization
 */

import { buildDocumentHierarchy, hasMarkdownHeadings } from "./normalization/hierarchy.js";
import {
  getApiKeyForLlmModel,
  llmChatCompletions,
  normalizeLlmModel,
} from "./llm.js?v=20260625_02";

/**
 * @param {{ llmModel?: string, signal?: AbortSignal }} [options]
 * @returns {((args: object) => Promise<string>) | null}
 */
export function makeHierarchyLlmFn(options = {}) {
  const model = normalizeLlmModel(options.llmModel);
  if (!getApiKeyForLlmModel(model)) return null;
  const signal = options.signal;
  return async ({ systemPrompt, userPrompt, temperature, maxTokens }) =>
    llmChatCompletions({
      llmModel: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      signal,
    });
}

/**
 * Build document hierarchy; uses LLM when markdown has no `#` headings and text is large enough.
 * @param {string} markdownText
 * @param {{ llmModel?: string, signal?: AbortSignal, useCache?: boolean }} [options]
 */
export async function buildDocumentHierarchyWithLlm(markdownText, options = {}) {
  const text = String(markdownText || "");
  const needsLlm = text.length >= 3000 && !hasMarkdownHeadings(text);
  const llmFn = needsLlm ? makeHierarchyLlmFn(options) : null;
  return buildDocumentHierarchy(text, llmFn, {
    useCache: options.useCache !== false,
    signal: options.signal,
  });
}
