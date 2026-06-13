/** Knowledge Vault debug panel (settings area). */

import { getCurrentMastery, getMasteryLabel } from "./mastery-model.js";
import {
  clearVault,
  exportVaultJson,
  getEntryById,
  loadVault,
} from "./vault-store.js";

let selectedEntryId = null;
let topicFilter = "all";

function formatRelativeTime(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const diff = Date.now() - n;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function uniqueTopics(entries) {
  const set = new Set();
  for (const e of entries) {
    const t = String(e?.topic || "").trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function filteredEntries(entries) {
  if (topicFilter === "all") return entries;
  const needle = topicFilter.toLowerCase();
  return entries.filter((e) => String(e?.topic || "").toLowerCase() === needle);
}

/**
 * @param {HTMLElement | null} host
 */
export function renderVaultPanel(host) {
  if (!host) return;
  const vault = loadVault();
  const entries = filteredEntries(vault.entries);
  host.innerHTML = "";

  const header = document.createElement("div");
  header.className = "vault-panel-header";
  const h2 = document.createElement("h2");
  h2.textContent = `Knowledge Vault — ${vault.entries.length} concepts`;
  header.appendChild(h2);

  const filterWrap = document.createElement("label");
  filterWrap.className = "vault-topic-filter";
  filterWrap.textContent = "Topic: ";
  const select = document.createElement("select");
  select.id = "vaultTopicFilter";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All topics";
  select.appendChild(allOpt);
  for (const topic of uniqueTopics(vault.entries)) {
    const opt = document.createElement("option");
    opt.value = topic;
    opt.textContent = topic;
    if (topicFilter === topic) opt.selected = true;
    select.appendChild(opt);
  }
  if (topicFilter === "all") allOpt.selected = true;
  select.addEventListener("change", () => {
    topicFilter = select.value;
    renderVaultPanel(host);
  });
  filterWrap.appendChild(select);
  header.appendChild(filterWrap);
  host.appendChild(header);

  const actions = document.createElement("div");
  actions.className = "vault-panel-actions";
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn-secondary";
  exportBtn.textContent = "Export JSON";
  exportBtn.addEventListener("click", () => handleExport());
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn-secondary vault-clear-btn";
  clearBtn.textContent = "Clear vault";
  clearBtn.addEventListener("click", () => handleClear(host));
  actions.append(exportBtn, clearBtn);
  host.appendChild(actions);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "hint vault-empty";
    empty.textContent = "No concepts stored yet. Complete a study session to populate the vault.";
    host.appendChild(empty);
    renderDetail(host, null);
    return;
  }

  const table = document.createElement("table");
  table.className = "vault-table";
  table.innerHTML = `<thead><tr>
    <th scope="col">Concept</th>
    <th scope="col">Topic</th>
    <th scope="col">Mastery</th>
    <th scope="col">Last seen</th>
    <th scope="col">Sources</th>
  </tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const entry of entries) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.dataset.entryId = entry.id;
    if (selectedEntryId === entry.id) tr.classList.add("is-selected");
    const mastery = getCurrentMastery(entry);
    const pct = Math.round(mastery * 100);
    tr.innerHTML = `
      <td>${escapeHtml(entry.canonicalTitle)}</td>
      <td>${escapeHtml(entry.topic)}</td>
      <td><div class="vault-mastery-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div> ${pct}%</td>
      <td>${formatRelativeTime(entry.lastSeen)}</td>
      <td>${Array.isArray(entry.sources) ? entry.sources.length : 0}</td>`;
    const open = () => {
      selectedEntryId = entry.id;
      renderVaultPanel(host);
    };
    tr.addEventListener("click", open);
    tr.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);
  renderDetail(host, selectedEntryId ? getEntryById(selectedEntryId) : null);
}

/**
 * @param {HTMLElement | null} host
 * @param {object | null} entry
 */
export function renderDetail(host, entry) {
  if (!host) return;
  let detail = host.querySelector(".vault-detail");
  if (!detail) {
    detail = document.createElement("div");
    detail.className = "vault-detail";
    host.appendChild(detail);
  }
  if (!entry) {
    detail.hidden = true;
    detail.innerHTML = "";
    return;
  }
  detail.hidden = false;
  const label = getMasteryLabel(entry);
  const obs = (Array.isArray(entry.observations) ? entry.observations : []).slice(-10).reverse();
  const prereqTitles = (Array.isArray(entry.prerequisites) ? entry.prerequisites : [])
    .map((id) => getEntryById(id)?.canonicalTitle || id)
    .join(", ");
  detail.innerHTML = `
    <h3>${escapeHtml(entry.canonicalTitle)}</h3>
    <p><strong>Mastery band:</strong> ${label} (${Math.round(getCurrentMastery(entry) * 100)}%)</p>
    <p><strong>Aliases:</strong> ${escapeHtml((entry.aliases || []).join(", ") || "—")}</p>
    <p><strong>Prerequisites:</strong> ${escapeHtml(prereqTitles || "—")}</p>
    <h4>Recent observations</h4>
    <ul class="vault-obs-list">${obs.length ? obs.map((o) => `<li>${escapeHtml(o.type)} (${o.rawSignal >= 0 ? "+" : ""}${o.rawSignal}) · ${formatRelativeTime(o.timestamp)}</li>`).join("") : "<li>None</li>"}</ul>`;
}

export function handleClear(host) {
  if (!window.confirm("Clear all Knowledge Vault data? This cannot be undone.")) return;
  clearVault();
  selectedEntryId = null;
  renderVaultPanel(host);
}

export function handleExport() {
  const json = exportVaultJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `mylearning-knowledge-vault-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {HTMLElement | null} panel
 * @param {HTMLElement | null} trigger
 * @param {(() => void) | null} [onOpen]
 */
export function wireVaultDebugUi(panel, trigger, onOpen = null) {
  if (!panel || !trigger) return;
  const body = panel.classList?.contains("vault-panel-body") ? panel : panel.querySelector(".vault-panel-body") || panel;
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof onOpen === "function") onOpen();
    const shell = panel.classList?.contains("vault-debug-panel") ? panel : panel.closest(".vault-debug-panel") || panel;
    const open = shell.hidden === true || shell.getAttribute("aria-hidden") === "true";
    shell.hidden = !open;
    shell.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) renderVaultPanel(body);
  });
}
