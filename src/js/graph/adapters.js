import { getSortedSessionConcepts } from "../dictionary.js?v=20260606_1";
import { getScopeText } from "../slow/reader.js?v=20260528_1";
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
export function resolveEnrichedGraphInputs(session, overrides = {}) {
  const phase0 = overrides.phase0 ?? session?.slow?.phase0 ?? null;
  const sessionConcepts =
    overrides.sessionConcepts ?? (session ? getSortedSessionConcepts() : []);
  const conceptsToFind = overrides.conceptsToFind ?? phase0?.conceptsToFind ?? [];

  return {
    textConcepts:
      overrides.textConcepts ??
      collectTextConceptsFromLists(sessionConcepts, conceptsToFind),
    argumentMap: overrides.argumentMap ?? phase0?.argumentMap ?? [],
    annotations: overrides.annotations ?? session?.slow?.annotations ?? [],
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

export function buildSlowEnrichedGraph(session, options = {}) {
  return buildSlowEnrichedGraphFromInputs(resolveEnrichedGraphInputs(session, options));
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
export function buildSessionGraph(session, options = {}) {
  const mode = String(options.mode || "auto").trim();
  const blockIndex = options.blockIndex ?? session?._meta?.material_graph?.blockIndex ?? null;
  const conceptInventory =
    options.conceptInventory ?? session?._meta?.material_graph?.conceptInventory ?? null;

  if (mode === "cloze") {
    return buildClozeEpistemicGraph(session);
  }

  if (mode === "slow_phase0") {
    return buildSlowPhase0Graph(session, options);
  }

  if (mode === "slow_enriched") {
    if (options.enrichedInputs) {
      return buildSlowEnrichedGraphFromInputs(options.enrichedInputs);
    }
    return buildSlowEnrichedGraph(session, options);
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
    const enriched = buildSlowEnrichedGraph(session, options);
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

/** @deprecated Use buildSlowEnrichedGraph */
export function buildEnrichedGraph(session) {
  return buildSlowEnrichedGraph(session);
}
