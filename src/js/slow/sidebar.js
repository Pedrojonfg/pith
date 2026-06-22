import { storeActiveSession } from "../session.js?v=20260622_11";
import { getSortedSessionConcepts } from "../dictionary.js?v=20260622_11";
import { ANNOTATION_TYPES } from "./annotations.js?v=20260622_11";
import { charOffsetToPage } from "./pagination.js?v=20260622_11";
import { slugGraphTermId } from "./phase0.js?v=20260622_11";

const TYPE_LABELS_ES = {
  "˜": "Paráfrasis",
  "?": "Pregunta",
  "?": "Autoexplicación",
  "?": "Conexión",
  "?": "Preguntar a IA",
  "?": "Objeción",
  "?": "Tensión",
  "?": "Debilidad",
  "?": "Fortaleza",
  "?": "Steel man",
  "ia-query": "Consulta IA",
  "??": "Marcador",
  "?": "Insight",
  "?": "Retorno",
  "??": "Grafo",
};

const TYPE_ORDER = new Map(ANNOTATION_TYPES.map((t, i) => [t.symbol, i]));

/** @type {null | (() => object|null)} */
let sessionGetter = null;
/** @type {null | ((session: object, ann: object) => void)} */
let iaReplyViewer = null;
let toggleWired = false;
let iaInputWired = false;

export function setIAReplyViewer(fn) {
  iaReplyViewer = typeof fn === "function" ? fn : null;
}

export function typeLabelEs(symbol) {
  return TYPE_LABELS_ES[symbol] || ANNOTATION_TYPES.find((t) => t.symbol === symbol)?.label || String(symbol || "");
}

export function annotationExcerpt(scopeText, ann, maxLen = 40) {
  const fromUser = String(ann?.userText || "").trim();
  const fromScope = String(scopeText || "").slice(ann?.charStart ?? 0, ann?.charEnd ?? 0).trim();
  const raw = fromUser || fromScope;
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function groupAnnotationsByType(annotations) {
  const groups = new Map();
  for (const ann of annotations || []) {
    const type = String(ann?.type || "˜");
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(ann);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const oa = TYPE_ORDER.get(a) ?? 999;
    const ob = TYPE_ORDER.get(b) ?? 999;
    return oa - ob;
  });
}

export function collectDictionaryTerms(session, sessionConcepts = []) {
  const map = new Map();
  for (const c of session?.slow?.phase0?.conceptsToFind || []) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    map.set(term.toLowerCase(), { term, definition: String(c?.authorUsage || "").trim(), source: "phase0" });
  }
  for (const c of sessionConcepts || []) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { term, definition: String(c?.definition || "").trim(), source: "session" });
    }
  }
  return [...map.values()].sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
}

export function resolveSidebarOpen(session) {
  if (session?.slow?.sidebarOpen !== undefined) return Boolean(session.slow.sidebarOpen);
  if (typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)")?.matches) {
    return false;
  }
  return true;
}

function layoutEl() {
  return document.getElementById("slowReaderLayout");
}

function sidebarEl() {
  return document.getElementById("slowReaderSidebar");
}

function tabEl() {
  return document.getElementById("slowSidebarTab");
}

export function applySidebarOpenState(session) {
  const open = resolveSidebarOpen(session);
  const layout = layoutEl();
  const sidebar = sidebarEl();
  const tab = tabEl();
  if (layout) layout.classList.toggle("sidebar-open", open);
  if (sidebar) sidebar.hidden = !open;
  if (tab) tab.hidden = open;
}

async function setSidebarOpen(session, open) {
  if (!session?.slow) return;
  session.slow.sidebarOpen = Boolean(open);
  applySidebarOpenState(session);
  await storeActiveSession(session);
}

