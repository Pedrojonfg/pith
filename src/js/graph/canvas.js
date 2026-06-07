/** SVG column layout for material graphs (fixed layers, no force simulation). */

const LAYER_COLORS = {
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
  relates: "#3b82f6",
  cuestiona: "#f59e0b",
  refuta: "#ef4444",
};

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layerColumn(layer) {
  const cols = { concept: 0, block: 1, text: 2, arg: 2, term: 2, user: 3 };
  return cols[layer] ?? 2;
}

function layoutGraph(graph, width, height) {
  const nodes = (graph?.nodes || []).map((n) => ({ ...n }));
  const edges = graph?.edges || [];
  if (!nodes.length) return { nodes: [], edges };

  const padX = 90;
  const padY = 56;
  const usableW = Math.max(320, width - padX * 2);
  const usableH = Math.max(240, height - padY * 2);
  const colW = usableW / 4;

  const byCol = new Map();
  for (const n of nodes) {
    const col = layerColumn(n.layer);
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

function legendHtml(lang) {
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
  const width = Math.max(480, Number(options.width) || containerEl.clientWidth || 720);
  const height = Math.max(360, Number(options.height) || 480);
  const lang = options.lang || "English";
  const { nodes, edges } = layoutGraph(graph, width, height);
  const idToNode = new Map(nodes.map((n) => [n.id, n]));

  const edgeSvg = edges
    .map((e) => {
      const from = idToNode.get(e.from);
      const to = idToNode.get(e.to);
      if (!from || !to) return "";
      const color = EDGE_COLORS[e.type] || "#64748b";
      return `<path class="material-graph-edge" data-edge-type="${escapeHtml(e.type)}" d="${edgePath(from, to)}" stroke="${color}" fill="none" stroke-width="2" marker-end="url(#material-graph-arrow)"/>`;
    })
    .join("");

  const nodeSvg = nodes
    .map((n) => {
      const colors = LAYER_COLORS[n.layer] || LAYER_COLORS.text;
      const title = escapeHtml(n.label);
      const short = escapeHtml(truncateLabel(n.label, 28));
      const clickable = n.sourceAnnotationId ? ' class="material-graph-node material-graph-node-clickable" data-annotation-id="' + escapeHtml(n.sourceAnnotationId) + '"' : ' class="material-graph-node"';
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

  containerEl.innerHTML = `
    <div class="material-graph-wrap">
      ${legendHtml(lang)}
      <div class="material-graph-canvas-host" tabindex="0" role="img" aria-label="Material graph">
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

  if (typeof options.onNodeClick === "function") {
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
