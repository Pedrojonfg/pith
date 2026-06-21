/**
 * Gemini embedding client with mandatory Supabase cache (R0).
 * @see specs/20260629-vault-embedding/contracts/embeddings.md
 */

import { getStoredGeminiKey } from "../llm.js";
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

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

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
  return isVaultEmbeddingsFlagEnabled() && Boolean(getStoredGeminiKey());
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
  if (!sourceText) throw new Error("embedText requires non-empty text");
  const apiKey = getStoredGeminiKey();
  if (!apiKey) throw new Error("Missing Gemini API key for embeddings");

  const sourceTextHash = await hashSourceText(sourceText);
  const cached = await readCache(sourceTextHash);
  if (cached) return cached;

  const outputDimensionality = getEmbeddingOutputDimensionality();
  const taskType = options.taskType || "SEMANTIC_SIMILARITY";
  const url = `${GEMINI_EMBED_URL}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: sourceText }] },
      taskType,
      outputDimensionality,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini embed failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const values = json?.embedding?.values;
  if (!Array.isArray(values) || !values.length) {
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

  return values;
}

/**
 * @param {string[]} texts
 * @param {object} [options]
 */
export async function embedBatch(texts, options = {}) {
  const list = (Array.isArray(texts) ? texts : []).map((t) => String(t || "").trim()).filter(Boolean);
  const out = [];
  for (const text of list) {
    out.push(await embedText(text, options));
  }
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
