/**
 * Shared hierarchy LLM wiring for DPP and session inventory bootstrap.
 * @see specs/20260705-dpp-inventory-llm-optimization
 */

import { buildDocumentHierarchy, hasMarkdownHeadings } from "./normalization/hierarchy.js";
import { deError, deInfo, deLog, deWarn } from "./debug-enrich.js";
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
  if (!getApiKeyForLlmModel(model)) {
    deWarn('[hierarchy-llm.makeHierarchyLlmFn] No API key for model:', model);
    return null;
  }
  const signal = options.signal;
  deLog('[hierarchy-llm.makeHierarchyLlmFn] LLM fn ready:', { model });
  return async ({ systemPrompt, userPrompt, temperature, maxTokens }) => {
    deInfo('[hierarchy-llm.makeHierarchyLlmFn] LLM call:', {
      model,
      temperature,
      maxTokens,
      systemLen: String(systemPrompt || "").length,
      userLen: String(userPrompt || "").length,
    });
    return llmChatCompletions({
      llmModel: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      signal,
    });
  };
}

/**
 * Build document hierarchy; uses LLM when markdown has no `#` headings and text is large enough.
 * @param {string} markdownText
 * @param {{ llmModel?: string, signal?: AbortSignal, useCache?: boolean }} [options]
 */
export async function buildDocumentHierarchyWithLlm(markdownText, options = {}) {
  const text = String(markdownText || "");
  const minLlmChars = 3000;
  const hasHeadings = hasMarkdownHeadings(text);
  const needsLlm = text.length >= minLlmChars && !hasHeadings;
  const llmFn = needsLlm ? makeHierarchyLlmFn(options) : null;
  deInfo('[hierarchy-llm.buildDocumentHierarchyWithLlm] Start:', {
    charCount: text.length,
    minLlmChars,
    hasMarkdownHeadings: hasHeadings,
    needsLlm,
    llmFnAvailable: typeof llmFn === "function",
    useCache: options.useCache !== false,
    skipLlmReason: hasHeadings
      ? "markdown_headings_present"
      : text.length < minLlmChars
        ? "text_below_llm_threshold"
        : typeof llmFn !== "function"
          ? "no_api_key_or_llm_fn"
          : null,
  });
  try {
    const result = await buildDocumentHierarchy(text, llmFn, {
      useCache: options.useCache !== false,
      signal: options.signal,
      headings: options.headings,
    });
    deInfo('[hierarchy-llm.buildDocumentHierarchyWithLlm] Done:', {
      method: result?.method || null,
      rootCount: Array.isArray(result?.tree) ? result.tree.length : null,
      topicCount: Array.isArray(result?.topics) ? result.topics.length : null,
    });
    return result;
  } catch (err) {
    deError('[hierarchy-llm.buildDocumentHierarchyWithLlm] Failed:', err?.message || err);
    throw err;
  }
}
