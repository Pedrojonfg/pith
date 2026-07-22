/**
 * Concept relation generation — edges only, fixed inventory node ids.
 * @see specs/20260722-unified-concept-graph/contracts/concept-graph.md
 */

import {
  normalizeEpistemicEdge,
  parseModelJsonObject,
  RELATION_TYPE_LIST,
} from "../cloze/normalize.js";
import { getConceptDisplayName, getConceptDefinition } from "./concept-display.js";

/**
 * Expected ≤80 edges × ~40 tokens + JSON wrapper / prompt echo headroom.
 * Sized for medium inventories (~40 concepts); raise if truncation observed.
 */
export const CONCEPT_RELATIONS_MAX_TOKENS = 4096;

function inventoryIdSet(inventory) {
  const ids = new Set();
  for (const c of Array.isArray(inventory) ? inventory : []) {
    const id = String(c?.canonicalId || c?.id || "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

function slimConceptForPrompt(c) {
  const id = String(c?.canonicalId || c?.id || "").trim();
  const label = getConceptDisplayName(c);
  const definition = getConceptDefinition(c);
  return { id, label, definition };
}

function truncateForPrompt(text, max = 12000) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return s.slice(0, max);
}

/**
 * Parse LLM JSON and keep only edges whose endpoints exist in inventory.
 * @param {string} raw
 * @param {object[]} inventory
 * @returns {object[]}
 */
export function parseAndFilterConceptRelations(raw, inventory) {
  const ids = inventoryIdSet(inventory);
  const parsed = parseModelJsonObject(raw);
  if (!parsed) return [];
  const edgesRaw = Array.isArray(parsed.edges) ? parsed.edges : [];
  const out = [];
  for (let i = 0; i < edgesRaw.length; i += 1) {
    const edge = normalizeEpistemicEdge(edgesRaw[i], i);
    if (!edge) continue;
    if (!ids.has(edge.source_id) || !ids.has(edge.target_id)) {
      console.warn(
        `[concept-graph.relations] dropping edge ${edge.id}: unknown endpoint`,
        edge.source_id,
        edge.target_id,
      );
      continue;
    }
    out.push(edge);
  }
  return out;
}

/**
 * @param {string} markdown
 * @param {object[]} inventory
 * @param {{ llmModel?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<object[]>}
 */
export async function generateConceptRelations(markdown, inventory, opts = {}) {
  const list = (Array.isArray(inventory) ? inventory : [])
    .map(slimConceptForPrompt)
    .filter((c) => c.id && c.label);
  if (!list.length) return [];

  // Dynamic import keeps unit tests free of browser-only llm query-string imports
  const { llmChatCompletions } = await import("../llm.js?v=20260625_02");

  const types = RELATION_TYPE_LIST.join("|");
  const systemPrompt = `You propose typed relations between a FIXED list of concepts from study material.

Return ONLY valid JSON:
{
  "edges": [{
    "id": "edge_001",
    "source_id": "<id from the provided concept list>",
    "target_id": "<id from the provided concept list>",
    "type": "${types}",
    "registry_type": "PREREQUISITE|CONTRADICTS|EXEMPLIFIES|PART_OF|ASSOCIATED",
    "sentence_context": "anchor sentence from text"
  }]
}

Rules:
- Only propose edges between the concept ids provided below. Do not invent new concepts.
- If a relation involves something not in this list, omit it.
- Every edge needs sentence_context from or adapted from the text.
- registry_type MUST be one of the five enum values; pick the best fit (default ASSOCIATED).
- Prefer prerequisite_of when A must be understood before B.`;

  const userPrompt = `Concepts (fixed ids):\n${JSON.stringify(list)}\n\nMaterial:\n\n${truncateForPrompt(markdown)}`;

  let content;
  try {
    content = await llmChatCompletions({
      llmModel: opts.llmModel,
      max_tokens: CONCEPT_RELATIONS_MAX_TOKENS,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      signal: opts.signal,
    });
  } catch (err) {
    if (err?.status === 400 || /response_format/i.test(String(err?.message))) {
      content = await llmChatCompletions({
        llmModel: opts.llmModel,
        max_tokens: CONCEPT_RELATIONS_MAX_TOKENS,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        signal: opts.signal,
      });
    } else {
      throw err;
    }
  }

  return parseAndFilterConceptRelations(content, inventory);
}
