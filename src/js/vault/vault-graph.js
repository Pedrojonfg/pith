/** Knowledge Vault → material graph adapter (Post A+ T12). */

import { pruneOrphanNodes } from "../graph/build.js";
import { mountMaterialGraphScreen } from "../graph/view.js";
import { getCurrentMastery, masteryToNodeColors } from "./mastery-model.js";
import { getEntryById, loadVault } from "./vault-store.js";
import {
  entryMatchesProjectFilter,
  resolveVaultEntryProjectIds,
} from "./project-membership.js";
import { renderVaultTimeline } from "./graph-timeline.js";
import { renderVaultMap } from "./graph-map.js";
import { renderVaultInfluenceTree } from "./graph-influence-tree.js";
import { MISC_PROJECT_ID } from "./project-membership.js";

export const VAULT_GRAPH_MIN_ENTRIES = 10;
export const VAULT_GRAPH_TOPIC_FILTER_THRESHOLD = 150;
export const VAULT_GRAPH_MODES = Object.freeze(["node", "timeline", "map", "influence_tree"]);

export { masteryToNodeColors } from "./mastery-model.js";

/**
 * @param {object} vault
 * @returns {string[]}
 */
export function getVaultGraphTopics(vault) {
  const set = new Set();
  for (const e of vault?.entries || []) {
    const t = String(e?.topic || "").trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * @param {object[]} entries
 * @param {{ topicFilter?: string, projectIds?: Set<string>|string[]|null, sessionsByDocId?: Record<string, object> }} [options]
 */
export function filterVaultEntriesForGraph(entries, options = {}) {
  let list = Array.isArray(entries) ? [...entries] : [];
  const topicFilter = options.topicFilter;
  if (topicFilter && topicFilter !== "all") {
    list = list.filter((e) => String(e?.topic || "") === topicFilter);
  }
  if (options.projectIds) {
    const sessionsByDocId = options.sessionsByDocId || {};
    list = list.filter((e) =>
      entryMatchesProjectFilter(e, options.projectIds, sessionsByDocId),
    );
  }
  return list;
}

/**
 * @param {object} vault
 * @param {{ topicFilter?: string, projectIds?: Set<string>|string[]|null, sessionsByDocId?: Record<string, object> }} [options]
 * @returns {{ nodes: object[], edges: object[] }}
 */
export function buildVaultGraph(vault, options = {}) {
  const filtered = filterVaultEntriesForGraph(vault?.entries || [], options);

  const entryIds = new Set(filtered.map((e) => String(e.id)));
  const topics = [...new Set(filtered.map((e) => String(e?.topic || "general")))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  const topicCol = new Map(topics.map((t, i) => [t, i % 4]));

  const nodes = filtered.map((e, idx) => ({
    id: String(e.id),
    label: String(e.canonicalTitle || e.id),
    type: "vault_concept",
    layer: "vault_concept",
    mastery: getCurrentMastery(e),
    topic: String(e.topic || "general"),
    col: topicCol.get(String(e.topic || "general")) ?? 0,
    order: idx,
    vaultEntryId: e.id,
  }));

  const edges = [];
  const seen = new Set();

  for (const e of filtered) {
    const dependentId = String(e.id);
    for (const pid of e.prerequisites || []) {
      const prereqId = String(pid);
      if (!entryIds.has(prereqId)) continue;
      const key = `p:${prereqId}->${dependentId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: prereqId, to: dependentId, type: "prerequisite" });
    }
    for (const cid of e.coPrerequisites || []) {
      const otherId = String(cid);
      if (!entryIds.has(otherId)) continue;
      const pair = [dependentId, otherId].sort().join("|");
      const key = `c:${pair}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: dependentId, to: otherId, type: "co_prerequisite" });
    }
    for (const tid of e.influences || []) {
      const toId = String(tid);
      if (!entryIds.has(toId)) continue;
      const key = `i:${dependentId}->${toId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: dependentId, to: toId, type: "INFLUENCED" });
    }
  }

  return { nodes, edges };
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Topic picker when vault exceeds VAULT_GRAPH_TOPIC_FILTER_THRESHOLD nodes.
 * @param {HTMLElement} containerEl
 * @param {object} vault
 * @param {(topic: string) => void} onSelect
 */
export function renderVaultGraphTopicPicker(containerEl, vault, onSelect) {
  if (!containerEl) return;
  const topics = getVaultGraphTopics(vault);
  const count = vault?.entries?.length || 0;
  const options = topics
    .map((t) => {
      const n = (vault.entries || []).filter((e) => String(e.topic || "") === t).length;
      return `<option value="${escapeHtml(t)}">${escapeHtml(t)} (${n})</option>`;
    })
    .join("");

  containerEl.innerHTML = `
    <div class="vault-graph-topic-picker card-inner">
      <h2>Choose a topic</h2>
      <p class="hint">Your vault has ${count} concepts. Pick a topic to render an interactive graph (≤${VAULT_GRAPH_TOPIC_FILTER_THRESHOLD} nodes recommended).</p>
      <label class="vault-form-field">Topic
        <select id="vaultGraphTopicSelect">${options}</select>
      </label>
      <div class="row">
        <button type="button" id="vaultGraphTopicContinue" class="btn-primary">View graph</button>
      </div>
    </div>`;

  containerEl.querySelector("#vaultGraphTopicContinue")?.addEventListener("click", () => {
    const topic = containerEl.querySelector("#vaultGraphTopicSelect")?.value;
    if (topic) onSelect(topic);
  });
}

/**
 * Mount vault graph into container; optional detail panel for node clicks.
 * @param {HTMLElement | null} containerEl
 * @param {HTMLElement | null} detailHost
 * @param {{ vault?: object, topicFilter?: string, projectIds?: Set<string>|string[]|null, sessionsByDocId?: object, onNodeClick?: (node: object) => void }} [options]
 */
export function mountVaultGraphScreen(containerEl, detailHost, options = {}) {
  if (!containerEl) return null;
  const vault = options.vault || loadVault();
  const built = buildVaultGraph(vault, {
    topicFilter: options.topicFilter,
    projectIds: options.projectIds,
    sessionsByDocId: options.sessionsByDocId,
  });
  const graph = pruneOrphanNodes(built);

  if (detailHost) {
    detailHost.hidden = false;
    detailHost.setAttribute("aria-hidden", "false");
    detailHost.innerHTML = `<p class="hint vault-graph-detail-hint">Click a node to see concept details.</p>`;
  }

  const showEntryDetail = (node) => {
    if (!node) return;
    if (typeof options.onNodeClick === "function") {
      options.onNodeClick(node);
      return;
    }
    if (!detailHost) return;
    const entry = getEntryById(node.vaultEntryId || node.id);
    if (!entry) return;
    detailHost.innerHTML = `<div class="vault-detail"><h3>${escapeHtml(entry.canonicalTitle)}</h3><p class="hint">Mastery ${Math.round(getCurrentMastery(entry) * 100)}%</p></div>`;
  };

  return mountMaterialGraphScreen(null, containerEl, {
    graph,
    graphMode: "vault",
    onNodeClick: (node) => showEntryDetail(node),
  });
}

/**
 * @param {object[]} sessions
 * @returns {Record<string, object>}
 */
export function buildSessionsByDocIdMap(sessions) {
  const map = {};
  for (const s of sessions || []) {
    const id = String(s?.id || "").trim();
    if (id) map[id] = s;
  }
  return map;
}

/**
 * All project ids for filter checkboxes (store projects + misc).
 * @param {object} [projectStore]
 * @returns {Array<{id:string,name:string}>}
 */
export function listProjectsForVaultGraphFilter(projectStore) {
  const projects = Array.isArray(projectStore?.projects) ? projectStore.projects : [];
  const out = projects.map((p) => ({
    id: String(p.id),
    name: String(p.name || p.id),
  }));
  if (!out.some((p) => p.id === MISC_PROJECT_ID)) {
    out.push({ id: MISC_PROJECT_ID, name: "Misc" });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * Render vault graph chrome mode into content host.
 * @param {HTMLElement} containerEl
 * @param {HTMLElement|null} detailHost
 * @param {{
 *   mode?: string,
 *   vault?: object,
 *   topicFilter?: string,
 *   projectIds?: Set<string>|string[],
 *   sessionsByDocId?: object,
 *   onSelectEntry?: (entryId: string) => void,
 * }} [options]
 */
export async function renderVaultGraphMode(containerEl, detailHost, options = {}) {
  if (!containerEl) return null;
  const mode = VAULT_GRAPH_MODES.includes(options.mode) ? options.mode : "node";
  const vault = options.vault || loadVault();
  const filtered = filterVaultEntriesForGraph(vault.entries || [], {
    topicFilter: options.topicFilter,
    projectIds: options.projectIds,
    sessionsByDocId: options.sessionsByDocId,
  });

  const select = (id) => {
    if (typeof options.onSelectEntry === "function") options.onSelectEntry(id);
    else if (detailHost) {
      const entry = getEntryById(id);
      if (entry) {
        detailHost.hidden = false;
        detailHost.setAttribute("aria-hidden", "false");
        detailHost.innerHTML = `<div class="vault-detail"><h3>${escapeHtml(entry.canonicalTitle)}</h3><p class="hint">${escapeHtml(entry.notes || "")}</p></div>`;
      }
    }
  };

  if (mode === "timeline") {
    return renderVaultTimeline(containerEl, filtered, { onSelect: select });
  }
  if (mode === "map") {
    return renderVaultMap(containerEl, filtered, { onSelect: select });
  }
  if (mode === "influence_tree") {
    return renderVaultInfluenceTree(containerEl, filtered, { onSelect: select });
  }
  return mountVaultGraphScreen(containerEl, detailHost, {
    vault: { ...vault, entries: filtered },
    topicFilter: "all",
    onNodeClick: (node) => select(node.vaultEntryId || node.id),
  });
}

/** Re-export for callers that only need membership helpers. */
export { resolveVaultEntryProjectIds, entryMatchesProjectFilter };
