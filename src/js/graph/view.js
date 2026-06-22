import { mergeEnrichedGraphUserNodes } from "../dictionary.js?v=20260622_5";
import { formatGraphEdgeMarkdown } from "../export-format.js?v=20260622_5";
import { getStudyLanguage } from "../ui.js?v=20260622_5";
import { buildSessionGraph, buildSlowEnrichedGraph } from "./adapters.js";
import { pruneOrphanNodes } from "./build.js";
import { renderGraphCanvas } from "./canvas.js";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSpanishLang(lang) {
  const v = String(lang || "").trim().toLowerCase();
  return v.startsWith("es") || v.includes("spanish") || v.includes("español");
}

export function buildGraphSubgraphMarkdown(graph, lang = "English") {
  const es = isSpanishLang(lang);
  const hasUserLayer = (graph?.nodes || []).some((n) => n.layer === "user");
  const title = hasUserLayer
    ? es
      ? "## Grafo enriquecido"
      : "## Enriched graph"
    : es
      ? "## Grafo de material"
      : "## Material graph";
  const lines = [title, ""];
  const byLayer = new Map();
  for (const n of graph?.nodes || []) {
    const layer = n.layer || "other";
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(n);
  }
  for (const [layer, nodes] of byLayer.entries()) {
    lines.push(`### ${layer}`);
    for (const n of nodes) lines.push(`- ${n.label}`);
    lines.push("");
  }
  lines.push(es ? "### Enlaces" : "### Edges");
  for (const e of graph?.edges || []) {
    lines.push(formatGraphEdgeMarkdown(e.from, e.to, e.type, lang));
  }
  lines.push("");
  return lines.join("\n");
}

export function renderGraphUnlockButtonHtml(lang = "English", { id = "materialGraphBtn" } = {}) {
  const es = isSpanishLang(lang);
  const label = es ? "Ver grafo" : "View graph";
  return `<button type="button" id="${escapeHtml(id)}" class="btn-secondary material-graph-btn">${escapeHtml(label)}</button>`;
}

function nodeById(graph, id) {
  return (graph?.nodes || []).find((n) => n.id === id) || null;
}

export function renderEnrichedGraphHtml(graph, lang = "English") {
  const es = isSpanishLang(lang);
  const textNodes = (graph?.nodes || []).filter((n) => ["text", "arg", "concept", "term"].includes(n.layer));
  const userNodes = (graph?.nodes || []).filter((n) => n.layer === "user");
  const blockNodes = (graph?.nodes || []).filter((n) => n.layer === "block");
  const edges = graph?.edges || [];

  const listFor = (nodes, emptyMsg) =>
    nodes.length
      ? `<ul class="material-graph-node-list">${nodes
          .map((n) => {
            const click =
              n.sourceAnnotationId
                ? ` data-annotation-id="${escapeHtml(n.sourceAnnotationId)}" class="material-graph-list-btn slow-graph-node-user"`
                : "";
            const tag = n.sourceAnnotationId ? "button" : "span";
            return `<li><${tag} type="button"${click}>${escapeHtml(n.label)}</${tag}></li>`;
          })
          .join("")}</ul>`
      : `<p class="hint">${escapeHtml(emptyMsg)}</p>`;

  const edgeList = edges.length
    ? `<ul class="material-graph-edge-list">${edges
        .map((e) => {
          const from = nodeById(graph, e.from);
          const to = nodeById(graph, e.to);
          return `<li>${escapeHtml(from?.label || e.from)} → ${escapeHtml(to?.label || e.to)} <em>(${escapeHtml(e.type)})</em></li>`;
        })
        .join("")}</ul>`
    : `<p class="hint">${escapeHtml(es ? "Sin enlaces." : "No edges.")}</p>`;

  return `
    <div class="material-graph-layers">
      ${blockNodes.length ? `<section><h2>${escapeHtml(es ? "Bloques" : "Blocks")}</h2>${listFor(blockNodes, "")}</section>` : ""}
      <section><h2>${escapeHtml(es ? "Conceptos / texto" : "Concepts / text")}</h2>${listFor(textNodes, es ? "Sin nodos." : "No nodes.")}</section>
      ${userNodes.length ? `<section><h2>${escapeHtml(es ? "Tus notas" : "Your notes")}</h2>${listFor(userNodes, "")}</section>` : ""}
      <section><h2>${escapeHtml(es ? "Enlaces" : "Edges")}</h2>${edgeList}</section>
    </div>`;
}