export function renderSlowSidebar(session, { breakpoints = [], scopeText = "" } = {}) {
  if (!session?.slow) return;

  applySidebarOpenState(session);

  const annHost = document.getElementById("slowSidebarAnnotations");
  const dictHost = document.getElementById("slowSidebarDictionary");
  const iaQueriesHost = document.getElementById("slowSidebarIAQueries");
  if (!annHost || !dictHost || !iaQueriesHost) return;

  const annotations = Array.isArray(session.slow.annotations) ? session.slow.annotations : [];
  const groups = groupAnnotationsByType(annotations);

  annHost.innerHTML = "";
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "slow-sidebar-empty";
    empty.textContent = "Sin anotaciones todavía.";
    annHost.appendChild(empty);
  } else {
    for (const [type, items] of groups) {
      const group = document.createElement("details");
      group.className = "slow-sidebar-ann-group";
      group.open = true;

      const summary = document.createElement("summary");
      summary.className = "slow-sidebar-ann-group-title";
      summary.textContent = `${type} ${typeLabelEs(type)} (${items.length})`;
      group.appendChild(summary);

      const list = document.createElement("ul");
      list.className = "slow-sidebar-ann-list";
      for (const ann of items) {
        const page = charOffsetToPage(breakpoints, ann.charStart) + 1;
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slow-sidebar-ann-item";
        btn.dataset.annId = ann.id;
        btn.title = annotationExcerpt(scopeText, ann, 200);
        btn.innerHTML = `<span class="slow-sidebar-ann-symbol">${type}</span><span class="slow-sidebar-ann-excerpt">${annotationExcerpt(scopeText, ann)}</span><span class="slow-sidebar-ann-page">p.${page}</span>`;
        btn.addEventListener("click", () => jumpToAnnotation(session, ann));
        li.appendChild(btn);
        list.appendChild(li);
      }
      group.appendChild(list);
      annHost.appendChild(group);
    }
  }

  const terms = collectDictionaryTerms(session, getSortedSessionConcepts());
  dictHost.innerHTML = "";
  if (!terms.length) {
    const li = document.createElement("li");
    li.className = "slow-sidebar-empty";
    li.textContent = "Sin términos todavía.";
    dictHost.appendChild(li);
  } else {
    for (const t of terms) {
      const li = document.createElement("li");
      li.className = "slow-sidebar-dict-term";
      li.innerHTML = `<span class="slow-sidebar-dict-term-name">${t.term}</span>`;
      if (t.definition) {
        const def = document.createElement("span");
        def.className = "slow-sidebar-dict-term-def";
        def.textContent = t.definition;
        li.appendChild(def);
      }
      dictHost.appendChild(li);
    }
  }

  const iaQueries = annotations.filter(
    (a) => a.type === "?" || a.type === "ia-query" || (a.type === "?" && a.aiReply),
  );
  iaQueriesHost.innerHTML = "";
  if (!iaQueries.length) {
    const li = document.createElement("li");
    li.className = "slow-sidebar-empty";
    li.textContent = "Sin consultas todavía.";
    iaQueriesHost.appendChild(li);
  } else {
    for (const q of iaQueries) {
      const li = document.createElement("li");
      li.className = "slow-sidebar-ia-query";
      const label = q.userText || annotationExcerpt(scopeText, q, 80);
      if (iaReplyViewer && q.aiReply) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slow-sidebar-ia-query-btn";
        btn.textContent = label;
        btn.addEventListener("click", () => iaReplyViewer(session, q));
        li.appendChild(btn);
      } else {
        li.textContent = label;
      }
      iaQueriesHost.appendChild(li);
    }
  }
}

/** @type {null | ((session: object, annotation: object) => void)} */
let annotationNavigator = null;

export function setAnnotationNavigator(fn) {
  annotationNavigator = typeof fn === "function" ? fn : null;
}

/** Tap-to-source: navigate to page + pulse highlight (wired from reader.js). */
export function jumpToAnnotation(session, annotation) {
  annotationNavigator?.(session, annotation);
}

export function wireSidebarIAInput(getSession, onSubmit) {
  if (iaInputWired) return;
  const input = document.getElementById("slowSidebarIAInput");
  if (!input || typeof onSubmit !== "function") return;
  iaInputWired = true;
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    const session = typeof getSession === "function" ? getSession() : null;
    if (!session?.slow) return;
    input.value = "";
    void onSubmit(session, query);
  });
}

