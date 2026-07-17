/**
 * Gemini embedding client with mandatory Supabase cache (R0).
 * @see specs/20260629-vault-embedding/contracts/embeddings.md
 */

import { geminiEmbedContent, getSupabaseAuthToken, hasPlatformLlmAccess } from "../llm.js?v=20260625_02";
import {
  getEmbeddingOutputDimensionality,
  isVaultEmbeddingsFlagEnabled,
} from "../config/flags.js";
import { EMBEDDING_MODEL_VERSION } from "./embedding-thresholds.js";
import {
  fetchCachedEmbedding,
  upsertConceptEmbedding,
} from "./embedding-persist.js";

export { computeNoveltyScore } from "./embedding-math.js";

/** In-memory fallback when Supabase unavailable (tests / offline). */
const memoryCache = new Map();

/**
 * @param {string} text
 */
export async function hashSourceText(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {object} entry
 */
export function buildConceptEmbedText(entry) {
  const label = String(entry?.label || entry?.term || "").trim();
  const definition = String(entry?.definition || entry?.authorUsage || "").trim();
  if (label && definition) return `${label} ${definition}`.trim();
  return label || definition;
}

export function isVaultEmbeddingsEnabled() {
  return isVaultEmbeddingsFlagEnabled() && hasPlatformLlmAccess();
}

async function readCache(hash) {
  const mem = memoryCache.get(`${EMBEDDING_MODEL_VERSION}:${hash}`);
  if (mem) return mem;
  try {
    return await fetchCachedEmbedding(hash, EMBEDDING_MODEL_VERSION);
  } catch {
    return null;
  }
}

async function writeCache(row) {
  memoryCache.set(`${row.model_version}:${row.source_text_hash}`, row.embedding);
  try {
    await upsertConceptEmbedding(row);
  } catch (err) {
    console.warn("[embeddings] cache persist failed", err?.message || err);
  }
}

/**
 * @param {string} text
 * @param {{ taskType?: string, conceptId?: string, projectId?: string, scopeType?: string }} [options]
 */
export async function embedText(text, options = {}) {
  const sourceText = String(text || "").trim();
  if (!sourceText) {
    // [debug-enrich]
    console.error("[vault.embeddings.embedText] Empty text");
    throw new Error("embedText requires non-empty text");
  }
  const token = await getSupabaseAuthToken();
  if (!token) {
    // [debug-enrich]
    console.error("[vault.embeddings.embedText] No auth token");
    throw new Error("Sign in to use embeddings");
  }

  const sourceTextHash = await hashSourceText(sourceText);
  const cached = await readCache(sourceTextHash);
  if (cached) {
    // [debug-enrich]
    console.debug("[vault.embeddings.embedText] Cache hit:", {
      textLen: sourceText.length,
      dims: Array.isArray(cached) ? cached.length : null,
      conceptId: options.conceptId || null,
    });
    return cached;
  }

  // [debug-enrich]
  console.info("[vault.embeddings.embedText] API call:", {
    textLen: sourceText.length,
    conceptId: options.conceptId || null,
    scopeType: options.scopeType || "concept",
  });
  const outputDimensionality = getEmbeddingOutputDimensionality();
  const taskType = options.taskType || "SEMANTIC_SIMILARITY";
  const json = await geminiEmbedContent({
    model: "models/gemini-embedding-001",
    content: { parts: [{ text: sourceText }] },
    taskType,
    outputDimensionality,
  });
  const values = json?.embedding?.values;
  if (!Array.isArray(values) || !values.length) {
    // [debug-enrich]
    console.error("[vault.embeddings.embedText] Empty vector from Gemini");
    throw new Error("Gemini embed returned empty vector");
  }

  await writeCache({
    concept_id: options.conceptId || null,
    scope_type: options.scopeType || "concept",
    project_id: options.projectId || null,
    source_text: sourceText,
    source_text_hash: sourceTextHash,
    embedding: values,
    model_version: EMBEDDING_MODEL_VERSION,
  });

  // [debug-enrich]
  console.info("[vault.embeddings.embedText] Done:", {
    dims: values.length,
    conceptId: options.conceptId || null,
  });
  return values;
}

/**
 * @param {string[]} texts
 * @param {object} [options]
 */
export async function embedBatch(texts, options = {}) {
  const list = (Array.isArray(texts) ? texts : []).map((t) => String(t || "").trim()).filter(Boolean);
  // [debug-enrich]
  console.info("[vault.embeddings.embedBatch] Start:", { count: list.length });
  const out = [];
  for (const text of list) {
    out.push(await embedText(text, options));
  }
  // [debug-enrich]
  console.info("[vault.embeddings.embedBatch] Done:", { count: out.length });
  return out;
}

/** Test helper — seed memory cache without API. */
export function __seedEmbeddingCacheForTests(hash, vector, modelVersion = EMBEDDING_MODEL_VERSION) {
  memoryCache.set(`${modelVersion}:${hash}`, vector);
}

/** Test helper — clear memory cache. */
export function __clearEmbeddingCacheForTests() {
  memoryCache.clear();
}
