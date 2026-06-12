/**
 * Cross-block coverage manifest for pipeline levers L16/L22.
 */

export function renderCoverageManifestForPrompt(coverageManifest = []) {
  const entries = Array.isArray(coverageManifest) ? coverageManifest : [];
  if (!entries.length) {
    return "ALREADY COVERED IN PRIOR BLOCKS:\n(none yet)";
  }
  const lines = entries.map((e, i) => {
    const terms = Array.isArray(e.keyTerms) ? e.keyTerms.join(", ") : "";
    const q = String(e.questionAsked || "").trim();
    const type = String(e.claimType || "claim").trim();
    return `${i + 1}. [${type}] ${terms ? `terms: ${terms}` : ""}${q ? ` — asked: ${q}` : ""}`.trim();
  });
  return `ALREADY COVERED IN PRIOR BLOCKS (do not re-teach as new material):\n${lines.join("\n")}`;
}

export function buildCoverageManifest(session) {
  const meta = session?._meta;
  if (!meta || typeof meta !== "object") return [];
  return Array.isArray(meta.coverageManifest) ? meta.coverageManifest : [];
}
