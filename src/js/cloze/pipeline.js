import { llmChatCompletions } from "../llm.js?v=20260625_02";
import { getActiveSession, upsertSmItem } from "../session-store.js?v=20260625_02";
import { createSmItem } from "../sm2.js";
import {
  getValidItems,
  mergeItemOptions,
  normalizeClozeItem,
  normalizeEpistemicGraph,
  normalizeSemanticAnalysis,
  parseModelJsonObject,
} from "./normalize.js?v=20260625_02";
import { resolveSourceFileIdForExcerpt } from "../source-provenance.js";

const PHASE_LABELS = [
  "Grafo epistémico",
  "Análisis semántico",
  "Ítems base",
  "Distractores",
  "QA y calibración",
];

export { getValidItems, PHASE_LABELS };

export function getPhaseLabel(phaseIndex) {
  return PHASE_LABELS[phaseIndex] || `Fase ${phaseIndex + 1}`;
}

async function callClozeJson({ llmModel, systemPrompt, userPrompt, max_tokens = 8192, signal }) {
  let content;
  try {
    content = await llmChatCompletions({
      llmModel,
      max_tokens,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      signal,
    });
  } catch (err) {
    if (err?.status === 400 || /response_format/i.test(String(err?.message))) {
      content = await llmChatCompletions({
        llmModel,
        max_tokens,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        signal,
      });
    } else {
      throw err;
    }
  }
  return content;
}

function truncateForPrompt(text, max = 15000) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return s.slice(0, max);
}

export async function generateEpistemicGraph(text, { llmModel, signal } = {}) {
  const systemPrompt = `You build an epistemic graph from study material.

Return ONLY valid JSON with this schema:
{
  "nodes": [{
    "id": "node_001",
    "text": "concept name",
    "type": "CONCEPT|THESIS|TERM|AUTHOR|CAUSE|EFFECT",
    "importance": 1-5,
    "semantic_cluster": "domain label",
    "aliases": ["optional"]
  }],
  "edges": [{
    "id": "edge_001",
    "source_id": "node_001",
    "target_id": "node_002",
    "type": "implies|causes|supports|contradicts|defines|exemplifies|is_a|part_of|prerequisite_of",
    "registry_type": "PREREQUISITE|CONTRADICTS|EXEMPLIFIES|PART_OF|ASSOCIATED",
    "sentence_context": "anchor sentence from text"
  }]
}

Rules:
- importance 1=trivial, 5=central; exclude importance 1 from being central concepts
- Every edge needs sentence_context from or adapted from the text
- registry_type MUST be one of the five enum values; pick the best fit (default ASSOCIATED)
- 20-50 nodes typical for a medium document`;

  const userPrompt = `Material:\n\n${truncateForPrompt(text)}`;
  const raw = await callClozeJson({ llmModel, systemPrompt, userPrompt, signal });
  const parsed = parseModelJsonObject(raw);
  const graph = normalizeEpistemicGraph(parsed);
  if (!graph) throw new Error("Fase 0: invalid epistemic graph JSON.");
  return graph;
}

export async function analyzeSemanticCandidates(text, epistemicGraph, { llmModel, signal } = {}) {
  const systemPrompt = `Analyze semantic cloze candidates from text + epistemic graph.

Return ONLY valid JSON:
{
  "node_candidates": [{
    "node_id": "node_001",
    "text": "...",
    "importance": 3-5,
    "semantic_cluster": "...",
    "perspectives_available": ["NODE-DEF","NODE-APP","NODE-COND","NODE-CONTRAST"],
    "occurrences": [{ "sentence": "...", "char_start": 0, "char_end": 10, "best_perspective": "NODE-DEF" }]
  }],
  "edge_candidates": [{
    "edge_id": "edge_001",
    "source_id": "node_001",
    "target_id": "node_002",
    "relation_type": "implies",
    "aptitude_score": 1-5,
    "items_possible": ["EDGE-SOURCE","EDGE-TARGET","EDGE-RELATION"],
    "sentence_context": "..."
  }]
}

Only include nodes with importance >= 3. Edge aptitude_score >= 3 for viable edges.`;

  const userPrompt = `Graph:\n${JSON.stringify(epistemicGraph)}\n\nMaterial:\n${truncateForPrompt(text)}`;
  const raw = await callClozeJson({ llmModel, systemPrompt, userPrompt, signal });
  const parsed = parseModelJsonObject(raw);
  return normalizeSemanticAnalysis(parsed);
}

