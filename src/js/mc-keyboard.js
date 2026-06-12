/** Map A–D or 1–4 keys to MC option letter. */
export function letterFromMcKey(key) {
  const raw = String(key ?? "").trim();
  if (/^[1-4]$/.test(raw)) return String.fromCharCode(64 + Number(raw));
  const upper = raw.toUpperCase();
  return upper === "A" || upper === "B" || upper === "C" || upper === "D" ? upper : "";
}

export function isMcTypingTarget(target) {
  const tag = String(target?.tagName ?? "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}
