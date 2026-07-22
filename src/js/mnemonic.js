/**
 * User-authored mnemonic devices — local CRUD, floating chrome, review helpers.
 * @see specs/20260619-mnemonic-devices/
 */

import { getActiveSession, saveActiveSession } from "./session-store.js";
import { getConceptDisplayName } from "./concept-graph/concept-display.js";

export const MNEMONIC_BTN_POS_KEY = "pith_mnemonic_btn_pos";
export const MNEMONIC_BTN_VISIBLE_KEY = "pith_mnemonic_btn_visible";
export const MNEMONIC_TEXT_MAX = 500;

const MNEMONIC_HIDDEN_SCREENS = new Set([
  "appHome",
  "settings",
  "docLibrary",
  "vaultBranch",
  "createSessionStart",
  "uploadToVaultCandidates",
]);

const VALID_CREATED_MODES = new Set(["rsvp", "questions", "slow", "cloze", "recall", "review"]);

/** @type {(() => Promise<string[]>) | null} */
let resolveActiveConceptIds = null;
/** @type {(() => string) | null} */
let resolveStudyMode = null;
/** @type {(() => string) | null} */
let resolveScreenId = null;

let panelOpen = false;
/** @type {string[]} */
let panelConceptIds = [];
/** @type {string | null} */
let panelEditId = null;
/** @type {"form" | "pick"} */
let panelView = "form";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {unknown} raw
 */
