import {
  getValidItems,
  normalizeClozeItem,
  normalizeEpistemicEdge,
  normalizeEpistemicGraph,
  normalizeEpistemicNode,
} from "./normalize.js?v=20260622_6";
import { buildExportFrontmatter } from "../export-format.js?v=20260622_6";

const CLOZE_PACK_RE = /<!--\s*cloze-pack:v1:([A-Za-z0-9+/=]+)\s*-->/;

function encodeCapsule(payload) {
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `<!-- cloze-pack:v1:${b64} -->`;
}

function decodeCapsule(b64) {
  try {
    const json = decodeURIComponent(escape(atob(String(b64 || ""))));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function optionLabel(idx) {
  return String.fromCharCode(65 + idx);
}

function buildItemSection(item, index) {
  const safe = normalizeClozeItem(item);
  if (!safe) return [];
  const lines = [];
  lines.push(`### ${safe.id} · ${safe.item_type} · ${safe.difficulty}`);
  lines.push("");
  lines.push(safe.sentence_with_blank);
  lines.push("");
  const options = Array.isArray(safe.options) ? safe.options : [];
  options.forEach((opt, idx) => {
    const mark = opt.is_correct ? " ?" : "";
    lines.push(`- ${optionLabel(idx)}) ${opt.text}${mark}`);
  });
  lines.push("");
  if (index >= 0) return lines;
  return lines;
}

export function isClozePackMarkdown(text) {
  return CLOZE_PACK_RE.test(String(text || ""));
}

export function buildClozePackPayload(session) {
  const safe = session && typeof session === "object" ? session : {};
  const cloze = safe.cloze && typeof safe.cloze === "object" ? safe.cloze : {};
  const items = (Array.isArray(cloze.items) ? cloze.items : [])
    .map(normalizeClozeItem)
    .filter(Boolean);
  return {
    version: 1,
    studyMode: "cloze",
    language: String(safe.language || "English").trim() || "English",
    llmModel: safe.llmModel || null,
    materialMeta: safe.materialMeta && typeof safe.materialMeta === "object" ? { ...safe.materialMeta } : null,
    cloze: {
      items,
      epistemicGraph: cloze.epistemicGraph || null,
      studyIndex: Number(cloze.studyIndex) || 0,
      studyStats: cloze.studyStats || { correct: 0, shown: 0 },
      studyOrder: Array.isArray(cloze.studyOrder) ? cloze.studyOrder.slice() : null,
      generationMeta: cloze.generationMeta || null,
    },
  };
}

export function buildClozeMarkdown(session) {
  const safe = session && typeof session === "object" ? session : {};
  const valid = getValidItems(safe.cloze?.items || []);
  const lang = String(safe.language || "English").trim() || "English";
  const fileName = String(safe.materialMeta?.fileName || "—").trim() || "—";
  const lines = [];

  const frontmatterSession = {
    ...safe,
    _meta: {
      ...(safe._meta && typeof safe._meta === "object" ? safe._meta : {}),
      item_count: valid.length,
    },
  };

  lines.push(buildExportFrontmatter(frontmatterSession, { mode: "cloze" }));
  lines.push("");
  lines.push("# Cloze Detection Pack");
  lines.push(`Material: ${fileName}`);
  lines.push(`Language: ${lang}`);
  lines.push(`Items: ${valid.length} valid`);
  lines.push("");
  lines.push("## Items");
  lines.push("");

  valid.forEach((item, index) => {
    lines.push(...buildItemSection(item, index));
  });

  lines.push(encodeCapsule(buildClozePackPayload(session)));
  return `${lines.join("\n").trim()}\n`;
}

function sessionFromPackPayload(payload, { sourceName = "" } = {}) {
  if (!payload || typeof payload !== "object") return null;
  if (String(payload.studyMode || "").trim() !== "cloze") return null;
  const clozeRaw = payload.cloze && typeof payload.cloze === "object" ? payload.cloze : {};
  const items = (Array.isArray(clozeRaw.items) ? clozeRaw.items : [])
    .map(normalizeClozeItem)
    .filter(Boolean);
  if (!items.length) return null;

  const materialMeta =
    payload.materialMeta && typeof payload.materialMeta === "object"
      ? { ...payload.materialMeta }
      : {
          fileName: sourceName || "imported-cloze-pack.md",
          originalFormat: "md",
          uploadedAt: new Date().toISOString(),
        };

  return {
    studyMode: "cloze",
    rev: 0,
    language: String(payload.language || "English").trim() || "English",
    llmModel: payload.llmModel || null,
    materialMeta,
    cloze: {
      normalizedText: "",
      normalizedFormat: "markdown",
      pipelineStatus: "ready",
      pipelinePhase: null,
      pipelineError: null,
      epistemicGraph: normalizeEpistemicGraph(clozeRaw.epistemicGraph),
      analysis: null,
      items,
      studyIndex: Number(clozeRaw.studyIndex) || 0,
      studyStats: clozeRaw.studyStats || { correct: 0, shown: 0 },
      studyOrder: Array.isArray(clozeRaw.studyOrder) ? clozeRaw.studyOrder.slice() : null,
      generationMeta: clozeRaw.generationMeta || null,
    },
  };
}

export function parseClozePackMarkdown(text, { sourceName = "" } = {}) {
  const raw = String(text || "");
  const match = raw.match(CLOZE_PACK_RE);
  if (!match?.[1]) {
    return { ok: false, reason: "missing_capsule" };
  }
  const payload = decodeCapsule(match[1]);
  if (!payload) {
    return { ok: false, reason: "invalid_capsule" };
  }
  const session = sessionFromPackPayload(payload, { sourceName });
  if (!session) {
    return { ok: false, reason: "no_items" };
  }
  return { ok: true, session, validCount: getValidItems(session.cloze.items).length };
}

function uniqueItemId(id, used) {
  let candidate = String(id || "").trim() || `item_${used.size + 1}`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let n = 2;
  while (used.has(`${candidate}_${n}`)) n += 1;
  candidate = `${candidate}_${n}`;
  used.add(candidate);
  return candidate;
}

function mergeEpistemicGraphs(graphs) {
  const nodeById = new Map();
  const edgeById = new Map();
  graphs.forEach((g) => {
    if (!g?.nodes?.length) return;
    g.nodes.forEach((n, i) => {
      const node = normalizeEpistemicNode(n, i);
      if (node && !nodeById.has(node.id)) nodeById.set(node.id, node);
    });
    (g.edges || []).forEach((e, i) => {
      const edge = normalizeEpistemicEdge(e, i);
      if (edge && !edgeById.has(edge.id)) edgeById.set(edge.id, edge);
    });
  });
  if (!nodeById.size) return null;
  return {
    nodes: Array.from(nodeById.values()),
    edges: Array.from(edgeById.values()),
  };
}

/** Merge multiple parsed cloze packs into one ready-to-study session. */
export function mergeClozePackSessions(sessions, { label = "" } = {}) {
  const list = (Array.isArray(sessions) ? sessions : []).filter(
    (s) => s?.studyMode === "cloze" && s?.cloze,
  );
  if (!list.length) return null;

  const usedIds = new Set();
  const mergedItems = [];
  const sourceNames = [];
  const graphs = [];

  list.forEach((session) => {
    const name = String(session.materialMeta?.fileName || "").trim();
    if (name) sourceNames.push(name);
    if (session.cloze.epistemicGraph) graphs.push(session.cloze.epistemicGraph);
    (session.cloze.items || []).forEach((item) => {
      const normalized = normalizeClozeItem(item);
      if (!normalized) return;
      const newId = uniqueItemId(normalized.id, usedIds);
      mergedItems.push({ ...normalized, id: newId });
    });
  });

  const valid = getValidItems(mergedItems);
  if (!valid.length) return null;

  const primary = list[0];
  const mergedLabel =
    String(label || "").trim() ||
    (sourceNames.length > 1 ? `${sourceNames.length} packs` : sourceNames[0] || "merged-cloze-pack");

  return {
    studyMode: "cloze",
    rev: 0,
    language: String(primary.language || "English").trim() || "English",
    llmModel: primary.llmModel || null,
    materialMeta: {
      fileName: mergedLabel,
      originalFormat: "md",
      uploadedAt: new Date().toISOString(),
      sourcePacks: sourceNames.length ? sourceNames.slice() : undefined,
    },
    cloze: {
      normalizedText: "",
      normalizedFormat: "markdown",
      pipelineStatus: "ready",
      pipelinePhase: null,
      pipelineError: null,
      epistemicGraph: mergeEpistemicGraphs(graphs),
      analysis: null,
      items: mergedItems,
      studyIndex: 0,
      studyStats: { correct: 0, shown: 0 },
      studyOrder: null,
      generationMeta: {
        importedAt: new Date().toISOString(),
        itemCounts: { total: mergedItems.length, valid: valid.length, packs: list.length },
      },
    },
  };
}

export async function parseClozePackFiles(fileList, readFileAsText) {
  const files = Array.isArray(fileList) ? fileList : [];
  if (!files.length) {
    return { ok: false, reason: "no_files" };
  }
  const sessions = [];
  const errors = [];
  for (const file of files) {
    const name = String(file?.name || "pack.md");
    try {
      const text = await readFileAsText(file);
      const parsed = parseClozePackMarkdown(text, { sourceName: name });
      if (!parsed.ok) {
        errors.push(`${name}: ${parsed.reason}`);
        continue;
      }
      sessions.push(parsed.session);
    } catch (err) {
      errors.push(`${name}: ${err?.message || String(err)}`);
    }
  }
  if (!sessions.length) {
    return { ok: false, reason: "parse_failed", errors };
  }
  const merged = mergeClozePackSessions(sessions);
  if (!merged) {
    return { ok: false, reason: "no_valid_items", errors };
  }
  return {
    ok: true,
    session: merged,
    validCount: getValidItems(merged.cloze.items).length,
    packCount: sessions.length,
    errors,
  };
}
