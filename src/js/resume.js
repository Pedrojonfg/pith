export function extractResumePayloadFromMarkdown(mdText) {
  const text = String(mdText || "");
  const m = text.match(/<!--\s*study-session-resume:v1:([A-Za-z0-9+/=]+)\s*-->/);
  if (!m || !m[1]) {
    throw new Error(
      "This markdown does not contain resume data (missing <!-- study-session-resume:v1:... -->). Export again from a current session or use a newer export file.",
    );
  }
  let json = "";
  try {
    json = decodeURIComponent(escape(atob(m[1])));
  } catch {
    throw new Error("Could not decode resume data from markdown (corrupt base64).");
  }
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("Could not parse resume JSON inside markdown.");
  }
}
