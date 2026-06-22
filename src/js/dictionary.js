import {
  LS_SESSION_CONCEPTS_KEY,
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
  LS_SESSION_CONCEPT_HIGHLIGHTS_BY_BLOCK_KEY,
} from "./config.js?v=20260622_11";
import { state, getBlocksSafe } from "./session.js?v=20260622_11";
import { renderMarkdown } from "./markdown.js?v=20260622_11";
import { els } from "./ui.js?v=20260622_11";

/** @type {null | (() => void)} */
let dictionaryChromeSyncHook = null;

/** @param {() => void} fn */
export function registerDictionaryChromeSyncHook(fn) {
  dictionaryChromeSyncHook = typeof fn === "function" ? fn : null;
}

function normalizeConceptEntry(c) {
  const obj = c && typeof c === "object" ? c : {};
  const term = String(obj.term || "").trim();
  const definition = String(obj.definition || "").trim();
  if (!term) return null;
  const out = { term, definition };
  const layer = String(obj.layer || "").trim();
  if (layer) out.layer = layer;
  const sourceAnnotationId = String(obj.sourceAnnotationId || "").trim();
  if (sourceAnnotationId) out.sourceAnnotationId = sourceAnnotationId;
  return out;
}

function normalizeDefText(definition) {
  return String(definition || "")
    .trim()
    .replace(/\s+/g, " ");
}

function shouldReplaceConcept(prev, next) {
  const pd = normalizeDefText(prev.definition);
  const nd = normalizeDefText(next.definition);
  if (!nd) return false;
  if (!pd) return true;
  if (nd !== pd) return true;
  return nd.length > pd.length;
}

function conceptsListEqual(a, b) {
  const norm = (list) =>
    [...list]
      .map((c) => `${c.term.toLowerCase()}\0${normalizeDefText(c.definition)}`)
      .sort()
      .join("\n");
  return norm(a) === norm(b);
}

export function normalizeConcepts(concepts) {
  const incoming = Array.isArray(concepts) ? concepts : [];
  return incoming.map(normalizeConceptEntry).filter(Boolean);
}

/** Drop all session dictionary data (new session / new material). */
export function clearSessionConceptStorage() {
  try {
    localStorage.removeItem(LS_SESSION_CONCEPTS_KEY);
    localStorage.removeItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY);
    localStorage.removeItem(LS_SESSION_CONCEPT_HIGHLIGHTS_BY_BLOCK_KEY);
  } catch {
    // ignore
  }
}

/** After resume import: replace storage with payload + per-block concepts. */
export function restoreSessionConceptStorage({ sessionConcepts, blocks } = {}) {
  clearSessionConceptStorage();
  const legacy = normalizeConcepts(sessionConcepts);
  if (legacy.length) saveSessionConcepts(legacy);
  const arr = Array.isArray(blocks) ? blocks : [];
  for (let i = 0; i < arr.length; i += 1) {
    const b = arr[i];
    if (b && typeof b === "object" && Array.isArray(b.concepts) && b.concepts.length) {
      setBlockConcepts(i, b.concepts);
    }
  }
}

export function loadConceptsByBlock() {
  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_BY_BLOCK_KEY);
    if (!raw || !raw.trim()) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

export function saveConceptsByBlock(map) {
  try {
    localStorage.setItem(
      LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
      JSON.stringify(map && typeof map === "object" && !Array.isArray(map) ? map : {}),
    );
  } catch {
    // ignore
  }
}

function loadHighlightsByBlock() {
  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPT_HIGHLIGHTS_BY_BLOCK_KEY);
    if (!raw || !raw.trim()) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function saveHighlightsByBlock(map) {
  try {
    localStorage.setItem(
      LS_SESSION_CONCEPT_HIGHLIGHTS_BY_BLOCK_KEY,
      JSON.stringify(map && typeof map === "object" && !Array.isArray(map) ? map : {}),
    );
  } catch {
    // ignore
  }
}

function saveBlockHighlights(blockIndex, { newKeys, updatedKeys }) {
  const key = String(Math.max(0, Math.floor(Number(blockIndex) || 0)));
  const map = loadHighlightsByBlock();
  map[key] = {
    new: Array.isArray(newKeys) ? newKeys : [],
    updated: Array.isArray(updatedKeys) ? updatedKeys : [],
  };
  saveHighlightsByBlock(map);
}

function getConceptsPriorToBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  // For the first block, everything is "new" relative to prior study.
  // Avoid falling back to legacy session_concepts here since those are often
  // committed from the same block (which would suppress highlights).
  if (idx === 0) return [];
  const map = loadConceptsByBlock();
  const lists = [];
  for (const k of Object.keys(map).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  })) {
    const n = Number(k);
    if (Number.isFinite(n) && n < idx && Array.isArray(map[k])) lists.push(map[k]);
  }
  if (lists.length) return dedupeConcepts(lists);
  return normalizeConcepts(loadSessionConcepts());
}

function computeConceptHighlights(incoming, priorBlock, priorEarlier) {
  const priorByTerm = new Map();
  for (const c of priorEarlier) priorByTerm.set(c.term.toLowerCase(), c.definition);
  const newKeys = [];
  const updatedKeys = [];
  for (const c of incoming) {
    const k = c.term.toLowerCase();
    const inPriorBlock = priorBlock.find((x) => x.term.toLowerCase() === k);
    const priorDef = inPriorBlock ? inPriorBlock.definition : priorByTerm.get(k);
    if (priorDef === undefined) newKeys.push(k);
    else if (normalizeDefText(priorDef) !== normalizeDefText(c.definition)) updatedKeys.push(k);
  }
  return { newKeys, updatedKeys };
}

/** Replace per-block concepts (FR-012). Other block indices unchanged. */
export function setBlockConcepts(blockIndex, concepts) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const key = String(idx);
  const map = loadConceptsByBlock();
  const incoming = normalizeConcepts(concepts);
  const priorBlock = normalizeConcepts(map[key]);
  const changed = !conceptsListEqual(incoming, priorBlock);
  map[key] = incoming;
  saveConceptsByBlock(map);
  if (changed) {
    const priorEarlier = getConceptsPriorToBlock(idx);
    const { newKeys, updatedKeys } = computeConceptHighlights(incoming, priorBlock, priorEarlier);
    saveBlockHighlights(idx, { newKeys, updatedKeys });
  }
}

/** Prefetch ready, regen, and adjust paths (T08). */
export function syncConceptsFromBlock(blockIndex, concepts) {
  setBlockConcepts(blockIndex, concepts);
}

