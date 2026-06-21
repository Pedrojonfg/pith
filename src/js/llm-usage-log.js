/**
 * Fire-and-forget LLM usage logging (Supabase llm_usage_logs).
 */

import { supabase } from "./supabase-client.js";
import { getAuthUserId } from "./session-persist-supabase.js";

/**
 * @param {{
 *   docId?: string|null,
 *   phase: string,
 *   model: string,
 *   inputTokens?: number|null,
 *   outputTokens?: number|null,
 *   meta?: object|null,
 * }} row
 */
export async function logLlmUsage(row) {
  try {
    const userId = await getAuthUserId();
    const payload = {
      user_id: userId,
      doc_id: row.docId || null,
      phase: String(row.phase || "unknown"),
      model: String(row.model || "unknown"),
      input_tokens: Number.isFinite(row.inputTokens) ? row.inputTokens : null,
      output_tokens: Number.isFinite(row.outputTokens) ? row.outputTokens : null,
      meta: row.meta && typeof row.meta === "object" ? row.meta : null,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("llm_usage_logs").insert(payload);
    if (error) console.warn("[llm-usage-log]", error.message || error);
  } catch (err) {
    console.warn("[llm-usage-log]", err?.message || err);
  }
}
