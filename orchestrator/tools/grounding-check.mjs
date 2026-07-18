#!/usr/bin/env node
/**
 * Tier-2 grounding helper.
 * Reads JSON {generated, source} from stdin; writes {cosine}.
 * Offline fallback: token-overlap proxy (no network).
 * Production: wire to gemini-embedding-001 via existing vault embeddings when credentials present.
 */
function tokenOverlap(a, b) {
  const ta = new Set(String(a || "").toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(String(b || "").toLowerCase().split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    payload = {};
  }
  const cosine = tokenOverlap(payload.generated, payload.source);
  process.stdout.write(JSON.stringify({ cosine, method: "token_overlap_proxy" }) + "\n");
});
