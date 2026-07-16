/**
 * Pack export — draft snapshots + copyright-safe publish.
 * @see specs/20260716-pack-export-backend
 */

import { getSession } from "./session-store.js";
import { supabase } from "./supabase-client.js";
import { llmChatCompletions as defaultLlmChatCompletions } from "./llm.js";
import { jaccardOverlap } from "./fidelity-validation.js";

/** Exclusive upper bound: overlap >= this fails publish (SC-002). */
export const PACK_REWRITE_JACCARD_MAX = 0.3;

/** ~1.5 output tokens per input char, clamped — one-shot prose rewrite. */
const REWRITE_MAX_TOKENS_FLOOR = 256;
const REWRITE_MAX_TOKENS_CEIL = 4096;

function deepCloneJson(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} session DocumentSession
 * @returns {object} PackSnapshot
 */
export function buildPackSnapshot(session) {
  const sh = session?.shared || {};
  const modes = session?.modes || {};
  return {
    docMeta: deepCloneJson(sh.docMeta ?? null),
    docHierarchy: deepCloneJson(sh.docHierarchy ?? null),
    conceptInventory: deepCloneJson(Array.isArray(sh.conceptInventory) ? sh.conceptInventory : []),
    conceptGraph: deepCloneJson(sh.conceptGraph ?? { nodes: [], edges: [] }),
    modeRecommendation: deepCloneJson(sh.modeRecommendation ?? null),
    modes: {
      rsvp: deepCloneJson(modes.rsvp ?? null),
      questions: deepCloneJson(modes.questions ?? null),
      cloze: deepCloneJson(modes.cloze ?? null),
      recall: deepCloneJson(modes.recall ?? null),
    },
    images: deepCloneJson(Array.isArray(sh.images) ? sh.images : []),
    rawMarkdown: typeof sh.rawMarkdown === "string" ? sh.rawMarkdown : "",
    slowSlice: deepCloneJson(modes.slow ?? null),
  };
}

/**
 * Pure strip for includeSourceDocument=false (before recall rewrite).
 * @param {object} snapshot
 * @returns {object}
 */
export function stripSourceBearingFields(snapshot) {
  const out = deepCloneJson(snapshot) || {};
  delete out.rawMarkdown;
  delete out.slowSlice;
  delete out.images;
  if (out.modes && typeof out.modes === "object") {
    delete out.modes.cloze;
  }
  const inv = Array.isArray(out.conceptInventory) ? out.conceptInventory : [];
  out.conceptInventory = inv.map((item) => {
    if (!item || typeof item !== "object") return item;
    const copy = { ...item };
    delete copy.source_phrase;
    delete copy.sourcePhrase;
    delete copy.anchorRange;
    return copy;
  });
  return out;
}

/**
 * @param {string} original
 * @param {string} rewritten
 * @returns {true}
 */
export function assertRewriteOverlapOk(original, rewritten) {
  const overlap = jaccardOverlap(String(original || ""), String(rewritten || ""));
  if (!(overlap < PACK_REWRITE_JACCARD_MAX)) {
    throw new Error(
      `Pack rewrite overlap too high (${overlap.toFixed(3)} >= ${PACK_REWRITE_JACCARD_MAX}); refusing to publish.`,
    );
  }
  return true;
}

function rewriteMaxTokensForInput(text) {
  const n = String(text || "").length;
  // ponytail: scale with input; ceiling keeps one excerpt bounded
  return Math.min(REWRITE_MAX_TOKENS_CEIL, Math.max(REWRITE_MAX_TOKENS_FLOOR, Math.ceil(n * 1.5)));
}

function buildRewritePrompt(text, context = {}) {
  const kind = context.kind || "recall_excerpt";
  const label = context.conceptLabel ? ` Concept label: ${context.conceptLabel}.` : "";
  return [
    "Reformulate the following excerpt, preserving exact technical content (figures, names, causal relations).",
    "Do not produce a shallow paraphrase that only swaps a few words while keeping the original sentence structure.",
    "The result must not be searchable as a literal match against the original wording.",
    `Kind: ${kind}.${label}`,
    "",
    "Excerpt:",
    String(text || ""),
  ].join("\n");
}

/**
 * @param {string} text
 * @param {{ conceptLabel?: string, kind: 'recall_excerpt'|'vault_definition'|'vault_notes' }} context
 * @param {{ llmChatCompletions?: Function }} [deps]
 * @returns {Promise<string>}
 */
export async function rewritePackExcerpt(text, context, deps = {}) {
  const input = String(text || "").trim();
  if (!input) throw new Error("rewritePackExcerpt: empty input");
  const llm = deps.llmChatCompletions || defaultLlmChatCompletions;
  const content = await llm({
    messages: [
      {
        role: "system",
        content:
          "You rewrite study excerpts for copyright-safe sharing. Preserve technical meaning; avoid verbatim residue.",
      },
      { role: "user", content: buildRewritePrompt(input, context) },
    ],
    temperature: 0.3,
    max_tokens: rewriteMaxTokensForInput(input),
  });
  const out = String(content || "").trim();
  if (!out) throw new Error("rewritePackExcerpt: empty model output");
  return out;
}

