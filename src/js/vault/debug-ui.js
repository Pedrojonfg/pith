/** Knowledge Vault debug panel (settings area). */

import { getCurrentMastery, getMasteryLabel } from "./mastery-model.js";
import { getActiveMisconceptions } from "./misconceptions.js";
import {
  acceptPendingInferredEdge,
  rejectPendingInferredEdge,
} from "./prerequisite-graph.js";
import { importFromCsv, importFromJson, importFromText } from "./import.js";
import {
  VAULT_GRAPH_MIN_ENTRIES,
} from "./vault-graph.js";
import {
  clearVault,
  deleteEntry,
  exportVaultJson,
  getEntryById,
  loadVault,
  mergeEntries,
  saveVault,
  setPrerequisites,
  updateEntryTitle,
} from "./vault-store.js";

let selectedEntryId = null;
let topicFilter = "all";
let mergeSourceId = null;
let importInFlight = false;
/** @type {(() => void) | null} */
let onViewGraphHandler = null;

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

function getModal() {
  return document.getElementById("vaultModal");
}

function closeModal() {
  const modal = getModal();
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  mergeSourceId = null;
}

function openModal(title, bodyHtml, onSave) {
  const modal = getModal();
  if (!modal) return;
  const titleEl = modal.querySelector(".vault-modal-title");
  const bodyEl = modal.querySelector(".vault-modal-body");
  const saveBtn = modal.querySelector(".vault-modal-save");
  const cancelBtn = modal.querySelector(".vault-modal-cancel");
  if (!titleEl || !bodyEl || !saveBtn || !cancelBtn) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");

  const newSave = saveBtn.cloneNode(true);
  saveBtn.replaceWith(newSave);
  newSave.addEventListener("click", () => {
    if (onSave()) closeModal();
  });

  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);
  newCancel.addEventListener("click", closeModal);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "vault-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function buildPrereqMultiSelect(entryId, selectedIds = []) {
  const vault = loadVault();
  const selected = new Set(selectedIds.map(String));
  const options = vault.entries
    .filter((e) => String(e.id) !== String(entryId))
    .map((e) => {
      const checked = selected.has(String(e.id)) ? " checked" : "";
      return `<label class="vault-prereq-option"><input type="checkbox" value="${escapeAttr(e.id)}"${checked}> ${escapeHtml(e.canonicalTitle)}</label>`;
    })
    .join("");
  return `<div class="vault-prereq-list">${options || "<p class='hint'>No other concepts yet.</p>"}</div>`;
}

function readPrereqSelection(container) {
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
}

