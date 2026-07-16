/** Influence-tree layout + SVG for vault INFLUENCED edges. */

/**
 * @param {object[]} entries
 * @returns {{ nodes: object[], edges: Array<{from:string,to:string}>, roots: string[] }}
 */
export function buildInfluenceSubgraph(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const idSet = new Set(list.map((e) => String(e.id)));
  const edges = [];
  const seen = new Set();
  for (const e of list) {
    const from = String(e.id);
    for (const toRaw of e.influences || []) {
      const to = String(toRaw);
      if (!idSet.has(to)) continue;
      const key = `${from}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to, type: "INFLUENCED" });
    }
  }
  const incoming = new Set(edges.map((ed) => ed.to));
  const roots = list.map((e) => String(e.id)).filter((id) => !incoming.has(id));
  const nodes = list.map((e) => ({
    id: String(e.id),
    label: String(e.canonicalTitle || e.id),
    vaultEntryId: e.id,
  }));
  return { nodes, edges, roots };
}

/**
 * Layered DAG layout (BFS from roots). Pure.
 * @param {{ nodes: object[], edges: Array<{from:string,to:string}>, roots: string[] }} graph
 * @returns {Map<string, {x:number,y:number,layer:number}>}
 */
export function layoutInfluenceTree(graph) {
  const positions = new Map();
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  if (!nodes.length) return positions;

  const children = new Map();
  for (const n of nodes) children.set(n.id, []);
  for (const e of edges) {
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from).push(e.to);
  }

  const roots = (graph.roots || []).filter((id) => nodes.some((n) => n.id === id));
  const start = roots.length ? roots : [nodes[0].id];
  const layerOf = new Map();
  const queue = [...start];
  for (const r of start) layerOf.set(r, 0);
  while (queue.length) {
    const id = queue.shift();
    const layer = layerOf.get(id) || 0;
    for (const child of children.get(id) || []) {
      if (layerOf.has(child)) continue;
      layerOf.set(child, layer + 1);
      queue.push(child);
    }
  }
  for (const n of nodes) {
    if (!layerOf.has(n.id)) layerOf.set(n.id, 0);
  }

  const byLayer = new Map();
  for (const n of nodes) {
    const L = layerOf.get(n.id) || 0;
    if (!byLayer.has(L)) byLayer.set(L, []);
    byLayer.get(L).push(n.id);
  }

  const colW = 180;
  const rowH = 56;
  const pad = 40;
  for (const [L, ids] of byLayer) {
    ids.forEach((id, i) => {
      positions.set(id, {
        x: pad + L * colW,
        y: pad + i * rowH,
        layer: L,
      });
    });
  }
  return positions;
}

/**
 * @param {HTMLElement} containerEl
 * @param {object[]} entries
 * @param {{ onSelect?: (id: string) => void }} [options]
 */
export function renderVaultInfluenceTree(containerEl, entries, options = {}) {
  if (!containerEl) return null;
  const graph = buildInfluenceSubgraph(entries);
  if (!graph.edges.length) {
    containerEl.innerHTML = `<p class="hint">No influence relationships in the current filter.</p>`;
    return graph;
  }
  const pos = layoutInfluenceTree(graph);
  let maxX = 0;
  let maxY = 0;
  for (const p of pos.values()) {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const width = maxX + 160;
  const height = maxY + 80;

  const edgeSvg = graph.edges
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return "";
      return `<line x1="${a.x + 50}" y1="${a.y + 14}" x2="${b.x}" y2="${b.y + 14}" stroke="#f97316" stroke-width="2" stroke-dasharray="2 6" marker-end="url(#inf-arrow)"/>`;
    })
    .join("");

  const nodeSvg = graph.nodes
    .map((n) => {
      const p = pos.get(n.id);
      if (!p) return "";
      const label = escapeXml(String(n.label || n.id).slice(0, 22));
      return `<g class="vault-inf-node" data-id="${escapeXml(n.id)}" style="cursor:pointer">
        <rect x="${p.x}" y="${p.y}" width="100" height="28" rx="6" fill="#334155" stroke="#f97316"/>
        <text x="${p.x + 8}" y="${p.y + 18}" fill="#f8fafc" font-size="11">${label}</text>
      </g>`;
    })
    .join("");

  containerEl.innerHTML = `
    <div class="vault-influence-host">
      <svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="inf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316"/>
          </marker>
        </defs>
        ${edgeSvg}
        ${nodeSvg}
      </svg>
    </div>`;

  containerEl.querySelectorAll(".vault-inf-node").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      if (id && typeof options.onSelect === "function") options.onSelect(id);
    });
  });
  return graph;
}

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