/**
 * @param {object} snapshot
 * @param {{ llmChatCompletions?: Function }} deps
 */
async function rewriteRecallSourceChunks(snapshot, deps) {
  const questions = snapshot?.modes?.recall?.questions;
  if (!Array.isArray(questions) || !questions.length) return snapshot;
  for (const q of questions) {
    const chunks = Array.isArray(q.source_chunks) ? q.source_chunks : [];
    const next = [];
    for (const chunk of chunks) {
      const original = String(chunk || "");
      if (!original.trim()) continue;
      const rewritten = await rewritePackExcerpt(original, {
        kind: "recall_excerpt",
        conceptLabel: Array.isArray(q.concept_ids) ? q.concept_ids[0] : undefined,
      }, deps);
      assertRewriteOverlapOk(original, rewritten);
      next.push(rewritten);
    }
    q.source_chunks = next;
  }
  return snapshot;
}

/**
 * @param {string} docId
 * @param {string} ownerUserId
 * @param {{ getSession?: Function, supabase?: object }} [deps]
 */
export async function createPackDraft(docId, ownerUserId, deps = {}) {
  const id = String(docId || "").trim();
  const owner = String(ownerUserId || "").trim();
  if (!id) throw new Error("createPackDraft: docId required");
  if (!owner) throw new Error("createPackDraft: ownerUserId required");

  const getSessionFn = deps.getSession || getSession;
  const db = deps.supabase || supabase;

  const session = await getSessionFn(id);
  if (!session) throw new Error(`createPackDraft: session not found (${id})`);

  const snapshot = buildPackSnapshot(session);
  const title = String(session.shared?.docMeta?.titleInferred || "").trim();

  const { data, error } = await db
    .from("shared_packs")
    .insert({
      owner_user_id: owner,
      source_doc_id: id,
      title,
      status: "draft",
      include_source_document: null,
      code: null,
      snapshot,
      published_at: null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Persist edited snapshot on a draft pack (status must remain draft).
 * @param {string} packDraftId
 * @param {object} snapshot
 * @param {{ supabase?: object }} [deps]
 */
export async function updatePackDraftSnapshot(packDraftId, snapshot, deps = {}) {
  const packId = String(packDraftId || "").trim();
  if (!packId) throw new Error("updatePackDraftSnapshot: packDraftId required");
  if (snapshot == null || typeof snapshot !== "object") {
    throw new Error("updatePackDraftSnapshot: snapshot required");
  }

  const db = deps.supabase || supabase;
  const { data: row, error: loadErr } = await db
    .from("shared_packs")
    .select("*")
    .eq("id", packId)
    .maybeSingle();

  if (loadErr) throw loadErr;
  if (!row) throw new Error(`updatePackDraftSnapshot: pack not found (${packId})`);
  if (row.status !== "draft") {
    throw new Error("updatePackDraftSnapshot: pack is not a draft");
  }

  const { data: updated, error: updErr } = await db
    .from("shared_packs")
    .update({ snapshot: deepCloneJson(snapshot) })
    .eq("id", packId)
    .select()
    .single();

  if (updErr) throw updErr;
  return updated;
}

/**
 * @param {string} packDraftId
 * @param {boolean} includeSourceDocument
 * @param {{ supabase?: object, llmChatCompletions?: Function }} [deps]
 */
export async function finalizePack(packDraftId, includeSourceDocument, deps = {}) {
  const packId = String(packDraftId || "").trim();
  if (!packId) throw new Error("finalizePack: packDraftId required");

  const db = deps.supabase || supabase;
  const { data: row, error: loadErr } = await db
    .from("shared_packs")
    .select("*")
    .eq("id", packId)
    .maybeSingle();

  if (loadErr) throw loadErr;
  if (!row) throw new Error(`finalizePack: pack not found (${packId})`);
  if (row.status !== "draft") throw new Error("finalizePack: pack is not a draft");

  let finalSnapshot = deepCloneJson(row.snapshot);
  if (!includeSourceDocument) {
    finalSnapshot = stripSourceBearingFields(finalSnapshot);
    await rewriteRecallSourceChunks(finalSnapshot, deps);
  }

  const publishedAt = new Date().toISOString();
  const { data: updated, error: updErr } = await db
    .from("shared_packs")
    .update({
      status: "published",
      include_source_document: Boolean(includeSourceDocument),
      snapshot: finalSnapshot,
      published_at: publishedAt,
    })
    .eq("id", packId)
    .select()
    .single();

  if (updErr) throw updErr;
  return updated;
}
