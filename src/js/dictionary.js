import { LS_SESSION_CONCEPTS_KEY } from "./config.js?v=20260503_7";
import { state, getBlocksSafe } from "./session.js?v=20260503_7";
import { els, typesetMath } from "./ui.js?v=20260503_7";

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

function normalizeConceptEntry(c) {
  const obj = c && typeof c === "object" ? c : {};
  const term = String(obj.term || "").trim();
  const definition = String(obj.definition || "").trim();
  if (!term) return null;
  return { term, definition };
}

function mergeConceptsIntoStorage(newConcepts) {
  const existing = loadSessionConcepts().map(normalizeConceptEntry).filter(Boolean);
  const incoming = Array.isArray(newConcepts)
    ? newConcepts.map(normalizeConceptEntry).filter(Boolean)
    : [];

  const map = new Map();
  for (const c of existing) map.set(c.term.toLowerCase(), c);
  for (const c of incoming) {
    const key = c.term.toLowerCase();
    if (!map.has(key)) map.set(key, c);
    else {
      const prev = map.get(key);
      if (prev && !prev.definition && c.definition) map.set(key, c);
    }
  }

  const merged = Array.from(map.values()).sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
  );
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
  return loadSessionConcepts()
    .map(normalizeConceptEntry)
    .filter(Boolean)
    .sort((a, b) =>
      a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
    );
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
    defEl.textContent = c ? String(c.definition || "") : "";
    typesetMath(defEl);
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

