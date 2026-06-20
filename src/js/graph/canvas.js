/** SVG column layout for material graphs (fixed layers, no force simulation). */

import { masteryToNodeColors } from "../vault/mastery-model.js";

const LAYER_COLORS = {
  vault_concept: { fill: "#94a3b8", stroke: "#64748b", text: "#0f172a" },
  concept: { fill: "#3b82f6", stroke: "#1d4ed8", text: "#eff6ff" },
  block: { fill: "#22c55e", stroke: "#15803d", text: "#f0fdf4" },
  text: { fill: "#14b8a6", stroke: "#0f766e", text: "#f0fdfa" },
  arg: { fill: "#f59e0b", stroke: "#b45309", text: "#fffbeb" },
  term: { fill: "#8b5cf6", stroke: "#6d28d9", text: "#f5f3ff" },
  user: { fill: "#ec4899", stroke: "#be185d", text: "#fdf2f8" },
};

const EDGE_COLORS = {
  requires: "#64748b",
  covers: "#22c55e",
  mentions: "#8b5cf6",
  sequence: "#94a3b8",
  historically_precedes: "#0ea5e9",
  relates: "#3b82f6",
  reinterprets: "#6366f1",
  constitutes: "#14b8a6",
  contrasts_with: "#a855f7",
  influences: "#06b6d4",
  instantiates: "#8b5cf6",
  supports: "#22c55e",
  contradicts: "#ef4444",
  cuestiona: "#f59e0b",
  refuta: "#ef4444",
  prerequisite: "#64748b",
  co_prerequisite: "#94a3b8",
  prerequisite_of: "#64748b",
  associated: "#3b82f6",
  exemplifies: "#8b5cf6",
  part_of: "#14b8a6",
};

const EDGE_DASH_SOLID = new Set([
  "sequence",
  "historically_precedes",
  "supports",
  "constitutes",
  "influences",
  "requires",
  "covers",
  "mentions",
  "instantiates",
  "prerequisite",
  "prerequisite_of",
  "part_of",
  "exemplifies",
]);
const EDGE_DASH_HEAVY = new Set(["contradicts", "refuta", "cuestiona"]);

function weightStrokeScale(weight) {
  const w = Number(weight);
  if (!Number.isFinite(w)) return { width: 2, opacity: 0.55 };
  const t = Math.max(0.05, Math.min(1, w));
  return {
    width: 1.2 + t * 2.3,
    opacity: 0.35 + t * 0.6,
  };
}