function loadSessionConcepts() {
  try {
    const raw = localStorage.getItem(LS_SESSION_CONCEPTS_KEY);
    if (!raw || !raw.trim()) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSessionConcepts(concepts) {
  try {
    localStorage.setItem(
      LS_SESSION_CONCEPTS_KEY,
      JSON.stringify(Array.isArray(concepts) ? concepts : []),
    );
  } catch {
    // ignore
  }
}

function sortConcepts(concepts) {
  return [...concepts].sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
  );
}

function dedupeConcepts(lists) {
  const map = new Map();
  for (const list of lists) {
    const arr = Array.isArray(list) ? list : [];
    for (const raw of arr) {
      const c = normalizeConceptEntry(raw);
      if (!c) continue;
      const key = c.term.toLowerCase();
      if (!map.has(key)) map.set(key, c);
      else {
        const prev = map.get(key);
        if (prev && shouldReplaceConcept(prev, c)) map.set(key, c);
      }
    }
  }
  return sortConcepts(Array.from(map.values()));
}

function flattenConceptsByBlock() {
  const byBlock = loadConceptsByBlock();
  const keys = Object.keys(byBlock).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const out = [];
  for (const k of keys) {
    const arr = byBlock[k];
    if (Array.isArray(arr)) out.push(...arr);
  }
  return out;
}

function mergeConceptsIntoStorage(newConcepts) {
  const existing = loadSessionConcepts();
  const incoming = Array.isArray(newConcepts) ? newConcepts : [];
  const merged = dedupeConcepts([existing, incoming]);
  saveSessionConcepts(merged);
  return merged;
}

export function commitSessionConceptsForBlock(blockIndex) {
  const blocks = getBlocksSafe();
  const b = blocks[blockIndex];
  if (!b || typeof b !== "object") return;
  const concepts = Array.isArray(b.concepts) ? b.concepts : [];
  if (!concepts.length) return;
  mergeConceptsIntoStorage(concepts);
}

export function getSortedSessionConcepts() {
  const fromBlocks = flattenConceptsByBlock();
  const legacy = loadSessionConcepts();
  return dedupeConcepts([legacy, fromBlocks]);
}

/** T11 — merge enriched-graph user nodes into session_concepts (layer: user). */
export function mergeEnrichedGraphUserNodes(session, userNodes) {
  const incoming = (Array.isArray(userNodes) ? userNodes : [])
    .filter((n) => n && n.layer === "user")
    .map((n) => {
      const label = String(n.label || "").trim();
      if (!label) return null;
      return {
        term: label,
        definition: String(n.sourceAnnotationId || "").trim(),
        layer: "user",
        sourceAnnotationId: String(n.sourceAnnotationId || "").trim() || undefined,
      };
    })
    .filter(Boolean);
  if (!incoming.length) return getSortedSessionConcepts();
  mergeConceptsIntoStorage(incoming);
  if (session?.slow) {
    session.slow.graphNodes = incoming.map((n) => ({
      id: userNodes.find((u) => u.sourceAnnotationId === n.sourceAnnotationId)?.id || n.term,
      label: n.term,
      sourceAnnotationId: n.sourceAnnotationId,
    }));
  }
  return getSortedSessionConcepts();
}

/** Word boundaries for long-press dictionary lookup (letters, digits, accented chars). */
const WORD_CHAR_RE = /[\p{L}\p{N}'’-]/u;

/** @returns {string} */
export function extractWordAtOffset(text, offset) {
  const src = String(text || "");
  const len = src.length;
  if (!len) return "";
  let idx = Math.max(0, Math.min(Math.floor(Number(offset) || 0), len - 1));
  if (!WORD_CHAR_RE.test(src[idx])) {
    const next = src.slice(idx).search(WORD_CHAR_RE);
    if (next < 0) return "";
    idx += next;
  }
  let start = idx;
  while (start > 0 && WORD_CHAR_RE.test(src[start - 1])) start -= 1;
  let end = idx + 1;
  while (end < len && WORD_CHAR_RE.test(src[end])) end += 1;
  return src.slice(start, end).trim();
}

/**
 * Lookup a term in session dictionary + Phase 0 concepts.
 * @returns {{ term: string, definition: string, source: 'session'|'phase0' } | null}
 */
export function lookupSessionTerm(term, { sessionConcepts = [], phase0Concepts = [] } = {}) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return null;
  for (const raw of sessionConcepts) {
    const c = normalizeConceptEntry(raw);
    if (!c) continue;
    if (c.term.toLowerCase() === needle) {
      return { term: c.term, definition: c.definition, source: "session" };
    }
  }
  for (const raw of phase0Concepts) {
    if (!raw || typeof raw !== "object") continue;
    const t = String(raw.term || "").trim();
    if (!t || t.toLowerCase() !== needle) continue;
    const definition = String(raw.authorUsage || raw.definition || "").trim();
    return { term: t, definition, source: "phase0" };
  }
  return null;
}

/** Concepts attributed to one block (concepts_by_block, else block JSON). */
export function getConceptsForBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const key = String(idx);
  const map = loadConceptsByBlock();
  const fromStore = map[key];
  if (Array.isArray(fromStore) && fromStore.length) {
    return normalizeConcepts(fromStore);
  }
  const blocks = getBlocksSafe();
  const b = blocks[idx];
  if (b && typeof b === "object" && Array.isArray(b.concepts) && b.concepts.length) {
    return normalizeConcepts(b.concepts);
  }
  return [];
}

