/** Session-close vault summary — read-only computation for Retrieval Hub (Option B: timestamp window). */

/** @type {ReadonlySet<string>} */
export const POSITIVE_VAULT_SIGNAL_TYPES = new Set([
  "mcq_correct",
  "socratic_passed",
  "assessment_mastered",
  "cloze_correct",
  "recall_strong",
  "recall_adequate",
  "review_correct",
  "vault_added",
  "vault_promoted",
]);

const MAX_ADDED_NAMES = 5;

/**
 * @param {object} vault
 * @param {string} docId
 * @returns {Set<string>}
 */
export function getVaultConceptIdsForDoc(vault, docId) {
  const id = String(docId || "").trim();
  const out = new Set();
  if (!id) return out;
  for (const entry of Array.isArray(vault?.entries) ? vault.entries : []) {
    for (const source of Array.isArray(entry?.sources) ? entry.sources : []) {
      if (String(source?.docId || "") === id) {
        const conceptId = String(source?.conceptId || "").trim();
        if (conceptId) out.add(conceptId);
      }
    }
  }
  return out;
}

/**
 * @param {object} session
 * @param {string} conceptId
 * @returns {string}
 */
export function resolveConceptTitle(session, conceptId) {
  const needle = String(conceptId || "").trim();
  if (!needle) return "Untitled concept";
  for (const entry of Array.isArray(session?.shared?.conceptInventory) ? session.shared.conceptInventory : []) {
    const id = String(entry?.canonicalId || entry?.id || "").trim();
    if (id === needle) {
      const title = String(entry?.label || entry?.title || entry?.name || "").trim();
      if (title) return title;
    }
  }
  return needle;
}

/**
 * Option B — earliest interaction timestamp across loaded mode slices.
 * @param {object} session
 * @param {object[]} [modeSlices]
 * @returns {number | null}
 */
export function resolveStudyVisitStartedAt(session, modeSlices = []) {
  let earliest = Infinity;

  for (const slice of Array.isArray(modeSlices) ? modeSlices : []) {
    const respBlocks =
      slice?._responses?.blocks && typeof slice._responses.blocks === "object"
        ? slice._responses.blocks
        : {};
    for (const bi of Object.keys(respBlocks)) {
      const qResp = respBlocks[bi]?.questions || {};
      for (const qi of Object.keys(qResp)) {
        const t = Number(qResp[qi]?.answered_at);
        if (Number.isFinite(t) && t > 0 && t < earliest) earliest = t;
      }
    }
  }

  for (const sig of Array.isArray(session?.shared?.assessmentSignals) ? session.shared.assessmentSignals : []) {
    const t = Number(sig?.lastAt);
    if (Number.isFinite(t) && t > 0 && t < earliest) earliest = t;
  }

  for (const obs of Array.isArray(session?.shared?._vaultPendingObservations)
    ? session.shared._vaultPendingObservations
    : []) {
    const t = Number(obs?.timestamp);
    if (Number.isFinite(t) && t > 0 && t < earliest) earliest = t;
  }

  return Number.isFinite(earliest) ? earliest : null;
}

/**
 * @param {object} params
 * @param {object} params.session
 * @param {object[]} params.observations
 * @param {object} params.vault
 * @param {string} params.docId
 * @param {number | null} [params.visitStartedAt]
 * @returns {{ addedCount: number, reinforcedCount: number, addedNames: string[], addedConceptIds: string[] }}
 */
export function buildSessionVaultSummary({ session, observations, vault, docId, visitStartedAt = null }) {
  const id = String(docId || "").trim();
  const existingConceptIds = getVaultConceptIdsForDoc(vault, id);
  const since = visitStartedAt != null && Number.isFinite(visitStartedAt) ? visitStartedAt : 0;

  /** @type {Map<string, string>} */
  const added = new Map();
  /** @type {Set<string>} */
  const reinforced = new Set();

  for (const obs of Array.isArray(observations) ? observations : []) {
    if (String(obs?.docId || "") !== id) continue;
    const ts = Number(obs?.timestamp) || 0;
    if (since > 0 && ts < since) continue;
    const type = String(obs?.type || "").trim();
    if (!POSITIVE_VAULT_SIGNAL_TYPES.has(type)) continue;
    const conceptId = String(obs?.conceptId || "").trim();
    if (!conceptId) continue;
    if (existingConceptIds.has(conceptId)) {
      reinforced.add(conceptId);
    } else if (!added.has(conceptId)) {
      added.set(conceptId, resolveConceptTitle(session, conceptId));
    }
  }

  return {
    addedCount: added.size,
    reinforcedCount: reinforced.size,
    addedNames: [...added.values()],
    addedConceptIds: [...added.keys()],
  };
}

/**
 * @param {{ addedCount: number, reinforcedCount: number, addedNames: string[] }} summary
 * @returns {string}
 */
export function renderVaultSummaryHtml(summary) {
  const addedCount = Number(summary?.addedCount) || 0;
  const reinforcedCount = Number(summary?.reinforcedCount) || 0;
  const names = Array.isArray(summary?.addedNames) ? summary.addedNames : [];

  if (addedCount === 0 && reinforcedCount === 0) {
    return `<div class="retrieval-hub-vault-summary retrieval-hub-vault-summary--empty" role="status">
      <p class="retrieval-hub-vault-summary__message">Keep going — concepts will land in your vault as you study.</p>
    </div>`;
  }

  const header =
    addedCount > 0 ? "New in your vault" : "What you learned this session";

  let listHtml = "";
  if (addedCount > 0 && names.length) {
    const visible = names.slice(0, MAX_ADDED_NAMES);
    const overflow = Math.max(0, addedCount - visible.length);
    const items = visible
      .map((name) => `<li class="retrieval-hub-vault-summary__item">${escapeVaultSummaryHtml(name)}</li>`)
      .join("");
    const overflowItem =
      overflow > 0
        ? `<li class="retrieval-hub-vault-summary__item retrieval-hub-vault-summary__item--more">… and ${overflow} more</li>`
        : "";
    listHtml = `<ul class="retrieval-hub-vault-summary__list">${items}${overflowItem}</ul>`;
  }

  const reinforcedLine =
    reinforcedCount > 0
      ? `<p class="retrieval-hub-vault-summary__reinforced">+ ${reinforcedCount} concept${reinforcedCount === 1 ? "" : "s"} reinforced</p>`
      : "";

  return `<div class="retrieval-hub-vault-summary" role="status">
    <p class="retrieval-hub-vault-summary__header">${escapeVaultSummaryHtml(header)}</p>
    ${listHtml}
    ${reinforcedLine}
  </div>`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeVaultSummaryHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