function openEditModal(entry, host, isNew = false) {
  const topics = uniqueTopics(loadVault().entries);
  const topicOptions = [...new Set([...topics, entry?.topic || "general", "general"])]
    .filter(Boolean)
    .map((t) => {
      const sel = String(entry?.topic || "general") === t ? " selected" : "";
      return `<option value="${escapeAttr(t)}"${sel}>${escapeHtml(t)}</option>`;
    })
    .join("");

  const masteryVal = Math.round((Number(entry?.masteryBase) || 0.5) * 100);
  const body = `
    <label class="vault-form-field">Title <input type="text" id="vaultEditTitle" value="${escapeAttr(entry?.canonicalTitle || "")}" required></label>
    <label class="vault-form-field">Topic
      <select id="vaultEditTopic">${topicOptions}</select>
      <input type="text" id="vaultEditTopicNew" class="vault-topic-new" placeholder="Or type new topic">
    </label>
    ${isNew ? `<label class="vault-form-field">Initial mastery <input type="range" id="vaultEditMastery" min="0" max="100" value="${masteryVal}"><span id="vaultEditMasteryVal">${masteryVal}%</span></label>` : ""}
    <fieldset class="vault-form-field"><legend>Prerequisites</legend>
      <input type="search" id="vaultPrereqSearch" placeholder="Filter concepts…" class="vault-prereq-search">
      <div id="vaultPrereqContainer">${buildPrereqMultiSelect(entry?.id || "", entry?.prerequisites || [])}</div>
    </fieldset>`;

  openModal(isNew ? "Add concept" : "Edit concept", body, () => {
    const title = document.getElementById("vaultEditTitle")?.value?.trim();
    const topicNew = document.getElementById("vaultEditTopicNew")?.value?.trim();
    const topic = topicNew || document.getElementById("vaultEditTopic")?.value?.trim();
    if (!title || !topic) {
      window.alert("Title and topic are required.");
      return false;
    }
    const prereqContainer = document.getElementById("vaultPrereqContainer");
    const prereqs = prereqContainer ? readPrereqSelection(prereqContainer) : [];

    if (isNew) {
      const masteryPct = Number(document.getElementById("vaultEditMastery")?.value) || 50;
      const created = addManualEntry({
        canonicalTitle: title,
        topic,
        masteryBase: masteryPct / 100,
        prerequisites: prereqs,
      });
      if (!created) {
        window.alert("Could not add concept.");
        return false;
      }
      selectedEntryId = created.id;
      showToast("Concept added.");
    } else {
      updateEntryTitle(entry.id, title);
      const vault = loadVault();
      const e = vault.entries.find((x) => x.id === entry.id);
      if (e) {
        e.topic = topic;
        vault.lastUpdated = Date.now();
        saveVault(vault);
      }
      setPrerequisites(entry.id, prereqs);
      showToast("Concept updated.");
    }
    renderVaultPanel(host);
    return true;
  });

  const masteryRange = document.getElementById("vaultEditMastery");
  const masteryLabel = document.getElementById("vaultEditMasteryVal");
  if (masteryRange && masteryLabel) {
    masteryRange.addEventListener("input", () => {
      masteryLabel.textContent = `${masteryRange.value}%`;
    });
  }
  const search = document.getElementById("vaultPrereqSearch");
  if (search) {
    search.addEventListener("input", () => {
      const needle = search.value.trim().toLowerCase();
      for (const label of search.closest(".vault-modal-body")?.querySelectorAll(".vault-prereq-option") || []) {
        const text = label.textContent?.toLowerCase() || "";
        label.hidden = needle && !text.includes(needle);
      }
    });
  }
}

function openMergeModal(sourceId, host) {
  const source = getEntryById(sourceId);
  if (!source) return;
  const vault = loadVault();
  const options = vault.entries
    .filter((e) => e.id !== sourceId)
    .map((e) => `<option value="${escapeAttr(e.id)}">${escapeHtml(e.canonicalTitle)}</option>`)
    .join("");
  if (!options) {
    window.alert("No other concept to merge into.");
    return;
  }

  const body = `
    <p>Merge <strong>${escapeHtml(source.canonicalTitle)}</strong> into:</p>
    <label class="vault-form-field">Survivor concept
      <select id="vaultMergeTarget">${options}</select>
    </label>
    <p class="hint">Observations: ${(source.observations || []).length} · Sources: ${(source.sources || []).length}</p>`;

  openModal("Merge concepts", body, () => {
    const targetId = document.getElementById("vaultMergeTarget")?.value;
    if (!targetId) return false;
    const result = mergeEntries(targetId, sourceId);
    if (!result) {
      window.alert("Merge failed.");
      return false;
    }
    selectedEntryId = targetId;
    showToast("Concepts merged.");
    renderVaultPanel(host);
    return true;
  });
}

function openDeleteModal(entryId, host) {
  const entry = getEntryById(entryId);
  if (!entry) return;
  const depCount = (entry.dependents || []).length;
  const body = `
    <p>Delete <strong>${escapeHtml(entry.canonicalTitle)}</strong>?</p>
    ${depCount ? `<p class="vault-warn">${depCount} concept(s) list this as a prerequisite.</p>` : ""}
    <p class="hint">This cannot be undone.</p>`;

  openModal("Delete concept", body, () => {
    deleteEntry(entryId);
    if (selectedEntryId === entryId) selectedEntryId = null;
    showToast("Concept deleted.");
    renderVaultPanel(host);
    return true;
  });
}