export function getConceptHighlightsForBlock(blockIndex) {
  const idx = Math.max(0, Math.floor(Number(blockIndex) || 0));
  const key = String(idx);
  const entry = loadHighlightsByBlock()[key];
  if (entry && typeof entry === "object") {
    return {
      newKeys: new Set(Array.isArray(entry.new) ? entry.new : []),
      updatedKeys: new Set(Array.isArray(entry.updated) ? entry.updated : []),
    };
  }
  const incoming = getConceptsForBlock(idx);
  const priorEarlier = getConceptsPriorToBlock(idx);
  const { newKeys, updatedKeys } = computeConceptHighlights(incoming, [], priorEarlier);
  return { newKeys: new Set(newKeys), updatedKeys: new Set(updatedKeys) };
}

export function getNewConceptTermKeysForBlock(blockIndex) {
  return getConceptHighlightsForBlock(blockIndex).newKeys;
}

export function renderConceptDictionaryInto({ listEl, defEl, concepts, newTermKeys, updatedTermKeys }) {
  if (!listEl || !defEl) return;
  listEl.innerHTML = "";
  defEl.textContent = "Select a term to see its definition.";

  const arr = Array.isArray(concepts) ? concepts : [];
  const toKeySet = (keys) =>
    keys instanceof Set
      ? keys
      : new Set(
          (Array.isArray(keys) ? keys : []).map((t) =>
            String(t || "")
              .trim()
              .toLowerCase(),
          ),
        );
  const newKeys = toKeySet(newTermKeys);
  const updatedKeys = toKeySet(updatedTermKeys);
  if (!arr.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.style.padding = "10px";
    empty.textContent = "No concepts yet.";
    listEl.appendChild(empty);
    return;
  }

  let selectedKey = null;
  const setSelected = (key) => {
    selectedKey = key;
    const buttons = Array.from(listEl.querySelectorAll("button"));
    for (const b of buttons) {
      b.setAttribute("aria-pressed", String(b.dataset.key === selectedKey));
    }
    const c = arr.find((x) => x.term.toLowerCase() === selectedKey);
    if (c) void renderMarkdown(defEl, String(c.definition || ""));
    else defEl.textContent = "";
  };

  for (const c of arr) {
    const btn = document.createElement("button");
    btn.type = "button";
    const key = c.term.toLowerCase();
    let className = "dict-item";
    if (updatedKeys.has(key)) className += " dict-item--updated";
    if (newKeys.has(key)) className = "dict-item dict-item--new";
    btn.className = className;
    btn.textContent = c.term;
    btn.dataset.key = key;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => setSelected(key));
    listEl.appendChild(btn);
    if (!selectedKey) selectedKey = key;
  }

  if (selectedKey) setSelected(selectedKey);
}

export function renderDictionary({
  containerEl,
  title,
  concepts,
  collapsedByDefault,
  newTermKeys,
  updatedTermKeys,
} = {}) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  const arr = Array.isArray(concepts) ? concepts : [];
  const n = arr.length;
  const safeTitle = String(title || "").trim() || `Concepts so far (${n} terms)`;

  const details = document.createElement("details");
  details.open = !collapsedByDefault;

  const summary = document.createElement("summary");
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "600";
  summary.textContent = safeTitle;

  const panel = document.createElement("div");
  panel.className = "dict-panel";
  panel.style.marginTop = "10px";

  const listEl = document.createElement("div");
  listEl.className = "dict-list";

  const defEl = document.createElement("div");
  defEl.className = "dict-definition";
  defEl.textContent = "Select a term to see its definition.";

  panel.appendChild(listEl);
  panel.appendChild(defEl);

  details.appendChild(summary);
  details.appendChild(panel);
  containerEl.appendChild(details);

  renderConceptDictionaryInto({ listEl, defEl, concepts: arr, newTermKeys, updatedTermKeys });
}

export function setDictionaryOverlayOpen(isOpen) {
  els.dictionaryOverlay.setAttribute("aria-hidden", String(!isOpen));
}

export function updateDictionaryButtonVisibility() {
  const concepts = getSortedSessionConcepts();
  const any = concepts.length > 0;
  const inSession =
    els.screenSocratic.getAttribute("aria-hidden") === "false" ||
    els.screenTest.getAttribute("aria-hidden") === "false";
  const okBlock = state.activeBlockIndex >= 1;
  dictionaryChromeSyncHook?.();
}

export function renderBetweenBlocksDictionary() {
  // screenBetweenBlocks removed — no-op.
}
