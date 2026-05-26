import {
  LS_SESSION_CONCEPTS_KEY,
  LS_SESSION_CONCEPTS_BY_BLOCK_KEY,
} from "./config.js?v=20260527_1";
import { state, getBlocksSafe } from "./session.js?v=20260527_1";
import { renderMarkdown } from "./markdown.js?v=20260525_1";
import { els } from "./ui.js?v=20260525_1";

function normalizeConceptEntry(c) {
  const obj = c && typeof c === "object" ? c : {};
  const term = String(obj.term || "").trim();
  const definition = String(obj.definition || "").trim();
  if (!term) return null;
  return { term, definition };
}

export function normalizeConcepts(concepts) {
  const incoming = Array.isArray(concepts) ? concepts : [];
  return incoming.map(normalizeConceptEntry).filter(Boolean);
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

/** Replace per-block concepts (FR-012). Other block indices unchanged. */
export function setBlockConcepts(blockIndex, concepts) {
  const key = String(Math.max(0, Math.floor(Number(blockIndex) || 0)));
  const map = loadConceptsByBlock();
  map[key] = normalizeConcepts(concepts);
  saveConceptsByBlock(map);
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
        if (prev && !prev.definition && c.definition) map.set(key, c);
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
  return dedupeConcepts([fromBlocks, legacy]);
}

export function renderConceptDictionaryInto({ listEl, defEl, concepts }) {
  if (!listEl || !defEl) return;
  listEl.innerHTML = "";
  defEl.textContent = "Select a term to see its definition.";

  const arr = Array.isArray(concepts) ? concepts : [];
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
    btn.className = "dict-item";
    btn.textContent = c.term;
    const key = c.term.toLowerCase();
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

  renderConceptDictionaryInto({ listEl, defEl, concepts: arr });
}

export function setDictionaryOverlayOpen(isOpen) {
  els.dictionaryOverlay.setAttribute("aria-hidden", String(!isOpen));
}

export function updateDictionaryButtonVisibility() {
  if (!els.dictionaryBtn) return;
  const concepts = getSortedSessionConcepts();
  const any = concepts.length > 0;
  const inSession =
    els.screenSocratic.getAttribute("aria-hidden") === "false" ||
    els.screenTest.getAttribute("aria-hidden") === "false" ||
    els.screenBetweenBlocks.getAttribute("aria-hidden") === "false";
  const okBlock = state.activeBlockIndex >= 1;
  els.dictionaryBtn.hidden = !(any && inSession && okBlock);
}

export function renderBetweenBlocksDictionary({ nextBlockIndex }) {
  const concepts = getSortedSessionConcepts();
  const shouldShow = Number(nextBlockIndex) >= 1 && concepts.length > 0;
  els.betweenBlocksDictionaryWrap.hidden = !shouldShow;
  if (!shouldShow) return;
  renderConceptDictionaryInto({
    listEl: els.betweenBlocksDictList,
    defEl: els.betweenBlocksDictDef,
    concepts,
  });
}