/** Concepts available for ? graph link picker. */
export function buildConceptPickerOptions(session) {
  const map = new Map();
  for (const c of getSortedSessionConcepts()) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = slugGraphTermId(term);
    if (!termId) continue;
    map.set(termId, {
      term,
      termId,
      definition: String(c?.definition || "").trim(),
      source: "session",
    });
  }
  for (const c of session?.slow?.phase0?.conceptsToFind || []) {
    const term = String(c?.term || "").trim();
    if (!term) continue;
    const termId = String(c?.graphTermId || slugGraphTermId(term)).trim();
    if (!termId) continue;
    if (!map.has(termId)) {
      map.set(termId, {
        term,
        termId,
        definition: String(c?.authorUsage || "").trim(),
        source: "phase0",
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.term.localeCompare(b.term, undefined, { sensitivity: "base" }),
  );
}

function positionFloatingPanel(panel, rect) {
  if (!panel || !rect) return;
  panel.hidden = false;
  panel.style.visibility = "hidden";
  panel.style.top = "0";
  panel.style.left = "0";
  const pad = 10;
  const anchor = rect.width || rect.height ? rect : { top: 120, bottom: 140, left: window.innerWidth / 2, width: 0, height: 0 };
  const panelRect = panel.getBoundingClientRect();
  let top = anchor.bottom + pad;
  let left = anchor.left + anchor.width / 2 - panelRect.width / 2;
  if (top + panelRect.height > window.innerHeight - 12) {
    top = anchor.top - panelRect.height - pad;
  }
  left = Math.max(12, Math.min(left, window.innerWidth - panelRect.width - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - panelRect.height - 12));
  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
  panel.style.visibility = "";
}

function ensureConceptPicker() {
  let picker = document.getElementById("slowConceptPicker");
  if (picker) return picker;
  picker = document.createElement("div");
  picker.id = "slowConceptPicker";
  picker.className = "slow-concept-picker";
  picker.hidden = true;
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-modal", "true");
  picker.setAttribute("aria-labelledby", "slowConceptPickerTitle");
  picker.innerHTML = `
    <p id="slowConceptPickerTitle" class="slow-concept-picker-title">Conectar con concepto</p>
    <ul class="slow-concept-picker-list" role="listbox"></ul>
    <button type="button" class="slow-concept-picker-cancel">Cancelar</button>
  `;
  document.body.appendChild(picker);
  return picker;
}

export function hideConceptPicker() {
  const picker = document.getElementById("slowConceptPicker");
  if (picker) picker.hidden = true;
}

/**
 * @returns {Promise<{ term: string, termId: string } | null>}
 */
export function showConceptPicker(session, { anchorRect } = {}) {
  const options = buildConceptPickerOptions(session);
  if (!options.length) return Promise.resolve(null);

  const picker = ensureConceptPicker();
  const list = picker.querySelector(".slow-concept-picker-list");
  const cancelBtn = picker.querySelector(".slow-concept-picker-cancel");
  if (!list || !cancelBtn) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      picker.hidden = true;
      list.innerHTML = "";
      cancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeydown);
      resolve(value);
    };
    const onCancel = () => finish(null);
    const onKeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    };

    list.innerHTML = "";
    for (const opt of options) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slow-concept-picker-item";
      btn.setAttribute("role", "option");
      btn.innerHTML = `<span class="slow-concept-picker-term">${opt.term}</span>${opt.definition ? `<span class="slow-concept-picker-def">${opt.definition}</span>` : ""}`;
      btn.addEventListener("click", () => finish({ term: opt.term, termId: opt.termId }));
      li.appendChild(btn);
      list.appendChild(li);
    }

    cancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeydown);
    positionFloatingPanel(picker, anchorRect);
    list.querySelector("button")?.focus();
  });
}

export function wireSidebarToggle(getSession) {
  sessionGetter = typeof getSession === "function" ? getSession : sessionGetter;

  const collapseBtn = document.getElementById("slowSidebarCollapseBtn");
  const tab = tabEl();

  if (!toggleWired) {
    toggleWired = true;
    collapseBtn?.addEventListener("click", () => {
      const session = sessionGetter?.();
      if (session) setSidebarOpen(session, false);
    });
    tab?.addEventListener("click", () => {
      const session = sessionGetter?.();
      if (session) setSidebarOpen(session, true);
    });
  }

  const session = sessionGetter?.();
  if (session) applySidebarOpenState(session);
}