export function normalizeMnemonicDevice(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = String(raw.text || "").trim();
  const conceptIds = [
    ...new Set(
      (Array.isArray(raw.conceptIds) ? raw.conceptIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!text || !conceptIds.length) return null;
  const now = Date.now();
  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : now;
  const mode = String(raw.createdInMode || "").trim();
  return {
    id: String(raw.id || crypto.randomUUID()).trim(),
    text: text.slice(0, MNEMONIC_TEXT_MAX),
    conceptIds,
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    createdInMode: VALID_CREATED_MODES.has(mode) ? mode : "rsvp",
  };
}

/**
 * @param {object | null | undefined} session
 */
export function getMnemonicDevices(session) {
  const list = session?.shared?.mnemonicDevices;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeMnemonicDevice).filter(Boolean);
}

/**
 * @param {object | null | undefined} session
 * @param {string} conceptId
 */
export function getDevicesForConcept(session, conceptId) {
  const id = String(conceptId || "").trim();
  if (!id) return [];
  return getMnemonicDevices(session).filter((d) => d.conceptIds.includes(id));
}

/**
 * @param {object | null | undefined} session
 * @param {string} conceptId
 */
export function conceptHasMnemonic(session, conceptId) {
  return getDevicesForConcept(session, conceptId).length > 0;
}

/**
 * @param {object[]} inventory
 * @param {string} conceptId
 */
export function conceptLabelFromInventory(inventory, conceptId) {
  const id = String(conceptId || "").trim();
  const hit = (Array.isArray(inventory) ? inventory : []).find(
    (c) => String(c?.canonicalId || c?.id || "").trim() === id,
  );
  return String(hit?.label || hit?.term || id).trim() || id;
}

/**
 * @param {object} item
 * @param {object | null | undefined} session
 */
export function resolveSmItemConceptIds(item, session) {
  if (!item || typeof item !== "object") return [];
  const explicit = String(item.conceptId || "").trim();
  if (explicit) return [explicit];

  const sourceType = String(item.sourceType || "").trim();
  const sourceId = String(item.sourceId || "").trim();

  if (sourceType === "recall_question" && sourceId.includes(":")) {
    const tail = sourceId.split(":").slice(1).join(":").trim();
    return tail ? [tail] : [];
  }

  if (sourceType === "cloze_item" && session) {
    const cloze = session.modes?.cloze?.cloze || session.modes?.cloze;
    const items = cloze?.items || [];
    const hit = items.find((row) => String(row?.id || "").trim() === sourceId);
    const cid = String(hit?.concept_id || hit?.conceptId || "").trim();
    return cid ? [cid] : [];
  }

  if (sourceType === "rsvp_block" && session) {
    const blocks = session.modes?.rsvp?.blocks || session.modes?.questions?.blocks || [];
    let block = blocks.find(
      (b) => String(b?.block_id || b?.id || "").trim() === sourceId,
    );
    if (!block && /^\d+$/.test(sourceId)) {
      block = blocks[Number(sourceId)];
    }
    const ids = Array.isArray(block?.concept_ids)
      ? block.concept_ids
      : Array.isArray(block?.concepts)
        ? block.concepts.map((c) => c?.canonicalId || c?.id || c).filter(Boolean)
        : [];
    return [...new Set(ids.map(String).filter(Boolean))];
  }

  if (sourceType === "global_concept") {
    const gid = String(item.globalConceptId || item.conceptId || sourceId).trim();
    if (!gid || !session) return gid ? [gid] : [];
    const inv = session.shared?.conceptInventory || [];
    const match = inv.find((c) => String(c?.globalConceptId || "").trim() === gid);
    const cid = String(match?.canonicalId || gid).trim();
    return cid ? [cid] : [];
  }

  if (sourceType === "vault_concept" && session) {
    const inv = session.shared?.conceptInventory || [];
    const match = inv.find(
      (c) =>
        String(c?.globalConceptId || "").trim() === sourceId ||
        String(c?.canonicalId || "").trim() === sourceId,
    );
    if (match?.canonicalId) return [String(match.canonicalId)];
    return sourceId ? [sourceId] : [];
  }

  return sourceId ? [sourceId] : [];
}

/**
 * @param {object[]} items
 * @param {(docId: string) => object | null} getSessionFn
 */
export async function filterSmItemsByMnemonics(items, getSessionFn) {
  const list = Array.isArray(items) ? items : [];
  const out = [];
  for (const item of list) {
    const docId = String(item?.docId || "").trim();
    if (!docId) continue;
    const session = await Promise.resolve(getSessionFn(docId));
    if (!session) continue;
    const conceptIds = resolveSmItemConceptIds(item, session);
    if (conceptIds.some((cid) => conceptHasMnemonic(session, cid))) out.push(item);
  }
  return out;
}

/**
 * @param {object} session
 * @param {object} partial
 */
export async function upsertMnemonicDevice(session, partial) {
  if (!session?.shared) throw new Error("session.shared required");
  const inventoryIds = new Set(
    (session.shared.conceptInventory || [])
      .map((c) => String(c?.canonicalId || c?.id || "").trim())
      .filter(Boolean),
  );
  const filteredConceptIds = (Array.isArray(partial.conceptIds) ? partial.conceptIds : [])
    .map((id) => String(id || "").trim())
    .filter((id) => inventoryIds.has(id));
  const device = normalizeMnemonicDevice({
    ...partial,
    conceptIds: filteredConceptIds,
    updatedAt: Date.now(),
  });
  if (!device) throw new Error("invalid mnemonic device");

  const devices = getMnemonicDevices(session);
  const idx = devices.findIndex((d) => d.id === device.id);
  if (idx >= 0) {
    device.createdAt = devices[idx].createdAt;
    device.createdInMode = devices[idx].createdInMode;
    devices[idx] = device;
  } else {
    devices.push(device);
  }
  session.shared.mnemonicDevices = devices;
  await saveActiveSession(session);
  return device;
}

/**
 * @param {object} session
 * @param {string} id
 */
export async function deleteMnemonicDevice(session, id) {
  const deviceId = String(id || "").trim();
  if (!session?.shared || !deviceId) return false;
  const next = getMnemonicDevices(session).filter((d) => d.id !== deviceId);
  if (next.length === getMnemonicDevices(session).length) return false;
  session.shared.mnemonicDevices = next;
  await saveActiveSession(session);
  return true;
}

function seenConceptIds(session) {
  const seen = new Set();
  for (const sig of session?.shared?.assessmentSignals || []) {
    const id = String(sig?.canonicalId || "").trim();
    if (id) seen.add(id);
  }
  for (const item of session?.shared?.smItems || []) {
    for (const cid of resolveSmItemConceptIds(item, session)) {
      seen.add(cid);
    }
  }
  return seen;
}

/**
 * @param {object[]} inventory
 * @param {string} query
 * @param {{ attached?: Set<string>, seen?: Set<string> }} [opts]
 */
export function searchConceptInventory(inventory, query, opts = {}) {
  const q = String(query || "").trim().toLowerCase();
  const attached = opts.attached || new Set();
  const seen = opts.seen || new Set();
  const rows = (Array.isArray(inventory) ? inventory : [])
    .map((c) => ({
      id: String(c?.canonicalId || c?.id || "").trim(),
      label: getConceptDisplayName(c),
    }))
    .filter((c) => c.id && c.label && !attached.has(c.id))
    .filter((c) => !q || c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));

  rows.sort((a, b) => {
    const aSeen = seen.has(a.id) ? 0 : 1;
    const bSeen = seen.has(b.id) ? 0 : 1;
    if (aSeen !== bSeen) return aSeen - bSeen;
    return a.label.localeCompare(b.label);
  });
  return rows.slice(0, 12);
}