function edgeStrokeAttrs(type) {
  const edgeType = String(type || "").trim();
  if (EDGE_DASH_HEAVY.has(edgeType)) {
    return { dasharray: "8 4", width: 2.5 };
  }
  if (EDGE_DASH_SOLID.has(edgeType)) {
    return { dasharray: "none", width: 2 };
  }
  return { dasharray: "4 4", width: 2 };
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layerColumn(layer) {
  const cols = { concept: 0, block: 1, text: 2, arg: 2, term: 2, user: 3, vault_concept: 2 };
  return cols[layer] ?? 2;
}

function nodeColumn(n) {
  if (Number.isFinite(n?.col)) return Number(n.col);
  return layerColumn(n.layer);
}

function resolveNodeColors(n) {
  if (n.maturity === "gray") {
    return { fill: "#e2e8f0", stroke: "#94a3b8", text: "#334155" };
  }
  if (n.maturity === "yellow") {
    return { fill: "#fef9c3", stroke: "#ca8a04", text: "#713f12" };
  }
  if (n.maturity === "green") {
    if (Number.isFinite(n?.mastery) && n.mastery < 0.3) {
      return { fill: "#bbf7d0", stroke: "#16a34a", text: "#14532d" };
    }
    return { fill: "#4ade80", stroke: "#15803d", text: "#f0fdf4" };
  }
  if (Number.isFinite(n?.mastery)) return masteryToNodeColors(n.mastery);
  return LAYER_COLORS[n.layer] || LAYER_COLORS.text;
}

function layoutGraph(graph, width, height, options = {}) {
  const nodes = (graph?.nodes || []).map((n) => ({ ...n }));
  const edges = graph?.edges || [];
  if (!nodes.length) return { nodes: [], edges };

  const padX = 90;
  const padY = 56;
  const usableW = Math.max(320, width - padX * 2);
  const maxColNodes = Math.max(
    1,
    ...Array.from(
      nodes.reduce((acc, n) => {
        const col = nodeColumn(n);
        acc.set(col, (acc.get(col) || 0) + 1);
        return acc;
      }, new Map()),
    ).map(([, count]) => count),
  );
  const minHeight = options.graphMode === "vault" ? Math.min(2400, padY * 2 + maxColNodes * 28) : 240;
  const usableH = Math.max(minHeight, height - padY * 2);
  const colCount = Math.max(1, ...nodes.map((n) => nodeColumn(n) + 1));
  const colW = usableW / colCount;

  const byCol = new Map();
  for (const n of nodes) {
    const col = nodeColumn(n);
    if (!byCol.has(col)) byCol.set(col, []);
    byCol.get(col).push(n);
  }

  for (const [col, list] of byCol.entries()) {
    list.sort((a, b) => {
      const oa = Number(a.order ?? a.blockId ?? 0);
      const ob = Number(b.order ?? b.blockId ?? 0);
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    const step = list.length > 1 ? usableH / (list.length - 1) : 0;
    list.forEach((n, i) => {
      n.x = padX + col * colW + colW * 0.5;
      n.y = padY + (list.length === 1 ? usableH / 2 : i * step);
      n.r = n.layer === "block" ? 22 : n.layer === "user" ? 18 : 16;
    });
  }

  return { nodes, edges };
}

function edgePath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const startX = from.x + ux * (from.r || 16);
  const startY = from.y + uy * (from.r || 16);
  const endX = to.x - ux * ((to.r || 16) + 6);
  const endY = to.y - uy * ((to.r || 16) + 6);
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const perpX = -uy * 18;
  const perpY = ux * 18;
  return `M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`;
}

function vaultLegendHtml(lang) {
  const es = String(lang || "").toLowerCase().startsWith("es");
  const low = masteryToNodeColors(0.15);
  const mid = masteryToNodeColors(0.5);
  const high = masteryToNodeColors(0.9);
  return `<ul class="material-graph-legend material-graph-legend-vault">
    <li><span class="material-graph-legend-dot" style="background:${low.fill};border-color:${low.stroke}"></span>${escapeHtml(es ? "Dominio bajo" : "Low mastery")}</li>
    <li><span class="material-graph-legend-dot" style="background:${mid.fill};border-color:${mid.stroke}"></span>${escapeHtml(es ? "Parcial" : "Partial")}</li>
    <li><span class="material-graph-legend-dot" style="background:${high.fill};border-color:${high.stroke}"></span>${escapeHtml(es ? "Alto dominio" : "High mastery")}</li>
    <li><span class="material-graph-legend-line material-graph-legend-line-solid"></span>${escapeHtml(es ? "Prerrequisito" : "Prerequisite")}</li>
    <li><span class="material-graph-legend-line material-graph-legend-line-dashed"></span>${escapeHtml(es ? "Asociado / ejemplo / parte" : "Associated / example / part")}</li>
    <li><span class="material-graph-legend-line material-graph-legend-line-heavy"></span>${escapeHtml(es ? "Contradicción" : "Contradiction")}</li>
  </ul>`;
}

function legendHtml(lang, graphMode) {
  if (graphMode === "vault") return vaultLegendHtml(lang);
  const es = String(lang || "").toLowerCase().startsWith("es");
  const items = [
    { layer: "concept", label: es ? "Concepto" : "Concept" },
    { layer: "block", label: es ? "Bloque" : "Block" },
    { layer: "text", label: es ? "Texto" : "Text" },
    { layer: "user", label: es ? "Tu nota" : "Your note" },
  ];
  return `<ul class="material-graph-legend">${items
    .map((it) => {
      const c = LAYER_COLORS[it.layer] || LAYER_COLORS.text;
      return `<li><span class="material-graph-legend-dot" style="background:${c.fill};border-color:${c.stroke}"></span>${escapeHtml(it.label)}</li>`;
    })
    .join("")}</ul>`;
}

/**
 * Render graph into container as interactive SVG canvas.
 * @param {object} graph
 * @param {HTMLElement} containerEl
 * @param {{ width?: number, height?: number, lang?: string, onNodeClick?: (node: object) => void }} [options]
 */
export function renderGraphCanvas(graph, containerEl, options = {}) {
  if (!containerEl) return null;
  const graphMode = options.graphMode || "material";
  const width = Math.max(480, Number(options.width) || containerEl.clientWidth || 720);
  const nodeCount = (graph?.nodes || []).length;
  const vaultHeight =
    graphMode === "vault" ? Math.min(2400, Math.max(360, 56 + nodeCount * 28)) : 480;
  const height = Math.max(360, Number(options.height) || vaultHeight);
  const lang = options.lang || "English";
  const { nodes, edges } = layoutGraph(graph, width, height, { graphMode });
  const idToNode = new Map(nodes.map((n) => [n.id, n]));
  const interactive = typeof options.onNodeClick === "function";

  const edgeSvg = edges
    .map((e) => {
      const from = idToNode.get(e.from);
      const to = idToNode.get(e.to);
      if (!from || !to) return "";
      const color = EDGE_COLORS[e.type] || "#64748b";
      const stroke = edgeStrokeAttrs(e.type);
      const weightScale = weightStrokeScale(e.weight);
      const strokeWidth = Number.isFinite(e.weight) ? weightScale.width : stroke.width;
      const strokeOpacity = Number.isFinite(e.weight) ? weightScale.opacity : 1;
      const dashAttr =
        stroke.dasharray === "none" ? "" : ` stroke-dasharray="${stroke.dasharray}"`;
      return `<path class="material-graph-edge" data-edge-type="${escapeHtml(e.type)}" d="${edgePath(from, to)}" stroke="${color}" fill="none" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}"${dashAttr} marker-end="url(#material-graph-arrow)"/>`;
    })
    .join("");

  const nodeSvg = nodes
    .map((n) => {
      const colors = resolveNodeColors(n);
      const title = escapeHtml(n.label);
      const short = escapeHtml(truncateLabel(n.label, 28));
      const classes = ["material-graph-node"];
      if (interactive || n.sourceAnnotationId) classes.push("material-graph-node-clickable");
      const annAttr = n.sourceAnnotationId
        ? ` data-annotation-id="${escapeHtml(n.sourceAnnotationId)}"`
        : "";
      const clickable = ` class="${classes.join(" ")}"${annAttr}`;
      return `<g${clickable} data-node-id="${escapeHtml(n.id)}" transform="translate(${n.x},${n.y})">
        <circle r="${n.r || 16}" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2.5"/>
        <text class="material-graph-node-label" y="${(n.r || 16) + 14}" text-anchor="middle" fill="var(--text, #e2e8f0)" font-size="11">${short}</text>
        <title>${title}</title>
      </g>`;
    })
    .join("");

  const emptyHint =
    nodes.length === 0
      ? `<p class="hint material-graph-empty">${escapeHtml(
          String(lang).toLowerCase().startsWith("es") ? "Sin nodos en el grafo." : "No graph nodes yet.",
        )}</p>`
      : "";

  const ariaLabel =
    graphMode === "vault"
      ? String(lang).toLowerCase().startsWith("es")
        ? "Grafo del Knowledge Vault"
        : "Knowledge Vault graph"
      : "Material graph";

  containerEl.innerHTML = `
    <div class="material-graph-wrap">
      ${legendHtml(lang, graphMode)}
      <div class="material-graph-canvas-host" tabindex="0" role="img" aria-label="${escapeHtml(ariaLabel)}">
        <svg class="material-graph-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="material-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="rgba(15,23,42,0.35)" rx="12"/>
          ${edgeSvg}
          ${nodeSvg}
        </svg>
      </div>
      ${emptyHint}
      <p class="hint material-graph-stats">${nodes.length} nodes · ${edges.length} edges</p>
    </div>`;

  if (interactive) {
    containerEl.querySelectorAll(".material-graph-node-clickable").forEach((el) => {
      el.addEventListener("click", () => {
        const annId = el.getAttribute("data-annotation-id");
        const nodeId = el.getAttribute("data-node-id");
        const node = nodes.find((n) => n.id === nodeId);
        if (node) options.onNodeClick(node, annId);
      });
    });
  }

  return { nodes, edges };
}

function truncateLabel(text, max) {
  const raw = String(text || "").trim();
  if (raw.length <= max) return raw;
  return `${raw.slice(0, Math.max(0, max - 1))}…`;
}
