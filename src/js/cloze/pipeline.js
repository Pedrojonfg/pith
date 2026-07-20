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

/**
 * [debug-enrich] Diagnose which cloze pipeline phase produced zero valid items.
 * @param {object} result - runClozePipelinePhases return value
 * @param {object[]} allItems - full item list before getValidItems filter
 */
export function diagnoseClozePipelineFailure(result, allItems = []) {
  const items = Array.isArray(allItems) ? allItems : [];
  const diag = result?.diagnostics || {};
  const graph = result?.epistemicGraph;
  const analysis = result?.analysis;
  const nodeCount = graph?.nodes?.length ?? 0;
  const edgeCount = graph?.edges?.length ?? 0;
  const nodeCandidates = analysis?.node_candidates?.length ?? 0;
  const edgeCandidates = analysis?.edge_candidates?.length ?? 0;
  const baseCount = diag.baseCount ?? 0;
  const postDistractorCount = diag.postDistractorCount ?? 0;
  const postQaCount = diag.postQaCount ?? 0;
  const validCount = diag.validCount ?? 0;

  /** @type {{ phase: string, phaseIndex: number, issue: string, detail: object } | null} */
  let zeroPhase = null;

  if (nodeCount === 0) {
    zeroPhase = {
      phase: "epistemic_graph",
      phaseIndex: 0,
      issue: "zero_graph_nodes",
      detail: { nodeCount, edgeCount },
    };
  } else if (nodeCandidates === 0 && edgeCandidates === 0) {
    zeroPhase = {
      phase: "semantic_analysis",
      phaseIndex: 1,
      issue: "zero_semantic_candidates",
      detail: { nodeCount, edgeCount, nodeCandidates, edgeCandidates },
    };
  } else if (baseCount === 0) {
    zeroPhase = {
      phase: "base_items",
      phaseIndex: 2,
      issue: "zero_base_items",
      detail: { nodeCandidates, edgeCandidates, baseCount },
    };
  } else if (postDistractorCount === 0) {
    zeroPhase = {
      phase: "distractors",
      phaseIndex: 3,
      issue: "zero_items_with_four_options",
      detail: { baseCount, postDistractorCount },
    };
  } else if (postQaCount === 0 || validCount === 0) {
    const qaStatusCounts = {};
    const rejectionNotes = {};
    for (const item of items) {
      const status = String(item?.qa_status || "missing");
      qaStatusCounts[status] = (qaStatusCounts[status] || 0) + 1;
      if (status === "rejected" || status === "weak") {
        const note = String(item?.qa_notes || "unspecified").trim().slice(0, 80);
        rejectionNotes[note] = (rejectionNotes[note] || 0) + 1;
      }
    }
    const withFourOptions = items.filter((i) => Array.isArray(i?.options) && i.options.length === 4).length;
    zeroPhase = {
      phase: "qa_calibration",
      phaseIndex: 4,
      issue: validCount === 0 ? "all_items_rejected_or_weak_in_qa" : "zero_post_qa_items",
      detail: {
        postDistractorCount,
        postQaCount,
        validCount,
        withFourOptions,
        qaStatusCounts,
        topRejectionNotes: Object.entries(rejectionNotes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([note, count]) => ({ note, count })),
      },
    };
  }

  return {
    zeroPhase,
    phaseCounts: {
      epistemicGraphNodes: nodeCount,
      epistemicGraphEdges: edgeCount,
      semanticNodeCandidates: nodeCandidates,
      semanticEdgeCandidates: edgeCandidates,
      baseItems: baseCount,
      postDistractorWithFourOptions: postDistractorCount,
      postQa: postQaCount,
      valid: validCount,
    },
  };
}

export function getPhaseLabel(phaseIndex) {
  return PHASE_LABELS[phaseIndex] || `Fase ${phaseIndex + 1}`;
}

async function callClozeJson({ llmModel, systemPrompt, userPrompt, max_tokens = 8192, signal }) {
  // [debug-enrich]
  console.debug("[cloze.pipeline.callClozeJson] LLM call:", {
    llmModel: llmModel || null,
    max_tokens,
    systemLen: String(systemPrompt || "").length,
    userLen: String(userPrompt || "").length,
  });
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
      // [debug-enrich]
      console.warn("[cloze.pipeline.callClozeJson] JSON mode failed — retry without:", err?.message || err);
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
      // [debug-enrich]
      console.error("[cloze.pipeline.callClozeJson] LLM failed:", err?.message || err);
      throw err;
    }
  }
  // [debug-enrich]
  console.debug("[cloze.pipeline.callClozeJson] Response:", {
    contentLen: String(content || "").length,
  });
  return content;
}

function truncateForPrompt(text, max = 15000) {
  const s = String(text || "");
  if (s.length <= max) return s;
  return s.slice(0, max);
}

export async function generateEpistemicGraph(text, { llmModel, signal } = {}) {
  // [debug-enrich]
  console.info("[cloze.pipeline.generateEpistemicGraph] Start:", {
    textLen: String(text || "").length,
    llmModel: llmModel || null,
  });
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
  if (!graph) {
    // [debug-enrich]
    console.error("[cloze.pipeline.generateEpistemicGraph] Invalid graph JSON");
    throw new Error("Fase 0: invalid epistemic graph JSON.");
  }
  // [debug-enrich]
  console.info("[cloze.pipeline.generateEpistemicGraph] Done:", {
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
  });
  return graph;
}

