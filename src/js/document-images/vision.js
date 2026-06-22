/**
 * Vision analysis for document images — DPP T1.7.
 */

import { llmChatCompletionsMultimodal } from "../llm.js";
import { logLlmUsage } from "../llm-usage-log.js";
import { getDocumentImageSignedUrl } from "./storage.js";
import { EDGE_TYPES } from "../graph/build.js";

/** Vision JSON: ~8 fields × ~40 tokens */
const VISION_ANALYSIS_MAX_TOKENS = 512;

/**
 * @param {unknown} raw
 */
function parseVisionResponse(raw) {
  const text = String(raw || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fence ? fence[1].trim() : text;
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {import("../session-types.js").DocumentImage} image
 * @param {object[]} conceptInventory
 * @param {{ llmModel?: string, docId?: string, language?: string }} ctx
 */
export async function analyzeDocumentImage(image, conceptInventory, ctx = {}) {
  const signedUrl = await getDocumentImageSignedUrl(image.storagePath);
  if (!signedUrl) throw new Error("image URL unavailable");

  const concepts = (conceptInventory || [])
    .slice(0, 80)
    .map((c) => ({
      id: String(c.canonicalId || c.id || "").trim(),
      label: String(c.label || c.term || "").trim(),
      definition: String(c.definition || c.authorUsage || "").slice(0, 200),
    }))
    .filter((c) => c.id && c.label);

  const prompt = [
    "Analyze this document figure for a study app.",
    "Return JSON only:",
    '{"description":"short plain English description","matchedConceptIds":["id",...],"createConcept":null|"label"}',
    "matchedConceptIds: existing concept ids this image exemplifies (0-3).",
    "createConcept: if no good match, optional new image concept label; else null.",
    `Document language context: ${ctx.language || "English"}`,
    `Concept inventory: ${JSON.stringify(concepts)}`,
  ].join("\n");

  const content = await llmChatCompletionsMultimodal({
    llmModel: ctx.llmModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: signedUrl } },
        ],
      },
    ],
    max_tokens: VISION_ANALYSIS_MAX_TOKENS,
    temperature: 0.1,
  });

  void logLlmUsage({
    docId: ctx.docId,
    phase: "T1.7-image-vision",
    model: ctx.llmModel || "unknown",
    meta: { imageId: image.imageId },
  });

  const parsed = parseVisionResponse(content);
  if (!parsed) throw new Error("vision parse failed");

  const description = String(parsed.description || "").trim();
  const matchedConceptIds = Array.isArray(parsed.matchedConceptIds)
    ? parsed.matchedConceptIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const createConcept =
    parsed.createConcept != null ? String(parsed.createConcept).trim() : "";

  return { description, matchedConceptIds, createConcept };
}

/**
 * @param {object} doc
 * @param {{ llmModel?: string, language?: string, onProgress?: (msg: string) => void }} ctx
 */
export async function runImageVisionAnalysis(doc, ctx = {}) {
  const images = Array.isArray(doc?.shared?.images) ? doc.shared.images : [];
  const inventory = Array.isArray(doc?.shared?.conceptInventory)
    ? doc.shared.conceptInventory
    : [];
  if (!images.length) return { analyzed: 0, failed: 0 };

  let analyzed = 0;
  let failed = 0;

  if (!doc.shared.conceptGraph) {
    doc.shared.conceptGraph = { nodes: [], edges: [] };
  }
  const graph = doc.shared.conceptGraph;
  if (!Array.isArray(graph.nodes)) graph.nodes = [];
  if (!Array.isArray(graph.edges)) graph.edges = [];

  for (const image of images) {
    if (image.visionStatus === "ready" || image.visionStatus === "skipped") continue;
    ctx.onProgress?.(`Analyzing figure ${image.imageId}…`);
    try {
      const result = await analyzeDocumentImage(image, inventory, {
        llmModel: ctx.llmModel,
        docId: doc.docId,
        language: ctx.language,
      });
      image.visionDescription = result.description || null;
      image.conceptLinks = [];
      image.visionStatus = "ready";

      for (const conceptId of result.matchedConceptIds) {
        const known = inventory.some(
          (c) => String(c.canonicalId || c.id) === conceptId,
        );
        if (!known) continue;
        image.conceptLinks.push(conceptId);
        graph.edges.push({
          from: `image:${image.imageId}`,
          to: `concept:${conceptId}`,
          type: EDGE_TYPES.exemplifies,
          label: "exemplifies",
        });
      }

      if (!image.conceptLinks.length && result.createConcept) {
        const newId = `img_concept_${image.imageId}`;
        inventory.push({
          id: newId,
          canonicalId: newId,
          label: result.createConcept,
          definition: result.description || result.createConcept,
          type: "image",
          detectedBy: "image-vision",
        });
        image.conceptLinks.push(newId);
        graph.nodes.push({
          id: `concept:${newId}`,
          label: result.createConcept,
          layer: "concept",
        });
        graph.edges.push({
          from: `image:${image.imageId}`,
          to: `concept:${newId}`,
          type: EDGE_TYPES.exemplifies,
          label: "exemplifies",
        });
      }

      if (!image.conceptLinks.length && !result.createConcept) {
        image.visionStatus = "ready";
      }
      analyzed += 1;
    } catch (err) {
      image.visionStatus = "failed";
      image.visionDescription = null;
      failed += 1;
      console.warn("[vision]", image.imageId, err?.message || err);
    }
  }

  doc.shared.conceptInventory = inventory;
  doc.shared.conceptGraph = graph;
  return { analyzed, failed };
}