export function isMnemonicButtonVisiblePref() {
  try {
    const raw = localStorage.getItem(MNEMONIC_BTN_VISIBLE_KEY);
    if (raw == null) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

export function setMnemonicButtonVisiblePref(visible) {
  try {
    localStorage.setItem(MNEMONIC_BTN_VISIBLE_KEY, visible ? "true" : "false");
  } catch {
    // ignore
  }
}

function loadButtonPos() {
  try {
    const raw = localStorage.getItem(MNEMONIC_BTN_POS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const x = Number(obj?.x);
    const y = Number(obj?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function saveButtonPos(x, y) {
  try {
    localStorage.setItem(MNEMONIC_BTN_POS_KEY, JSON.stringify({ x, y }));
  } catch {
    // ignore
  }
}

function clampPos(x, y, btn) {
  const w = btn?.offsetWidth || 44;
  const h = btn?.offsetHeight || 44;
  const win = typeof window !== "undefined" ? window : null;
  const vw = win?.innerWidth || 1024;
  const vh = win?.innerHeight || 768;
  const maxX = Math.max(8, vw - w - 8);
  const maxY = Math.max(8, vh - h - 8);
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  };
}

function applyButtonPos(btn) {
  if (!btn) return;
  const win = typeof window !== "undefined" ? window : null;
  if (!win?.innerWidth) return;
  const stored = loadButtonPos();
  const defaultX = win.innerWidth - 56;
  const defaultY = win.innerHeight - 120;
  const { x, y } = clampPos(stored?.x ?? defaultX, stored?.y ?? defaultY, btn);
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
}

function wireButtonDrag(btn) {
  if (!btn || btn.dataset.mnemonicDragWired === "1") return;
  btn.dataset.mnemonicDragWired = "1";
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  btn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    const rect = btn.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    btn.setPointerCapture(e.pointerId);
    btn.classList.add("mnemonic-btn-dragging");
  });

  btn.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const { x, y } = clampPos(e.clientX - offsetX, e.clientY - offsetY, btn);
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
  });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    btn.classList.remove("mnemonic-btn-dragging");
    try {
      btn.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const x = parseFloat(btn.style.left) || 0;
    const y = parseFloat(btn.style.top) || 0;
    saveButtonPos(x, y);
  };

  btn.addEventListener("pointerup", endDrag);
  btn.addEventListener("pointercancel", endDrag);
}

function getPanelEls() {
  return {
    root: document.getElementById("mnemonicPanel"),
    title: document.getElementById("mnemonicPanelTitle"),
    pickList: document.getElementById("mnemonicPickList"),
    chips: document.getElementById("mnemonicConceptChips"),
    search: document.getElementById("mnemonicConceptSearch"),
    dropdown: document.getElementById("mnemonicConceptDropdown"),
    text: document.getElementById("mnemonicTextInput"),
    saveBtn: document.getElementById("mnemonicSaveBtn"),
    cancelBtn: document.getElementById("mnemonicCancelBtn"),
    deleteBtn: document.getElementById("mnemonicDeleteBtn"),
    newBtn: document.getElementById("mnemonicNewBtn"),
    formView: document.getElementById("mnemonicFormView"),
    pickView: document.getElementById("mnemonicPickView"),
  };
}

function renderConceptChips(session) {
  const { chips } = getPanelEls();
  if (!chips) return;
  const inventory = session?.shared?.conceptInventory || [];
  chips.innerHTML = panelConceptIds
    .map((id) => {
      const label = conceptLabelFromInventory(inventory, id);
      return `<span class="mnemonic-chip" data-concept-id="${escapeHtml(id)}">${escapeHtml(label)}<button type="button" class="mnemonic-chip-remove" aria-label="Remove ${escapeHtml(label)}">×</button></span>`;
    })
    .join("");

  chips.querySelectorAll(".mnemonic-chip-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chip = btn.closest(".mnemonic-chip");
      const cid = chip?.getAttribute("data-concept-id") || "";
      panelConceptIds = panelConceptIds.filter((x) => x !== cid);
      renderConceptChips(session);
      renderSearchDropdown(session);
      syncPanelSaveState();
    });
  });
}

