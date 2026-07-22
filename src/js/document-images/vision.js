/**
 * Vision analysis for document images — DPP T1.7.
 * Image LLM calls route to Gemini (multimodal); never DeepSeek.
 */

import { geminiChatCompletions, hasPlatformLlmAccess } from "../llm.js?v=20260625_02";
import { logLlmUsage } from "../llm-usage-log.js";
import { getDocumentImageSignedUrl } from "./storage.js";
import { EDGE_TYPES } from "../graph/build.js";
import { getConceptDisplayName, getConceptDefinition } from "../concept-graph/concept-display.js";

const GEMINI_VISION_MODEL = "gemini-3.5-flash";

/** Vision JSON: ~8 fields × ~40 tokens */
const VISION_ANALYSIS_MAX_TOKENS = 512;

/**
 * Slim inventory rows for the vision LLM prompt (id + display name + definition).
 * @param {object[]} conceptInventory
 */
export function mapConceptsForVisionPrompt(conceptInventory) {
  return (Array.isArray(conceptInventory) ? conceptInventory : [])
    .slice(0, 80)
    .map((c) => ({
      id: String(c.canonicalId || c.id || "").trim(),
      label: getConceptDisplayName(c),
      definition: getConceptDefinition(c).slice(0, 200),
    }))
    .filter((c) => c.id && c.label);
}

/** Page OCR fallback: ~1 scanned page × ~800 tokens */
const VISION_PAGE_TEXT_MAX_TOKENS = 4096;

/** Pace Gemini vision calls to avoid upstream 429 bursts after DPP inventory. */
const VISION_INTER_CALL_DELAY_MS = 500;
const VISION_429_COOLDOWN_MS = 8000;

/** Suppress duplicate missing-key warnings within one upload vision run. */
let _visionKeyWarningShown = false;

/**
 * Direct Gemini OpenAI-compatible chat (not llm.js — avoids DeepSeek routing).
 * @param {object} opts
 * @param {object[]} opts.messages
 * @param {number} [opts.max_tokens]
 * @param {number} [opts.temperature]
 * @returns {Promise<{ status: number, content: string | null } | null>}
 */
async function geminiVisionChat({
  messages,
  max_tokens = VISION_ANALYSIS_MAX_TOKENS,
  temperature = 0,
} = {}) {
  if (!hasPlatformLlmAccess()) return null;

  try {
    const result = await geminiChatCompletions({
      model: GEMINI_VISION_MODEL,
      messages,
      max_tokens,
      temperature,
    });
    if (!result) return null;
    return result;
  } catch (err) {
    const status = err?.status ?? 500;
    return { status, content: null };
  }
}

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

function bytesToDataUrl(bytes, mimeType = "image/png") {
  const bin = new Uint8Array(bytes);
  let b64 = "";
  const chunk = 0x8000;
  for (let i = 0; i < bin.length; i += chunk) {
    const slice = bin.subarray(i, i + chunk);
    b64 += String.fromCharCode(...slice);
  }
  const encoded =
    typeof btoa === "function"
      ? btoa(b64)
      : Buffer.from(bin).toString("base64");
  return `data:${mimeType};base64,${encoded}`;
}

/**
 * Extract readable text from a rendered PDF page image (R3 vision fallback).
 * @param {ArrayBuffer} imageBytes
 * @param {string} [mimeType]
 * @param {{ docId?: string, pageNum?: number }} [ctx]
 * @returns {Promise<string|null>}
 */