export async function generateBaseItems(text, analysis, { llmModel, signal } = {}) {
  const systemPrompt = `Generate base cloze items (no distractors yet).

Return ONLY valid JSON:
{
  "node_items": [{
    "id": "item_node_001_def",
    "item_type": "NODE-DEF|NODE-APP|NODE-COND|NODE-CONTRAST",
    "node_id": "node_001",
    "semantic_cluster": "...",
    "importance": 3-5,
    "sentence_original": "...",
    "sentence_with_blank": "... with _____ ...",
    "blank_text": "answer",
    "blank_char_start": 0,
    "blank_char_end": 10,
    "is_synthetic": false
  }],
  "edge_items": [{
    "id": "item_edge_001_source",
    "item_type": "EDGE-SOURCE|EDGE-TARGET|EDGE-RELATION",
    "edge_id": "edge_001",
    "source_node_id": "node_001",
    "target_node_id": "node_002",
    "relation_type": "implies",
    "semantic_cluster": "...",
    "sentence_original": "...",
    "sentence_with_blank": "_____ ...",
    "blank_text": "...",
    "blank_char_start": 0,
    "blank_char_end": 10,
    "is_synthetic": false
  }]
}

Use _____ as blank placeholder. Reject trivial blanks (articles, prepositions).`;

  const userPrompt = `Analysis:\n${JSON.stringify(analysis)}\n\nMaterial:\n${truncateForPrompt(text)}`;
  const raw = await callClozeJson({ llmModel, systemPrompt, userPrompt, max_tokens: 12000, signal });
  const parsed = parseModelJsonObject(raw);
  const nodeItems = (Array.isArray(parsed?.node_items) ? parsed.node_items : [])
    .map(normalizeClozeItem)
    .filter(Boolean);
  const edgeItems = (Array.isArray(parsed?.edge_items) ? parsed.edge_items : [])
    .map(normalizeClozeItem)
    .filter(Boolean);
  const material = String(text || "");
  const annotate = (item) => {
    if (!item) return item;
    const fileId = resolveSourceFileIdForExcerpt(material, item.sentence_original || item.sentence_with_blank);
    return fileId ? { ...item, sourceFileId: fileId } : item;
  };
  return [...nodeItems, ...edgeItems].map(annotate);
}

export async function generateDistractors(items, epistemicGraph, { llmModel, signal } = {}) {
  const baseItems = (Array.isArray(items) ? items : []).map(normalizeClozeItem).filter(Boolean);
  if (!baseItems.length) return [];

  const systemPrompt = `Add 3 distractors per cloze item (L1 from graph nodes, L3 synthetic fallback).

Return ONLY valid JSON:
{
  "items": [{
    "item_id": "item_node_001_def",
    "distractors": [
      { "text": "...", "plausibility": "high|medium|low", "source": "L1|L3", "rationale": "..." },
      { "text": "...", "plausibility": "high|medium|low", "source": "L1|L3", "rationale": "..." },
      { "text": "...", "plausibility": "high|medium|low", "source": "L1|L3", "rationale": "..." }
    ]
  }]
}

Rules:
- Same semantic type as correct answer
- Gradient: one high, one medium, one low plausibility
- Never synonym of correct answer
- Use graph nodes (L1) when possible`;

  const slimItems = baseItems.map((item) => ({
    id: item.id,
    item_type: item.item_type,
    blank_text: item.blank_text,
    semantic_cluster: item.semantic_cluster,
    sentence_with_blank: item.sentence_with_blank,
  }));

  const userPrompt = `Graph nodes:\n${JSON.stringify(epistemicGraph?.nodes || [])}\n\nItems:\n${JSON.stringify(slimItems)}`;
  const raw = await callClozeJson({ llmModel, systemPrompt, userPrompt, max_tokens: 12000, signal });
  const parsed = parseModelJsonObject(raw);
  const byId = new Map(
    (Array.isArray(parsed?.items) ? parsed.items : []).map((row) => [String(row.item_id || ""), row.distractors]),
  );

  return baseItems
    .map((item) => mergeItemOptions(item, byId.get(item.id) || []))
    .filter(Boolean);
}