function renderSearchDropdown(session) {
  const { search, dropdown } = getPanelEls();
  if (!dropdown || !search) return;
  const attached = new Set(panelConceptIds);
  const seen = seenConceptIds(session);
  const results = searchConceptInventory(session?.shared?.conceptInventory || [], search.value, {
    attached,
    seen,
  });
  if (!results.length) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
    return;
  }
  dropdown.hidden = false;
  dropdown.innerHTML = results
    .map(
      (row) =>
        `<button type="button" class="mnemonic-dropdown-item" data-concept-id="${escapeHtml(row.id)}">${escapeHtml(row.label)}</button>`,
    )
    .join("");
  dropdown.querySelectorAll(".mnemonic-dropdown-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cid = btn.getAttribute("data-concept-id") || "";
      if (cid && !panelConceptIds.includes(cid)) panelConceptIds.push(cid);
      search.value = "";
      dropdown.hidden = true;
      renderConceptChips(session);
      syncPanelSaveState();
    });
  });
}

function syncPanelSaveState() {
  const { text, saveBtn } = getPanelEls();
  const hasText = Boolean(String(text?.value || "").trim());
  const hasConcepts = panelConceptIds.length > 0;
  if (saveBtn) saveBtn.disabled = !hasText || !hasConcepts;
}

function showPanelView(view) {
  panelView = view;
  const { formView, pickView, deleteBtn, newBtn } = getPanelEls();
  if (formView) formView.hidden = view !== "form";
  if (pickView) pickView.hidden = view !== "pick";
  if (deleteBtn) deleteBtn.hidden = !panelEditId || view !== "form";
  if (newBtn) newBtn.hidden = view !== "pick";
}

function renderPickList(session, conceptId) {
  const { pickList, title } = getPanelEls();
  const devices = getDevicesForConcept(session, conceptId);
  if (title) title.textContent = "Mnemonic devices";
  if (!pickList) return;
  pickList.innerHTML = devices
    .map(
      (d) =>
        `<button type="button" class="mnemonic-pick-item" data-device-id="${escapeHtml(d.id)}">${escapeHtml(d.text.slice(0, 80))}${d.text.length > 80 ? "…" : ""}</button>`,
    )
    .join("");
  pickList.querySelectorAll(".mnemonic-pick-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-device-id") || "";
      openMnemonicPanel({ editDeviceId: id });
    });
  });
  showPanelView("pick");
}

function populateFormFromDevice(device) {
  const { text } = getPanelEls();
  panelEditId = device?.id || null;
  panelConceptIds = device ? [...device.conceptIds] : [];
  if (text) text.value = device?.text || "";
}