export async function extractPageTextWithVision(imageBytes, mimeType = "image/png", ctx = {}) {
  // [debug-enrich]
  console.info("[vision.extractPageTextWithVision] Start:", {
    byteLength: imageBytes?.byteLength ?? 0,
    mimeType,
    docId: ctx.docId || null,
    pageNum: ctx.pageNum ?? null,
  });
  if (!imageBytes?.byteLength) {
    // [debug-enrich]
    console.debug("[vision.extractPageTextWithVision] Skip — empty image");
    return null;
  }
  if (!hasPlatformLlmAccess()) {
    // [debug-enrich]
    console.warn("[vision.extractPageTextWithVision] Skip — no platform LLM access");
    return null;
  }

  const dataUrl = bytesToDataUrl(imageBytes, mimeType);
  const prompt = [
    "Extract all readable text from this document page image.",
    "Return plain text only — preserve headings, paragraphs, lists, and table rows as readable lines.",
    "Do not summarize or add commentary.",
  ].join(" ");

  const llmResult = await geminiVisionChat({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: VISION_PAGE_TEXT_MAX_TOKENS,
    temperature: 0,
  });

  if (!llmResult?.content) {
    console.debug("[vision.extractPageTextWithVision] No text returned:", {
      docId: ctx.docId || null,
      pageNum: ctx.pageNum ?? null,
      status: llmResult?.status ?? null,
    });
    return null;
  }

  const text = String(llmResult.content).trim();
  if (!text) return null;

  void logLlmUsage({
    docId: ctx.docId,
    phase: "T0.1-vision-page-fallback",
    model: GEMINI_VISION_MODEL,
    meta: { pageNum: ctx.pageNum ?? null },
  });

  // [debug-enrich]
  console.info("[vision.extractPageTextWithVision] Done:", {
    docId: ctx.docId || null,
    pageNum: ctx.pageNum ?? null,
    textLen: text.length,
  });
  return text;
}

/**
 * @param {import("../session-types.js").DocumentImage} image
 * @param {object[]} conceptInventory
 * @param {{ docId?: string, language?: string }} ctx
 */
export async function analyzeDocumentImage(image, conceptInventory, ctx = {}) {
  console.debug("[vision.analyzeDocumentImage] Start:", {
    imageId: image.imageId,
    visionStatus: image.visionStatus,
    storagePath: image.storagePath ? "present" : "missing",
  }); // [debug-enrich]
  const signedUrl = await getDocumentImageSignedUrl(image.storagePath);
  if (!signedUrl) {
    console.warn("[vision.analyzeDocumentImage] Skipped — image URL unavailable:", {
      imageId: image.imageId,
    }); // [debug-enrich]
    throw new Error("image URL unavailable");
  }

  const concepts = mapConceptsForVisionPrompt(conceptInventory);

  const prompt = [
    "Analyze this document figure for a study app.",
    "Return JSON only:",
    '{"description":"short plain English description","matchedConceptIds":["id",...],"createConcept":null|"label"}',
    "matchedConceptIds: existing concept ids this image exemplifies (0-3).",
    "createConcept: if no good match, optional new image concept label; else null.",
    `Document language context: ${ctx.language || "English"}`,
    `Concept inventory: ${JSON.stringify(concepts)}`,
  ].join("\n");

  const llmResult = await geminiVisionChat({
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
    temperature: 0,
  });

  if (!llmResult) {
    console.warn("[vision.analyzeDocumentImage] Gemini call returned null — skipping:", {
      imageId: image.imageId,
    }); // [debug-enrich]
    return null;
  }

  if (!llmResult.content) {
    console.warn("[vision.analyzeDocumentImage] Gemini vision failed:", {
      imageId: image.imageId,
      status: llmResult.status,
    }); // [debug-enrich]
    return null;
  }

  void logLlmUsage({
    docId: ctx.docId,
    phase: "T1.7-image-vision",
    model: GEMINI_VISION_MODEL,
    meta: { imageId: image.imageId },
  });

  const parsed = parseVisionResponse(llmResult.content);
  if (!parsed) {
    console.warn("[vision.analyzeDocumentImage] Vision JSON parse failed:", {
      imageId: image.imageId,
    }); // [debug-enrich]
    return null;
  }

  const description = String(parsed.description || "").trim();
  const matchedConceptIds = Array.isArray(parsed.matchedConceptIds)
    ? parsed.matchedConceptIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const createConcept =
    parsed.createConcept != null ? String(parsed.createConcept).trim() : "";

  console.info("[vision.analyzeDocumentImage] Success:", {
    imageId: image.imageId,
    descriptionReturned: Boolean(description),
    descriptionChars: description.length,
    matchedConceptCount: matchedConceptIds.length,
    createConcept: Boolean(createConcept),
  }); // [debug-enrich]

  return { description, matchedConceptIds, createConcept };
}

/**
 * @param {object} doc
 * @param {{ language?: string, onProgress?: (msg: string) => void }} ctx
 */