/** Persist user-layer nodes on session + dictionary integration (Slow). */
export function persistEnrichedGraph(session, graph) {
  if (!session?.slow || !graph) return [];
  const userNodes = (graph.nodes || []).filter((n) => n.layer === "user");
  session.slow.graphNodes = userNodes.map((n) => ({
    id: n.id,
    label: n.label,
    sourceAnnotationId: n.sourceAnnotationId,
  }));
  mergeEnrichedGraphUserNodes(session, userNodes);
  return session.slow.graphNodes;
}

/**
 * Mount graph screen: canvas + list fallback.
 * @param {object} session
 * @param {HTMLElement} containerEl
 * @param {{ conceptInventory?: object[], blockIndex?: object[], graph?: object, mode?: string }} [options]
 */
export function mountMaterialGraphScreen(session, containerEl, options = {}) {
  if (!containerEl) return null;
  const lang = getStudyLanguage() || "English";
  const builtGraph =
    options.graph ||
    buildSessionGraph(session, {
      conceptInventory: options.conceptInventory,
      blockIndex: options.blockIndex,
      mode: options.mode || "auto",
    });
  const graph = pruneOrphanNodes(builtGraph);

  if (session?.slow?.graphEnrichedUnlocked || options.mode === "slow_enriched") {
    persistEnrichedGraph(session, graph);
  }

  const doc = containerEl.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return graph;

  const canvasHost = doc.createElement("div");
  canvasHost.className = "material-graph-canvas-mount";
  const listHost = doc.createElement("details");
  listHost.className = "material-graph-list-fallback";
  listHost.innerHTML = `<summary>${escapeHtml(isSpanishLang(lang) ? "Lista de nodos" : "Node list")}</summary>`;

  containerEl.innerHTML = "";
  containerEl.appendChild(canvasHost);
  listHost.appendChild(doc.createElement("div"));
  containerEl.appendChild(listHost);

  renderGraphCanvas(graph, canvasHost, {
    lang,
    onNodeClick: options.onNodeClick,
    graphMode: options.graphMode || (options.mode === "vault" ? "vault" : "material"),
  });
  listHost.querySelector("div").innerHTML = renderEnrichedGraphHtml(graph, lang);

  return graph;
}

export function wireMaterialGraphScreen(containerEl, session, { onJumpToAnnotation, onNodeFocus } = {}) {
  if (!containerEl || !session) return;
  const anns = session.slow?.annotations || [];

  const jumpByAnnotationId = (annotationId) => {
    const id = String(annotationId || "").trim();
    if (!id || !session.slow) return;
    const ann = anns.find((a) => a.id === id);
    if (ann) onJumpToAnnotation?.(session, ann);
  };

  containerEl.querySelectorAll(".material-graph-list-btn, .slow-graph-node-user").forEach((btn) => {
    btn.addEventListener("click", () => {
      jumpByAnnotationId(btn.getAttribute("data-annotation-id"));
    });
  });
}

export {
  buildSessionGraph,
  buildSlowEnrichedGraph,
  buildSlowPhase0Graph,
  resolveEnrichedGraphInputs,
} from "./adapters.js";
export {
  buildClozeEpistemicGraph,
  buildRsvpMaterialGraph,
  buildSlowEnrichedGraphFromInputs,
  buildSlowPhase0GraphFromInputs,
  collectTextConceptsFromLists,
  pruneOrphanNodes,
  EDGE_TYPES,
} from "./build.js";
export { textNodeId, userNodeId, argNodeId, conceptNodeId, blockNodeId, LITERATURE_TERM_ID, graphTermSlug } from "./ids.js";
export {
  CHAR_PROXIMITY_CHARS,
  MIN_TEXT_OVERLAP_SCORE,
  PROXIMITY,
  findNearestArgumentMapNode,
  resolveArgumentMapNodeAnchor,
  textOverlapScore,
  tokenizeForOverlap,
} from "./proximity.js";