export function closeMnemonicPanel() {
  panelOpen = false;
  panelEditId = null;
  panelConceptIds = [];
  const { root, dropdown } = getPanelEls();
  if (root) root.hidden = true;
  if (dropdown) {
    dropdown.hidden = true;
    dropdown.innerHTML = "";
  }
}

/**
 * @param {{ prefilledConceptIds?: string[], editDeviceId?: string, contextConceptId?: string }} [opts]
 */
export async function openMnemonicPanel(opts = {}) {
  const session = await getActiveSession();
  if (!session) return;
  const { root, title, text, search } = getPanelEls();
  if (!root) return;

  panelOpen = true;
  root.hidden = false;

  const editId = String(opts.editDeviceId || "").trim();
  if (editId) {
    const device = getMnemonicDevices(session).find((d) => d.id === editId);
    if (!device) return;
    populateFormFromDevice(device);
    if (title) title.textContent = "Edit mnemonic";
    showPanelView("form");
  } else {
    const contextId = String(opts.contextConceptId || "").trim();
    const prefilled = [
      ...new Set(
        (Array.isArray(opts.prefilledConceptIds) ? opts.prefilledConceptIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ];
    panelEditId = null;
    panelConceptIds = prefilled;
    if (text) text.value = "";
    if (title) title.textContent = "New mnemonic";

    if (contextId) {
      const devices = getDevicesForConcept(session, contextId);
      if (devices.length > 1) {
        renderPickList(session, contextId);
        return;
      }
      if (devices.length === 1) {
        populateFormFromDevice(devices[0]);
        if (title) title.textContent = "Edit mnemonic";
      }
    }
    showPanelView("form");
  }

  renderConceptChips(session);
  renderSearchDropdown(session);
  syncPanelSaveState();
  setTimeout(() => search?.focus?.(), 0);
}

async function handleMnemonicSave() {
  const session = await getActiveSession();
  if (!session) return;
  const { text } = getPanelEls();
  const mode = resolveStudyMode?.() || "rsvp";
  const createdInMode = VALID_CREATED_MODES.has(mode) ? mode : "rsvp";
  try {
    await upsertMnemonicDevice(session, {
      id: panelEditId || crypto.randomUUID(),
      text: String(text?.value || "").trim(),
      conceptIds: panelConceptIds,
      createdInMode: panelEditId
        ? getMnemonicDevices(session).find((d) => d.id === panelEditId)?.createdInMode || createdInMode
        : createdInMode,
    });
    closeMnemonicPanel();
    await syncMnemonicButtonBadge();
  } catch (err) {
    console.warn("[mnemonic] save failed", err);
  }
}

async function handleMnemonicDelete() {
  const session = await getActiveSession();
  if (!session || !panelEditId) return;
  await deleteMnemonicDevice(session, panelEditId);
  closeMnemonicPanel();
  await syncMnemonicButtonBadge();
}

async function wirePanelHandlers() {
  const { saveBtn, cancelBtn, deleteBtn, newBtn, search, text, root } = getPanelEls();
  if (saveBtn && saveBtn.dataset.mnemonicWired !== "1") {
    saveBtn.dataset.mnemonicWired = "1";
    saveBtn.addEventListener("click", handleMnemonicSave);
  }
  if (cancelBtn && cancelBtn.dataset.mnemonicWired !== "1") {
    cancelBtn.dataset.mnemonicWired = "1";
    cancelBtn.addEventListener("click", closeMnemonicPanel);
  }
  if (deleteBtn && deleteBtn.dataset.mnemonicWired !== "1") {
    deleteBtn.dataset.mnemonicWired = "1";
    deleteBtn.addEventListener("click", handleMnemonicDelete);
  }
  if (newBtn && newBtn.dataset.mnemonicWired !== "1") {
    newBtn.dataset.mnemonicWired = "1";
    newBtn.addEventListener("click", async () => {
      panelEditId = null;
      const { text: ta } = getPanelEls();
      if (ta) ta.value = "";
      const session = await getActiveSession();
      const { title } = getPanelEls();
      if (title) title.textContent = "New mnemonic";
      showPanelView("form");
      renderConceptChips(session);
      syncPanelSaveState();
    });
  }
  if (search && search.dataset.mnemonicWired !== "1") {
    search.dataset.mnemonicWired = "1";
    search.addEventListener("input", async () => {
      renderSearchDropdown(await getActiveSession());
    });
  }
  if (text && text.dataset.mnemonicWired !== "1") {
    text.dataset.mnemonicWired = "1";
    text.addEventListener("input", syncPanelSaveState);
  }
  if (root && root.dataset.mnemonicWired !== "1") {
    root.dataset.mnemonicWired = "1";
    root.addEventListener("click", (e) => {
      if (e.target === root) closeMnemonicPanel();
    });
  }
}

/**
 * @param {string} screenId
 */
export async function shouldShowMnemonicButton(screenId) {
  const id = String(screenId || "").trim();
  if (MNEMONIC_HIDDEN_SCREENS.has(id)) return false;
  if (!isMnemonicButtonVisiblePref()) return false;
  return Boolean((await getActiveSession())?.docId);
}

export async function syncMnemonicButtonVisibility(screenId) {
  const btn = typeof document !== "undefined" ? document.getElementById("mnemonicBtn") : null;
  if (!btn) return;
  const show = await shouldShowMnemonicButton(screenId ?? resolveScreenId?.() ?? "");
  // DOM may have been torn down while awaiting (tests / rapid navigation).
  if (!btn.isConnected) return;
  btn.hidden = !show;
  if (show) {
    applyButtonPos(btn);
    await syncMnemonicButtonBadge();
  }
}

export async function syncMnemonicButtonBadge() {
  const btn = document.getElementById("mnemonicBtn");
  if (!btn || btn.hidden) return;
  const session = await getActiveSession();
  const conceptIds = (await resolveActiveConceptIds?.()) || [];
  const hasDevice = conceptIds.some((id) => conceptHasMnemonic(session, id));
  btn.classList.toggle("mnemonic-btn-has-device", hasDevice);
  btn.setAttribute("aria-pressed", hasDevice ? "true" : "false");
}

/**
 * @param {{ resolveActiveConceptIds?: () => Promise<string[]>, resolveStudyMode?: () => string, resolveScreenId?: () => string }} deps
 */
export function initMnemonicChrome(deps = {}) {
  resolveActiveConceptIds = deps.resolveActiveConceptIds || null;
  resolveStudyMode = deps.resolveStudyMode || null;
  resolveScreenId = deps.resolveScreenId || null;

  const btn = document.getElementById("mnemonicBtn");
  if (btn && btn.dataset.mnemonicInit !== "1") {
    btn.dataset.mnemonicInit = "1";
    wireButtonDrag(btn);
    btn.addEventListener("click", () => {
      void (async () => {
        const prefilled = (await resolveActiveConceptIds?.()) || [];
        const contextId = prefilled.length === 1 ? prefilled[0] : prefilled[0] || "";
        openMnemonicPanel({ prefilledConceptIds: prefilled, contextConceptId: contextId });
      })().catch(() => {});
    });
  }
  wirePanelHandlers();
  void syncMnemonicButtonVisibility().catch(() => {});
}

/**
 * @param {object | null | undefined} session
 * @param {string} conceptId
 */
export function buildMnemonicHintHtml(session, conceptId) {
  const devices = getDevicesForConcept(session, conceptId);
  if (!devices.length) return "";
  const inventory = session?.shared?.conceptInventory || [];
  return devices
    .map((device) => {
      const others = device.conceptIds
        .filter((id) => id !== conceptId)
        .map((id) => conceptLabelFromInventory(inventory, id));
      const alsoCovers = others.length
        ? `<p class="mnemonic-hint-also hint">Also covers: ${escapeHtml(others.join(", "))}</p>`
        : "";
      return `<details class="mnemonic-hint-details"><summary>Mnemonic hint available</summary><p class="mnemonic-hint-text">${escapeHtml(device.text)}</p>${alsoCovers}</details>`;
    })
    .join("");
}
