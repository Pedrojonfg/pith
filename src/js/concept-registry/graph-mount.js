/**
 * Mount cross-document concept registry graph into DOM.
 */

import { renderGraphCanvas } from "../graph/canvas.js";
import { buildVaultGraph, getConceptPageData } from "./vault-graph-adapter.js";

/**
 * @param {HTMLElement} containerEl
 * @param {HTMLElement|null} detailHost
 * @param {object} [options]
 */
export function mountConceptRegistryGraph(containerEl, detailHost, options = {}) {
  if (!containerEl) return null;
  const { nodes, edges } = buildVaultGraph({
    focusedDocId: options.focusedDocId ?? null,
    projectId: options.projectId ?? null,
  });

  const graphNodes = nodes.map((n, idx) => ({
    id: n.id,
    label: n.label,
    layer: n.maturity === "gray" ? "concept" : "vault_concept",
    maturity: n.maturity,
    mastery: n.mastery,
    col: n.maturity === "yellow" ? 0 : n.maturity === "green" ? 1 : 2,
    order: idx,
    scope: n.scope,
  }));

  const graphEdges = edges.map((e) => ({
    from: e.source,
    to: e.target,
    type: e.type === "co_occurrence" ? "relates" : e.type,
  }));

  renderGraphCanvas(
    { nodes: graphNodes, edges: graphEdges },
    containerEl,
    {
      graphMode: "vault",
      onNodeClick: (node) => showConceptDetail(detailHost, node, options),
    },
  );

  return { nodes: graphNodes, edges: graphEdges };
}

/**
 * @param {HTMLElement|null} detailHost
 * @param {object} node
 * @param {object} options
 */
function showConceptDetail(detailHost, node, options) {
  if (!detailHost || !node) return;
  if (node.scope === "local") {
    detailHost.hidden = false;
    detailHost.setAttribute("aria-hidden", "false");
    detailHost.innerHTML = `<p class="hint">Gray concept — study this document to engage.</p><p><strong>${escapeHtml(node.label)}</strong></p>`;
    return;
  }
  const page = getConceptPageData(node.id);
  if (!page) return;
  detailHost.hidden = false;
  detailHost.setAttribute("aria-hidden", "false");
  const { concept, activeBlocks, historyBlocks } = page;
  const studyBtn =
    concept.maturity === "yellow"
      ? `<button type="button" class="btn-secondary" data-study-concept="${escapeHtml(concept.id)}">Study this (Recall)</button>`
      : "";
  const blocksHtml = activeBlocks
    .map(
      (b) =>
        `<div class="concept-content-block"><em>${escapeHtml(b.facet)}</em><p>${escapeHtml(b.text)}</p></div>`,
    )
    .join("");
  const historyHtml =
    historyBlocks.length > 0
      ? `<details><summary>History (${historyBlocks.length})</summary>${historyBlocks
          .map((b) => `<p class="hint">${escapeHtml(b.text)}</p>`)
          .join("")}</details>`
      : "";
  detailHost.innerHTML = `
    <h3>${escapeHtml(concept.canonicalName)}</h3>
    <p class="hint">Maturity: ${escapeHtml(concept.maturity)} · Mastery: ${Math.round((concept.mastery || 0) * 100)}%</p>
    ${studyBtn}
    <div class="concept-page-blocks">${blocksHtml || '<p class="hint">No authored content yet.</p>'}</div>
    ${historyHtml}`;
  detailHost.querySelector("[data-study-concept]")?.addEventListener("click", () => {
    if (typeof options.onStudyConcept === "function") {
      options.onStudyConcept(concept.id);
    }
  });
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
