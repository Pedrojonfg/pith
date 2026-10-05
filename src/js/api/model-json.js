/** LLM JSON response parsing (shared by api.js). */

export function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractBalancedJsonText(text, openChar, closeChar) {
  const raw = String(text || "").trim();
  const start = raw.indexOf(openChar);
  if (start < 0) return raw;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === openChar) {
      depth += 1;
    } else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }

  return raw.slice(start);
}

function extractJsonObjectText(text) {
  return extractBalancedJsonText(text, "{", "}");
}

function extractJsonArrayText(text) {
  return extractBalancedJsonText(text, "[", "]");
}

function escapeLatexMathBackslashes(text) {
  return String(text || "")
    .replace(/\\\(([\s\S]*?)\\\)/g, (match) => match.replace(/\\/g, "\\\\"))
    .replace(/\\\[([\s\S]*?)\\\]/g, (match) => match.replace(/\\/g, "\\\\"));
}

function escapeInvalidJsonBackslashes(text) {
  return String(text || "").replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

function repairJsonLight(text) {
  return String(text || "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([\]}])/g, "$1");
}

function tryParseJsonCandidate(candidate) {
  if (!candidate) return null;
  const attempts = [
    candidate,
    repairJsonLight(candidate),
    escapeLatexMathBackslashes(candidate),
    escapeInvalidJsonBackslashes(candidate),
    escapeInvalidJsonBackslashes(escapeLatexMathBackslashes(candidate)),
    repairJsonLight(escapeInvalidJsonBackslashes(escapeLatexMathBackslashes(candidate))),
  ];
  for (const text of attempts) {
    try {
      return JSON.parse(text);
    } catch {
      // next repair
    }
  }
  return null;
}

export function parseModelJsonObject(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const extracted = extractJsonObjectText(withoutFence);
  const candidates = [extracted, withoutFence, raw].filter(Boolean);
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidate of uniqueCandidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) return parsed;
  }

  return null;
}

export function parseModelJsonValue(text) {
  const raw = String(text || "").trim();
  const withoutFence = stripJsonFence(raw);
  const extractedArr = extractJsonArrayText(withoutFence);
  const extractedObj = extractJsonObjectText(withoutFence);

  const candidates = [withoutFence, extractedArr, extractedObj, raw].filter(Boolean);
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidate of uniqueCandidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed != null) return parsed;
  }

  return null;
}

function unwrapBlockIndexArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const key of ["blocks", "block_index", "blockIndex", "items", "data"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return null;
}

/** Parse DeepSeek block-split response into a JSON array (or null). */
export function parseBlockIndexFromModelResponse(text) {
  const parsed = parseModelJsonValue(text);
  return unwrapBlockIndexArray(parsed);
}
