import { getSortedSessionConcepts } from "../dictionary.js?v=20260622_9";
import { getActiveSession } from "../session-store.js?v=20260622_9";
import { getScopeText } from "../slow/reader.js?v=20260622_9";
import {
  buildClozeEpistemicGraph,
  buildRsvpMaterialGraph,
  buildSlowEnrichedGraphFromInputs,
  buildSlowPhase0GraphFromInputs,
  collectTextConceptsFromLists,
} from "./build.js";

/**
 * Resolve enriched-graph inputs from session + optional overrides (single I/O adapter).
 * @param {object|null} session
 * @param {object} [overrides]
 */
function mapSharedAnnotations(shared) {
  const list = Array.isArray(shared?.annotations) ? shared.annotations : [];
  return list.map((a) => ({
    id: a.id,
    type: a.type,
    charStart: Number(a.offset ?? a.charStart ?? 0),
    charEnd: Number(a.offset ?? a.charStart ?? 0) + String(a.text || "").length,
    userText: String(a.text || a.userText || ""),
    createdAt: a.createdAt,
  }));
}

export async function resolveEnrichedGraphInputs(session, overrides = {}) {
  const doc = overrides.shared ? null : await getActiveSession();
  const shared = overrides.shared ?? doc?.shared ?? session?.shared ?? null;
  const phase0 = overrides.phase0 ?? session?.slow?.phase0 ?? null;
  const sessionConcepts =
    overrides.sessionConcepts ?? (session ? getSortedSessionConcepts() : []);
  const sharedConcepts = Array.isArray(shared?.conceptInventory)
    ? shared.conceptInventory.map((c) => ({
        term: c.label,
        definition: c.definition,
        canonicalId: c.canonicalId,
      }))
    : [];
  const conceptsToFind =
    overrides.conceptsToFind ??
    (sharedConcepts.length ? sharedConcepts : phase0?.conceptsToFind ?? []);

  const sharedAnns = mapSharedAnnotations(shared);
  const slowAnns = session?.slow?.annotations ?? [];

  return {
    textConcepts:
      overrides.textConcepts ??
      collectTextConceptsFromLists(sessionConcepts, conceptsToFind),
    argumentMap: overrides.argumentMap ?? phase0?.argumentMap ?? [],
    annotations:
      overrides.annotations ??
      (sharedAnns.length ? sharedAnns : slowAnns),
    scopeText: overrides.scopeText ?? (session ? getScopeText(session) : ""),
    fillableBlanks: overrides.fillableBlanks ?? phase0?.fillableBlanks ?? [],
    charProximity: overrides.charProximity,
    minTextOverlap: overrides.minTextOverlap,
    onResolveMiss:
      overrides.onResolveMiss ??
      ((ann, detail) => {
        console.warn(
          `[graph] No argument-map match for annotation ${ann?.id} (${detail})`,
        );
      }),
  };
}

export async function buildSlowEnrichedGraph(session, options = {}) {
  return buildSlowEnrichedGraphFromInputs(await resolveEnrichedGraphInputs(session, options));
}

export function buildSlowPhase0Graph(session, options = {}) {
  const phase0 = options.phase0 ?? session?.slow?.phase0 ?? null;
  return buildSlowPhase0GraphFromInputs({ phase0 });
}

/**
 * Mode-agnostic entry: pick the best graph for the current context.
 * @param {object} session
 * @param {{ conceptInventory?: object[], blockIndex?: object[], mode?: string, enrichedInputs?: object, phase0?: object }} [options]
 */
export async function buildSessionGraph(session, options = {}) {
  const mode = String(options.mode || "auto").trim();
  const blockIndex = options.blockIndex ?? session?._meta?.material_graph?.blockIndex ?? null;
  const conceptInventory =
    options.conceptInventory ?? session?._meta?.material_graph?.conceptInventory ?? null;

  if (mode === "cloze") {
    const shared = options.shared ?? await getActiveSession()?.shared ?? session?.shared ?? null;
    return buildClozeEpistemicGraph(session, { shared });
  }

  if (mode === "slow_phase0") {
    return buildSlowPhase0Graph(session, options);
  }

  if (mode === "slow_enriched") {
    if (options.enrichedInputs) {
      return buildSlowEnrichedGraphFromInputs(options.enrichedInputs);
    }
    return await buildSlowEnrichedGraph(session, options);
  }

  if (
    mode === "rsvp" ||
    (mode === "auto" && session?.studyMode !== "slow" && Array.isArray(blockIndex) && blockIndex.length)
  ) {
    if (Array.isArray(blockIndex) && blockIndex.length) {
      return buildRsvpMaterialGraph({
        conceptInventory: conceptInventory || [],
        blockIndex,
      });
    }
  }

  if (mode === "auto" && session?.slow?.graphEnrichedUnlocked) {
    const enriched = await buildSlowEnrichedGraph(session, options);
    if (enriched.nodes.length) return enriched;
  }

  if (session?.slow?.phase0) {
    return buildSlowPhase0Graph(session, options);
  }

  if (Array.isArray(blockIndex) && blockIndex.length) {
    return buildRsvpMaterialGraph({
      conceptInventory: conceptInventory || [],
      blockIndex,
    });
  }

  return { nodes: [], edges: [], kind: "empty" };
}