/**
 * Target balance post-QA (best effort): EASY 30%, MEDIUM 50%, HARD 20%.
 */
export async function qaAndCalibrate(items, { llmModel, signal } = {}) {
  const withOptions = (Array.isArray(items) ? items : []).map(normalizeClozeItem).filter((i) => i?.options?.length === 4);
  if (!withOptions.length) return [];

  const systemPrompt = `QA cloze MC items and assign difficulty + qa_status.

Return ONLY valid JSON:
{
  "items": [{
    "id": "item_node_001_def",
    "difficulty": "easy|medium|hard",
    "qa_status": "valid|weak|rejected",
    "qa_notes": "optional reason"
  }]
}

Reject trivial blanks, ambiguous answers, or weak distractors.
Target distribution among valid items: ~30% easy, ~50% medium, ~20% hard.`;

  const slim = withOptions.map((item) => ({
    id: item.id,
    item_type: item.item_type,
    sentence_with_blank: item.sentence_with_blank,
    blank_text: item.blank_text,
    options: item.options.map((o) => ({ text: o.text, plausibility: o.plausibility })),
  }));

  const raw = await callClozeJson({ llmModel, systemPrompt, userPrompt: JSON.stringify(slim), max_tokens: 8192, signal });
  const parsed = parseModelJsonObject(raw);
  const qaById = new Map(
    (Array.isArray(parsed?.items) ? parsed.items : []).map((row) => [String(row.id || ""), row]),
  );

  return withOptions.map((item) => {
    const qa = qaById.get(item.id) || {};
    const difficulty = ["easy", "medium", "hard"].includes(String(qa.difficulty))
      ? qa.difficulty
      : item.difficulty;
    const qa_status = ["valid", "weak", "rejected"].includes(String(qa.qa_status))
      ? qa.qa_status
      : item.qa_status;
    return normalizeClozeItem({
      ...item,
      difficulty,
      qa_status,
      qa_notes: qa.qa_notes != null ? String(qa.qa_notes) : item.qa_notes,
    });
  }).filter(Boolean);
}

/**
 * Build epistemic graph nodes from shared concept inventory (skip LLM phase 0).
 * @param {object} shared
 */
export function epistemicGraphFromShared(shared) {
  const concepts = Array.isArray(shared?.conceptInventory) ? shared.conceptInventory : [];
  const nodes = concepts.map((c, i) => {
    const id = String(c?.canonicalId || `shared_${i + 1}`).trim();
    const text = String(c?.label || "").trim();
    if (!id || !text) return null;
    const imp = Number(c?.importance);
    const importance =
      Number.isFinite(imp) && imp >= 1 && imp <= 5
        ? Math.round(imp)
        : Number.isFinite(imp) && imp <= 1
          ? Math.max(1, Math.min(5, Math.round(imp * 5)))
          : 3;
    return {
      id,
      text,
      type: "CONCEPT",
      importance,
      semantic_cluster: "shared",
    };
  }).filter(Boolean);
  return normalizeEpistemicGraph({ nodes, edges: [] }) || { nodes: [], edges: [] };
}

