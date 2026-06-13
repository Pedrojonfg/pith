/** Knowledge Vault → material graph adapter (Post A+ T12). */

import { pruneOrphanNodes } from "../graph/build.js";
import { mountMaterialGraphScreen } from "../graph/view.js";
import { getCurrentMastery, masteryToNodeColors } from "./mastery-model.js";
import { getEntryById, loadVault } from "./vault-store.js";

export const VAULT_GRAPH_MIN_ENTRIES = 10;
export const VAULT_GRAPH_TOPIC_FILTER_THRESHOLD = 150;

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
 * @param {object} vault
 * @param {{ topicFilter?: string }} [options]
 * @returns {{ nodes: object[], edges: object[] }}
 */
export function buildVaultGraph(vault, options = {}) {
  const entries = Array.isArray(vault?.entries) ? vault.entries : [];
  const topicFilter = options.topicFilter;
  const filtered =
    topicFilter && topicFilter !== "all"
      ? entries.filter((e) => String(e?.topic || "") === topicFilter)
      : entries;

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
 * @param {{ vault?: object, topicFilter?: string, onNodeClick?: (node: object) => void }} [options]
 */
export function mountVaultGraphScreen(containerEl, detailHost, options = {}) {
  if (!containerEl) return null;
  const vault = options.vault || loadVault();
  const built = buildVaultGraph(vault, { topicFilter: options.topicFilter });
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