function renderImportSection(host) {
  const section = document.createElement("section");
  section.className = "vault-import-section";
  section.innerHTML = `
    <h3 class="vault-import-heading">Import from text</h3>
    <p class="hint vault-import-hint">Paste what you already know; concepts are added with default mastery ~70%.</p>
    <textarea id="vaultImportText" class="vault-import-textarea" rows="4" placeholder="I know Python basics: variables, loops, functions…"></textarea>
    <div class="vault-import-row">
      <button type="button" id="vaultImportBtn" class="btn-primary">Import concepts</button>
      <span id="vaultImportStatus" class="hint" role="status"></span>
    </div>
    <ul id="vaultImportErrors" class="vault-import-errors" hidden></ul>`;

  const btn = section.querySelector("#vaultImportBtn");
  const textarea = section.querySelector("#vaultImportText");
  const status = section.querySelector("#vaultImportStatus");
  const errorsEl = section.querySelector("#vaultImportErrors");

  btn?.addEventListener("click", async () => {
    if (importInFlight) return;
    const text = textarea?.value?.trim() || "";
    if (!text) {
      window.alert("Paste some text describing what you know.");
      return;
    }
    importInFlight = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Importing…";
    }
    if (status) status.textContent = "Extracting concepts…";
    if (errorsEl) {
      errorsEl.hidden = true;
      errorsEl.innerHTML = "";
    }

    try {
      const result = await importFromText(text);
      if (status) {
        status.textContent = `Added ${result.added}, merged ${result.merged}.`;
      }
      if (result.errors?.length && errorsEl) {
        errorsEl.hidden = false;
        errorsEl.innerHTML = result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("");
      }
      if (result.added > 0 || result.merged > 0) {
        if (textarea) textarea.value = "";
        showToast(`Import complete: ${result.added} added, ${result.merged} merged.`);
        renderVaultPanel(host);
      } else if (!result.errors?.length) {
        showToast("No concepts imported.");
      }
    } catch (err) {
      const message = String(err?.message || err || "Import failed.");
      if (status) status.textContent = "";
      if (errorsEl) {
        errorsEl.hidden = false;
        errorsEl.innerHTML = `<li>${escapeHtml(message)}</li>`;
      }
      window.alert(message);
    } finally {
      importInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Import concepts";
      }
    }
  });

  return section;
}

function renderFileImportResult(statusEl, errorsEl, result) {
  if (statusEl) {
    const errCount = result.errors?.length || 0;
    const base = `Added ${result.added}, merged ${result.merged}.`;
    statusEl.textContent = errCount ? `${base} ${errCount} issue(s) reported.` : base;
  }
  if (errorsEl) {
    if (result.errors?.length) {
      errorsEl.hidden = false;
      errorsEl.innerHTML = result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("");
    } else {
      errorsEl.hidden = true;
      errorsEl.innerHTML = "";
    }
  }
}

function renderFileImportSection(host) {
  const section = document.createElement("section");
  section.className = "vault-import-section vault-file-import-section";
  section.innerHTML = `
    <h3 class="vault-import-heading">Import from file</h3>
    <p class="hint vault-import-hint">CSV or JSON bulk import. CSV columns: canonicalTitle, topic, mastery, prerequisites.</p>
    <div class="vault-import-row">
      <label class="btn-secondary vault-file-import-label">
        Choose CSV or JSON
        <input type="file" id="vaultImportFile" accept=".csv,.json,text/csv,application/json" hidden>
      </label>
      <span id="vaultFileImportStatus" class="hint" role="status"></span>
    </div>
    <ul id="vaultFileImportErrors" class="vault-import-errors" hidden></ul>`;

  const input = section.querySelector("#vaultImportFile");
  const status = section.querySelector("#vaultFileImportStatus");
  const errorsEl = section.querySelector("#vaultFileImportErrors");
  const label = section.querySelector(".vault-file-import-label");

  input?.addEventListener("change", async () => {
    if (importInFlight) return;
    const file = input.files?.[0];
    if (!file) return;

    importInFlight = true;
    if (label) label.classList.add("is-busy");
    if (status) status.textContent = "Importing…";
    if (errorsEl) {
      errorsEl.hidden = true;
      errorsEl.innerHTML = "";
    }

    try {
      const name = String(file.name || "").toLowerCase();
      const result = name.endsWith(".json")
        ? await importFromJson(file)
        : await importFromCsv(file);

      renderFileImportResult(status, errorsEl, result);

      if (result.added > 0 || result.merged > 0) {
        const partial = result.errors?.length ? " (with warnings)" : "";
        showToast(`File import complete: ${result.added} added, ${result.merged} merged${partial}.`);
        renderVaultPanel(host);
      } else if (!result.errors?.length) {
        showToast("No concepts imported from file.");
      }
    } catch (err) {
      const message = String(err?.message || err || "File import failed.");
      if (status) status.textContent = "";
      if (errorsEl) {
        errorsEl.hidden = false;
        errorsEl.innerHTML = `<li>${escapeHtml(message)}</li>`;
      }
      window.alert(message);
    } finally {
      importInFlight = false;
      if (label) label.classList.remove("is-busy");
      if (input) input.value = "";
    }
  });

  return section;
}