function shouldSkipClozePhase0(session, doc) {
  const retrySkip = Boolean(
    session?.cloze?.epistemicGraph?.nodes?.length &&
      String(session?.cloze?.pipelineStatus || "") === "failed",
  );
  if (retrySkip) return { skip: true, fromShared: false };

  if (session?.cloze?.epistemicGraph?.nodes?.length) {
    return { skip: true, fromShared: false };
  }

  if (doc?.shared?.conceptGraph?.nodes?.length) {
    return { skip: true, fromShared: true };
  }

  const shared = doc?.shared;
  const slowSlice = doc?.modes?.slow;
  const slowPayload = slowSlice?.slow && typeof slowSlice.slow === "object" ? slowSlice.slow : slowSlice;
  const fromSlow =
    slowPayload?.graphEnrichedUnlocked === true ||
    (shared?.conceptInventory?.length ?? 0) >= 5;
  return { skip: fromSlow, fromShared: fromSlow };
}

async function persistClozeItemsToShared(docId, items) {
  if (!docId || !Array.isArray(items)) return;
  const valid = getValidItems(items);
  for (const item of valid) {
    if (!item?.id) continue;
    try {
      await upsertSmItem(
        docId,
        createSmItem({
          id: `cloze:${item.id}`,
          sourceType: "cloze_item",
          sourceId: String(item.id),
          docId,
          title: String(item.blank_text || item.stem || "").trim(),
          contentPreview: String(item.correct_answer || item.answer || "").trim(),
        }),
      );
    } catch (err) {
      console.warn("[cloze] upsertSmItem failed", err);
    }
  }
}

export async function runClozePipelinePhases(text, session, handlers = {}) {
  const llmModel = session?.llmModel;
  const onPhase = typeof handlers.onPhase === "function" ? handlers.onPhase : () => {};
  const signal = handlers.signal;
  const doc = await getActiveSession();
  let epistemicGraph = session?.cloze?.epistemicGraph || null;
  let analysis = session?.cloze?.analysis || null;
  let items = [];

  const { skip: skipPhase0, fromShared } = shouldSkipClozePhase0(session, doc);

  if (!skipPhase0) {
    onPhase(0, "phase0", { epistemicGraph: null });
    epistemicGraph = await generateEpistemicGraph(text, { llmModel, signal });
    onPhase(0, "phase0", { epistemicGraph });
  } else if (fromShared && !epistemicGraph?.nodes?.length) {
    onPhase(0, "phase0", { epistemicGraph: null });
    epistemicGraph =
      doc?.shared?.conceptGraph?.nodes?.length
        ? doc.shared.conceptGraph
        : epistemicGraphFromShared(doc?.shared);
    onPhase(0, "phase0", { epistemicGraph });
  }

  onPhase(1, "phase1", { epistemicGraph });
  analysis = await analyzeSemanticCandidates(text, epistemicGraph, { llmModel, signal });
  onPhase(1, "phase1", { epistemicGraph, analysis });

  onPhase(2, "phase2", { epistemicGraph, analysis });
  items = await generateBaseItems(text, analysis, { llmModel, signal });
  const baseCount = (Array.isArray(items) ? items : []).length;
  onPhase(2, "phase2", { epistemicGraph, analysis, items });

  onPhase(3, "phase3", { epistemicGraph, analysis, items });
  items = await generateDistractors(items, epistemicGraph, { llmModel, signal });
  const postDistractorCount = (Array.isArray(items) ? items : []).filter(
    (i) => Array.isArray(i?.options) && i.options.length === 4,
  ).length;
  onPhase(3, "phase3", { epistemicGraph, analysis, items });

  onPhase(4, "phase4", { epistemicGraph, analysis, items });
  items = await qaAndCalibrate(items, { llmModel, signal });
  const postQaCount = (Array.isArray(items) ? items : []).length;
  onPhase(4, "phase4", { epistemicGraph, analysis, items });

  if (doc?.docId) {
    persistClozeItemsToShared(doc.docId, items);
  }

  const validItems = getValidItems(items);
  console.info("[cloze.runClozePipelinePhases] Item counts:", {
    docId: doc?.docId,
    baseCount,
    postDistractorCount,
    postQaCount,
    validCount: validItems.length,
  });
  return {
    epistemicGraph,
    analysis,
    items,
    validItems,
    diagnostics: { baseCount, postDistractorCount, postQaCount, validCount: validItems.length },
  };
}
