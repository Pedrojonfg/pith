/**
 * Holistic pre-packing assessment  budget, section coverage plan, merge.
 * @see specs/20260618-holistic-assessment-coverage/
 */

import { HOLISTIC_ASSESSMENT_MAX, HOLISTIC_ASSESSMENT_MIN } from "./config.js?v=20260622_7";

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/** @param {object} c */
export function getConceptId(c) {
  return String(c?.id || c?.concept_id || "").trim();
}

/**
 * @param {object[]} inventory
 * @param {{ edges?: object[] } | null} [conceptGraph]
 * @returns {{ from: string, to: string, type?: string }[]}
 */
export function deriveInventoryEdges(inventory, conceptGraph = null) {
  const edges = [];
  const seen = new Set();

  const add = (from, to, type = "prerequisite") => {
    const f = String(from || "").trim();
    const t = String(to || "").trim();
    if (!f || !t || f === t) return;
    const key = `${f}\u2192${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from: f, to: t, type: String(type || "prerequisite").trim() });
  };

  for (const c of Array.isArray(inventory) ? inventory : []) {
    const to = getConceptId(c);
    if (!to) continue;
    for (const pid of Array.isArray(c?.prerequisite_ids) ? c.prerequisite_ids : []) {
      add(pid, to, "prerequisite");
    }
  }

  const graphEdges = conceptGraph?.edges;
  if (Array.isArray(graphEdges)) {
    for (const e of graphEdges) {
      if (!e || typeof e !== "object") continue;
      add(e.from, e.to, e.type || e.relation || "relates");
    }
  }

  return edges;
}

/**
 * @param {object[]} inventory
 * @param {object[]} edges
 * @returns {{ n_test: number, n_socratic: number, edgeTestQuota: number, rationale: string }}
 */
export function computeHolisticAssessmentBudget(inventory, edges) {
  const inv = Array.isArray(inventory) ? inventory : [];
  const N = inv.length;
  const E = Array.isArray(edges) ? edges.length : 0;

  if (!N) {
    return { n_test: 0, n_socratic: 0, edgeTestQuota: 0, rationale: "empty inventory" };
  }

  let conceptTest = clamp(Math.ceil(N * 0.5), 4, 40);
  let edgeTest =
    E >= 4 ? Math.max(2, Math.ceil(E * 0.35)) : E > 0 ? Math.min(2, E) : 0;
  edgeTest = clamp(edgeTest, 0, 12);

  let n_test = conceptTest + edgeTest;
  const n_socratic = 0;

  const minTotal =
    N >= 12 ? HOLISTIC_ASSESSMENT_MIN : Math.min(HOLISTIC_ASSESSMENT_MIN, Math.max(3, N));
  while (n_test < minTotal && n_test < HOLISTIC_ASSESSMENT_MAX) {
    n_test += 1;
  }

  if (n_test > HOLISTIC_ASSESSMENT_MAX) {
    n_test = HOLISTIC_ASSESSMENT_MAX;
  }

  const edgeTestQuota = Math.min(
    edgeTest,
    Math.max(E >= 4 ? 2 : 0, Math.floor(n_test * 0.25)),
  );

  const rationale = `${N} concepts, ${E} edges ? ${n_test} test-only MCQ (${edgeTestQuota} relationship)`;

  return { n_test, n_socratic, edgeTestQuota, rationale };
}

function serializeEdge(edge) {
  return `${String(edge?.from || "").trim()}\u2192${String(edge?.to || "").trim()}`;
}

function parseEdgeId(id) {
  const s = String(id || "");
  const i = s.indexOf("\u2192");
  if (i < 0) return null;
  const from = s.slice(0, i).trim();
  const to = s.slice(i + 1).trim();
  return from && to ? { from, to } : null;
}

function distributeCounts(total, weights) {
  const w = weights.map((x) => Math.max(0, Number(x) || 0));
  const sum = w.reduce((a, b) => a + b, 0) || w.length;
  const out = w.map((weight) => Math.max(0, Math.floor((total * weight) / sum)));
  let assigned = out.reduce((a, b) => a + b, 0);
  let i = 0;
  while (assigned < total) {
    out[i % out.length] += 1;
    assigned += 1;
    i += 1;
  }
  return out;
}

/**
 * @param {object} params
 * @param {object[]} params.inventory
 * @param {object[]} params.edges
 * @param {{ label: string, text: string }[]} params.inventoryChunks
 * @param {string} [params.rawMarkdown]
 * @param {{ n_test: number, n_socratic: number, edgeTestQuota: number }} params.budget
 * @returns {object | null}
 */
export function buildAssessmentCoveragePlan({
  inventory,
  edges,
  inventoryChunks,
  rawMarkdown,
  budget,
}) {
  const inv = Array.isArray(inventory) ? inventory : [];
  if (!inv.length || !budget) return null;

  const edgeList = Array.isArray(edges) ? edges : [];
  const chunks =
    Array.isArray(inventoryChunks) && inventoryChunks.length
      ? inventoryChunks
      : [
          {
            label: "Document",
            text: String(rawMarkdown || "").trim(),
          },
        ];

  const conceptById = new Map(inv.map((c) => [getConceptId(c), c]).filter(([id]) => id));
  const conceptIds = [...conceptById.keys()];

  /** @type {string[][]} */
  const batchConceptIds = chunks.map(() => []);
  conceptIds.forEach((id, idx) => {
    batchConceptIds[idx % chunks.length].push(id);
  });

  /** @type {string[][]} */
  const batchEdgeIds = chunks.map(() => []);
  const conceptInBatch = batchConceptIds.map((ids) => new Set(ids));

  for (const edge of edgeList) {
    const eid = serializeEdge(edge);
    let placed = false;
    for (let b = 0; b < chunks.length; b += 1) {
      const set = conceptInBatch[b];
      if (set.has(edge.from) && set.has(edge.to)) {
        batchEdgeIds[b].push(eid);
        placed = true;
        break;
      }
    }
    if (!placed) {
      for (let b = 0; b < chunks.length; b += 1) {
        const set = conceptInBatch[b];
        if (set.has(edge.from) || set.has(edge.to)) {
          batchEdgeIds[b].push(eid);
          break;
        }
      }
    }
  }

  const weights = batchConceptIds.map((ids) => Math.max(1, ids.length));
  const testSplit = distributeCounts(budget.n_test, weights);
  const socSplit = distributeCounts(budget.n_socratic, weights);
  const edgeSplit = distributeCounts(budget.edgeTestQuota, batchEdgeIds.map((e) => Math.max(0, e.length)));

  const batches = chunks.map((chunk, i) => ({
    batchId: `sec-${i}`,
    label: String(chunk.label || `Section ${i + 1}`).trim(),
    conceptIds: batchConceptIds[i],
    edgeIds: batchEdgeIds[i],
    n_test: testSplit[i] || 0,
    n_socratic: socSplit[i] || 0,
    edgeTestQuota: edgeSplit[i] || 0,
    materialText: String(chunk.text || "").trim(),
  })).filter((b) => b.n_test > 0 && b.conceptIds.length > 0);

  if (!batches.length) return null;

  const totals = batches.reduce(
    (acc, b) => ({
      n_test: acc.n_test + b.n_test,
      n_socratic: acc.n_socratic + b.n_socratic,
    }),
    { n_test: 0, n_socratic: 0 },
  );

  const plan = {
    version: 1,
    batches,
    totals,
    planHash: "",
  };
  plan.planHash = hashCoveragePlan(plan);
  return plan;
}

/** @param {object | null | undefined} plan */
export function hashCoveragePlan(plan) {
  if (!plan || !Array.isArray(plan.batches) || !plan.batches.length) return "v1|0";
  const parts = plan.batches.map(
    (b) => `${b.batchId}:${b.n_test}+${b.n_socratic}:${b.edgeTestQuota || 0}`,
  );
  return `v1|${parts.join("|")}|${plan.totals?.n_test || 0}+${plan.totals?.n_socratic || 0}`;
}

function questionFingerprint(q) {
  const stem = String(q?.question || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  const cid = String(q?.concept_id || "").trim();
  const edge = q?.edge;
  const edgeKey =
    edge?.from && edge?.to ? `${edge.from}\u2192${edge.to}` : "";
  return `${cid}|${edgeKey}|${stem}`;
}

/**
 * @param {object[][]} batchResults
 * @param {object} plan
 * @returns {{ ok: boolean, questions: object[], testCount: number, minTest: number, expectedTest: number }}
 */
export function tryMergeHolisticAssessmentQuestions(batchResults, plan) {
  const expectedTest = Math.floor(Number(plan?.totals?.n_test) || 0);

  const seen = new Set();
  const tests = [];

  const flat = (Array.isArray(batchResults) ? batchResults : []).flat();
  for (const q of flat) {
    if (!q || typeof q !== "object") continue;
    const type = String(q.type || "").trim().toLowerCase();
    if (type !== "test") continue;
    const fp = questionFingerprint(q);
    if (seen.has(fp)) continue;
    seen.add(fp);
    tests.push(q);
  }

  const minTest = Math.max(1, Math.floor(expectedTest * 0.5));
  const ok = tests.length >= minTest;
  const questions = tests.slice(0, expectedTest || tests.length);

  return { ok, questions, testCount: tests.length, minTest, expectedTest };
}

/**
 * @param {object[][]} batchResults
 * @param {object} plan
 * @returns {object[]}
 */
export function mergeHolisticAssessmentQuestions(batchResults, plan) {
  const result = tryMergeHolisticAssessmentQuestions(batchResults, plan);
  if (!result.ok) {
    throw new Error(
      `Holistic assessment merge: expected at least ${result.minTest} test questions, got ${result.testCount}.`,
    );
  }
  return result.questions;
}

/** @param {string} edgeId @param {object[]} edgeList */
export function resolveEdgeById(edgeId, edgeList) {
  const parsed = parseEdgeId(edgeId);
  if (!parsed) return null;
  const list = Array.isArray(edgeList) ? edgeList : [];
  return (
    list.find((e) => e.from === parsed.from && e.to === parsed.to) || {
      from: parsed.from,
      to: parsed.to,
      type: "prerequisite",
    }
  );
}

/** Filter inventory rows for a batch. */
export function filterInventoryForBatch(inventory, conceptIds) {
  const set = new Set((Array.isArray(conceptIds) ? conceptIds : []).map(String));
  return (Array.isArray(inventory) ? inventory : []).filter((c) => set.has(getConceptId(c)));
}

/** Filter edges whose serialized id is in edgeIds. */
export function filterEdgesForBatch(edges, edgeIds) {
  const set = new Set(Array.isArray(edgeIds) ? edgeIds : []);
  return (Array.isArray(edges) ? edges : []).filter((e) => set.has(serializeEdge(e)));
}