function renderPendingInferenceSection(host) {
  const vault = loadVault();
  const pending = Array.isArray(vault.pendingInferredEdges) ? vault.pendingInferredEdges : [];
  const section = document.createElement("section");
  section.className = "vault-pending-inference";
  if (!pending.length) {
    section.hidden = true;
    return section;
  }

  section.innerHTML = `
    <h3 class="vault-import-heading">Suggested prerequisites</h3>
    <p class="hint">Cross-document inferences awaiting review (confidence 60–84%).</p>`;

  const list = document.createElement("ul");
  list.className = "vault-pending-list";

  for (const row of pending) {
    const fromTitle = getEntryById(row.fromId)?.canonicalTitle || row.fromId;
    const toTitle = getEntryById(row.toId)?.canonicalTitle || row.toId;
    const pct = Math.round((Number(row.confidence) || 0) * 100);
    const li = document.createElement("li");
    li.className = "vault-pending-item";
    li.innerHTML = `
      <span class="vault-pending-edge">${escapeHtml(fromTitle)} → ${escapeHtml(toTitle)}</span>
      <span class="vault-pending-conf hint">${pct}%</span>`;

    const acceptBtn = document.createElement("button");
    acceptBtn.type = "button";
    acceptBtn.className = "btn-link vault-action-btn";
    acceptBtn.textContent = "Accept";
    acceptBtn.addEventListener("click", async () => {
      const fresh = loadVault();
      const ok = await acceptPendingInferredEdge(fresh, row.id);
      if (ok) {
        showToast("Prerequisite accepted.");
        renderVaultPanel(host);
      }
    });

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.className = "btn-link vault-action-btn vault-delete-btn";
    rejectBtn.textContent = "Reject";
    rejectBtn.addEventListener("click", async () => {
      const fresh = loadVault();
      const ok = await rejectPendingInferredEdge(fresh, row.id);
      if (ok) {
        showToast("Suggestion dismissed.");
        renderVaultPanel(host);
      }
    });

    const actions = document.createElement("span");
    actions.className = "vault-pending-actions";
    actions.append(acceptBtn, rejectBtn);
    li.appendChild(actions);
    list.appendChild(li);
  }

  section.appendChild(list);
  return section;
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
  host.appendChild(renderPendingInferenceSection(host));
  host.appendChild(renderImportSection(host));
  host.appendChild(renderFileImportSection(host));

  const actions = document.createElement("div");
  actions.className = "vault-panel-actions";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-primary";
  addBtn.textContent = "Add concept";
  addBtn.addEventListener("click", () => openEditModal(null, host, true));
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
  const graphBtn = document.createElement("button");
  graphBtn.type = "button";
  graphBtn.className = "btn-secondary";
  graphBtn.id = "vaultViewGraphBtn";
  graphBtn.textContent = "View graph";
  const canGraph = vault.entries.length >= VAULT_GRAPH_MIN_ENTRIES;
  graphBtn.disabled = !canGraph;
  graphBtn.title = canGraph
    ? "Open interactive prerequisite graph"
    : `Add at least ${VAULT_GRAPH_MIN_ENTRIES} concepts to view the graph`;
  graphBtn.addEventListener("click", () => {
    if (typeof onViewGraphHandler === "function") onViewGraphHandler();
  });
  actions.append(addBtn, graphBtn, exportBtn, clearBtn);
  host.appendChild(actions);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "hint vault-empty";
    empty.textContent = "No concepts stored yet. Add one manually or complete a study session.";
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
    <th scope="col">Actions</th>
  </tr></thead>`;
  const tbody = document.createElement("tbody");
  for (const entry of entries) {
    const tr = document.createElement("tr");
    tr.dataset.entryId = entry.id;
    if (selectedEntryId === entry.id) tr.classList.add("is-selected");
    const mastery = getCurrentMastery(entry);
    const pct = Math.round(mastery * 100);
    tr.innerHTML = `
      <td class="vault-row-title" tabindex="0">${escapeHtml(entry.canonicalTitle)}${entry.manualOrigin ? ' <span class="vault-badge">manual</span>' : ""}</td>
      <td>${escapeHtml(entry.topic)}</td>
      <td><div class="vault-mastery-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div> ${pct}%</td>
      <td>${formatRelativeTime(entry.lastSeen)}</td>
      <td>${Array.isArray(entry.sources) ? entry.sources.length : 0}</td>
      <td class="vault-row-actions"></td>`;

    const titleCell = tr.querySelector(".vault-row-title");
    const open = () => {
      selectedEntryId = entry.id;
      renderVaultPanel(host);
    };
    titleCell?.addEventListener("click", open);
    titleCell?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    const actionsCell = tr.querySelector(".vault-row-actions");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-link vault-action-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(entry, host, false);
    });
    const mergeBtn = document.createElement("button");
    mergeBtn.type = "button";
    mergeBtn.className = "btn-link vault-action-btn";
    mergeBtn.textContent = "Merge…";
    mergeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMergeModal(entry.id, host);
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-link vault-action-btn vault-delete-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteModal(entry.id, host);
    });
    actionsCell?.append(editBtn, mergeBtn, delBtn);
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
  const activeMisconceptions = getActiveMisconceptions(entry);
  const misconceptionRows = activeMisconceptions.length
    ? activeMisconceptions.map(
        (m) =>
          `<li>${escapeHtml(m.description)} <span class="hint">(${(Number(m.confidence) * 100).toFixed(0)}% confidence)</span></li>`,
      ).join("")
    : "<li>None active</li>";
  const resolvedMisconceptions = (Array.isArray(entry.misconceptions) ? entry.misconceptions : []).filter(
    (m) => m?.resolved,
  );
  const resolvedRows = resolvedMisconceptions.length
    ? resolvedMisconceptions.map((m) => `<li>${escapeHtml(m.description)} <span class="hint">(resolved)</span></li>`).join("")
    : "";
  const prereqTitles = (Array.isArray(entry.prerequisites) ? entry.prerequisites : [])
    .map((id) => getEntryById(id)?.canonicalTitle || id)
    .join(", ");
  const coPrereqIds = Array.isArray(entry.coPrerequisites) ? entry.coPrerequisites : [];
  const coPrereqTitles = coPrereqIds
    .map((id) => {
      const title = getEntryById(id)?.canonicalTitle || id;
      return `${escapeHtml(title)} <span class="vault-badge vault-badge-co">co-prerequisite</span>`;
    })
    .join(", ");
  const coBadge = coPrereqIds.length
    ? ' <span class="vault-badge vault-badge-co">co-prereq</span>'
    : "";
  detail.innerHTML = `
    <h3>${escapeHtml(entry.canonicalTitle)}${coBadge}</h3>
    <p><strong>Mastery band:</strong> ${label} (${Math.round(getCurrentMastery(entry) * 100)}%)</p>
    <p><strong>Aliases:</strong> ${escapeHtml((entry.aliases || []).join(", ") || "—")}</p>
    <p><strong>Prerequisites:</strong> ${escapeHtml(prereqTitles || "—")}</p>
    ${coPrereqTitles ? `<p><strong>Co-prerequisites:</strong> ${escapeHtml(coPrereqTitles)}</p>` : ""}
    <h4>Misconceptions</h4>
    <ul class="vault-misc-list">${misconceptionRows}</ul>
    ${resolvedRows ? `<h4>Resolved misconceptions</h4><ul class="vault-misc-list vault-misc-resolved">${resolvedRows}</ul>` : ""}
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
  a.download = `pith-knowledge-vault-${date}.json`;
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

function escapeAttr(text) {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

/**
 * @param {HTMLElement | null} panel
 * @param {HTMLElement | null} trigger
 * @param {(() => void) | null} [onOpen]
 * @param {(() => void) | null} [onViewGraph]
 */
export function wireVaultDebugUi(panel, trigger, onOpen = null, onViewGraph = null) {
  if (!panel || !trigger) return;
  onViewGraphHandler = onViewGraph;
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