// Phase 1 semantic analysis: up to ~50 node candidates × ~80 tokens + edge rows → 8192 headroom
const SEMANTIC_ANALYSIS_MAX_TOKENS = 8192;

export async function analyzeSemanticCandidates(text, epistemicGraph, { llmModel, signal } = {}) {
  // [debug-enrich]
  console.info("[cloze.pipeline.analyzeSemanticCandidates] Start:", {
    textLen: String(text || "").length,
    nodeCount: Array.isArray(epistemicGraph?.nodes) ? epistemicGraph.nodes.length : 0,
    edgeCount: Array.isArray(epistemicGraph?.edges) ? epistemicGraph.edges.length : 0,
    llmModel: llmModel || null,
  });
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
  const raw = await callClozeJson({
    llmModel,
    systemPrompt,
    userPrompt,
    max_tokens: SEMANTIC_ANALYSIS_MAX_TOKENS,
    signal,
  });
  const parsed = parseModelJsonObject(raw);
  const analysis = normalizeSemanticAnalysis(parsed);
  // [debug-enrich]
  console.info("[cloze.pipeline.analyzeSemanticCandidates] Done:", {
    nodeCandidates: analysis.node_candidates.length,
    edgeCandidates: analysis.edge_candidates.length,
  });
  return analysis;
}

// Phase 2 base items: up to ~40 node+edge items × ~250 tokens/item + schema overhead → 12000 headroom
const BASE_ITEMS_MAX_TOKENS = 12000;

export async function generateBaseItems(text, analysis, { llmModel, signal } = {}) {
  // [debug-enrich]
  console.info("[cloze.pipeline.generateBaseItems] Start:", {
    textLen: String(text || "").length,
    nodeCandidateCount: Array.isArray(analysis?.node_candidates) ? analysis.node_candidates.length : 0,
    edgeCandidateCount: Array.isArray(analysis?.edge_candidates) ? analysis.edge_candidates.length : 0,
    llmModel: llmModel || null,
  });
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
  const raw = await callClozeJson({
    llmModel,
    systemPrompt,
    userPrompt,
    max_tokens: BASE_ITEMS_MAX_TOKENS,
    signal,
  });
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
  const out = [...nodeItems, ...edgeItems].map(annotate);
  // [debug-enrich]
  console.info("[cloze.pipeline.generateBaseItems] Done:", {
    nodeItemCount: nodeItems.length,
    edgeItemCount: edgeItems.length,
    total: out.length,
  });
  return out;
}

// Phase 3 distractors: up to ~40 items × 3 distractors × ~80 tokens/distractor + schema overhead → 12000 headroom
const DISTRACTORS_MAX_TOKENS = 12000;

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
  const raw = await callClozeJson({
    llmModel,
    systemPrompt,
    userPrompt,
    max_tokens: DISTRACTORS_MAX_TOKENS,
    signal,
  });
  const parsed = parseModelJsonObject(raw);
  const byId = new Map(
    (Array.isArray(parsed?.items) ? parsed.items : []).map((row) => [String(row.item_id || ""), row.distractors]),
  );

  return baseItems
    .map((item) => mergeItemOptions(item, byId.get(item.id) || []))
    .filter(Boolean);
}

// Phase 4 QA calibrate: up to ~40 items × ~150 tokens/row (id + enums + notes) + schema → 8192 headroom
const QA_CALIBRATE_MAX_TOKENS = 8192;

/**
 * Target balance post-QA (best effort): EASY 30%, MEDIUM 50%, HARD 20%.
 */
export async function qaAndCalibrate(items, { llmModel, signal } = {}) {
  const withOptions = (Array.isArray(items) ? items : []).map(normalizeClozeItem).filter((i) => i?.options?.length === 4);
  if (!withOptions.length) return [];

  // [debug-enrich]
  console.info("[cloze.pipeline.qaAndCalibrate] Start:", {
    itemCount: withOptions.length,
    llmModel: llmModel || null,
  });

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

  const raw = await callClozeJson({
    llmModel,
    systemPrompt,
    userPrompt: JSON.stringify(slim),
    max_tokens: QA_CALIBRATE_MAX_TOKENS,
    signal,
  });
  const parsed = parseModelJsonObject(raw);
  const qaById = new Map(
    (Array.isArray(parsed?.items) ? parsed.items : []).map((row) => [String(row.id || ""), row]),
  );

  const out = withOptions.map((item) => {
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

  // [debug-enrich]
  const statusCounts = {};
  for (const item of out) {
    const status = String(item?.qa_status || "missing");
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  console.info("[cloze.pipeline.qaAndCalibrate] Done:", {
    calibratedCount: out.length,
    statusCounts,
  });
  return out;
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
  const failureAnalysis = diagnoseClozePipelineFailure(
    { epistemicGraph, analysis, items, diagnostics: { baseCount, postDistractorCount, postQaCount, validCount: validItems.length } },
    items,
  );
  console.info("[cloze.runClozePipelinePhases] Item counts:", {
    docId: doc?.docId,
    baseCount,
    postDistractorCount,
    postQaCount,
    validCount: validItems.length,
    ...(validItems.length === 0 ? { failureAnalysis } : {}),
  }); // [debug-enrich]
  return {
    epistemicGraph,
    analysis,
    items,
    validItems,
    diagnostics: { baseCount, postDistractorCount, postQaCount, validCount: validItems.length },
  };
}