export async function runImageVisionAnalysis(doc, ctx = {}) {
  _visionKeyWarningShown = false;

  const images = Array.isArray(doc?.shared?.images) ? doc.shared.images : [];
  const inventory = Array.isArray(doc?.shared?.conceptInventory)
    ? doc.shared.conceptInventory
    : [];
  const detectedCount = images.length;
  console.info("[vision.runImageVisionAnalysis] Start:", {
    docId: doc.docId,
    imagesDetected: detectedCount,
    inventoryConcepts: inventory.length,
  }); // [debug-enrich]
  if (!images.length) return { analyzed: 0, failed: 0 };

  const pending = images.filter(
    (img) => img.visionStatus !== "ready" && img.visionStatus !== "skipped",
  );
  console.debug("[vision.runImageVisionAnalysis] Pending for Gemini:", {
    docId: doc.docId,
    pendingCount: pending.length,
    alreadyReady: images.filter((img) => img.visionStatus === "ready").length,
    alreadySkipped: images.filter((img) => img.visionStatus === "skipped").length,
  }); // [debug-enrich]
  if (!pending.length) return { analyzed: 0, failed: 0 };

  if (!hasPlatformLlmAccess()) {
    if (!_visionKeyWarningShown) {
      console.warn("[vision.runImageVisionAnalysis] Sign in required — skipping all images:", {
        docId: doc.docId,
        imagesDetected: detectedCount,
      }); // [debug-enrich]
      _visionKeyWarningShown = true;
    }
    for (const image of pending) {
      image.visionStatus = "skipped";
      image.visionDescription = null;
      console.warn("[vision.runImageVisionAnalysis] Image skipped (no auth):", {
        imageId: image.imageId,
      }); // [debug-enrich]
    }
    return { analyzed: 0, failed: 0 };
  }

  let analyzed = 0;
  let failed = 0;
  let visionCooldownUntil = 0;

  if (!doc.shared.conceptGraph) {
    doc.shared.conceptGraph = { nodes: [], edges: [] };
  }
  const graph = doc.shared.conceptGraph;
  if (!Array.isArray(graph.nodes)) graph.nodes = [];
  if (!Array.isArray(graph.edges)) graph.edges = [];

  for (const image of images) {
    if (image.visionStatus === "ready" || image.visionStatus === "skipped") continue;
    const now = Date.now();
    if (now < visionCooldownUntil) {
      await new Promise((resolve) => setTimeout(resolve, visionCooldownUntil - now));
    }
    ctx.onProgress?.(`Analyzing figure ${image.imageId}…`);
    try {
      const result = await analyzeDocumentImage(image, inventory, {
        docId: doc.docId,
        language: ctx.language,
      });
      if (!result) {
        image.visionStatus = "failed";
        image.visionDescription = null;
        failed += 1;
        console.warn("[vision.runImageVisionAnalysis] Image failed:", {
          imageId: image.imageId,
          visionStatus: "failed",
        }); // [debug-enrich]
        if (failed >= 2 && analyzed === 0) {
          visionCooldownUntil = Date.now() + VISION_429_COOLDOWN_MS;
        }
        await new Promise((resolve) => setTimeout(resolve, VISION_INTER_CALL_DELAY_MS));
        continue;
      }
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
      console.debug("[vision.runImageVisionAnalysis] Image ready:", {
        imageId: image.imageId,
        conceptLinks: image.conceptLinks?.length ?? 0,
      }); // [debug-enrich]
      await new Promise((resolve) => setTimeout(resolve, VISION_INTER_CALL_DELAY_MS));
    } catch (err) {
      image.visionStatus = "failed";
      image.visionDescription = null;
      failed += 1;
      console.warn("[vision.runImageVisionAnalysis] Image error:", {
        imageId: image.imageId,
        message: err?.message || String(err),
        visionStatus: "failed",
      }); // [debug-enrich]
      await new Promise((resolve) => setTimeout(resolve, VISION_INTER_CALL_DELAY_MS));
    }
  }

  doc.shared.conceptInventory = inventory;
  doc.shared.conceptGraph = graph;
  console.info("[vision.runImageVisionAnalysis] Done:", {
    docId: doc.docId,
    imagesDetected: detectedCount,
    sentToGemini: pending.length,
    analyzed,
    failed,
    skipped: images.filter((img) => img.visionStatus === "skipped").length,
  }); // [debug-enrich]
  return { analyzed, failed };
}
