/**
 * Automatic Slow reading modifiers from text / pedagogy signals (FR-010).
 * Thresholds are unvalidated placeholders — calibrate post-launch.
 */

/**
 * Min argumentativeDensity (1–5) to enable fillable argument map.
 * Unvalidated placeholder — calibrate post-launch.
 */
export const FILLABLE_MAP_DENSITY_THRESHOLD = 4;

/**
 * Min headingDensity (headings per 1k words) to enable section checkpoints.
 * Unvalidated placeholder — calibrate post-launch.
 */
export const CHECKPOINTS_HEADING_DENSITY_THRESHOLD = 1;

/**
 * Min argumentativeDensity (1–5) to enable critical reading mode.
 * Unvalidated placeholder — calibrate post-launch.
 */
export const CRITICAL_MODE_DENSITY_THRESHOLD = 4;

/**
 * Genres that warrant critical reading mode even below density threshold.
 * Unvalidated placeholder — calibrate post-launch.
 */
export const CRITICAL_MODE_GENRES = Object.freeze(["philosophical"]);

/**
 * @param {unknown} value
 * @returns {number}
 */
function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Decide Slow modifiers once at session creation (no user toggles).
 *
 * @param {import("../session-types.js").TextMetrics | Record<string, unknown> | null | undefined} textMetrics
 * @param {import("../session-types.js").PedagogicalMeta | Record<string, unknown> | null | undefined} pedagogicalMeta
 * @returns {{ fillableMap: boolean, checkpoints: boolean, criticalMode: boolean }}
 */
export function decideSlowReadingModifiers(textMetrics, pedagogicalMeta) {
  const metrics = textMetrics && typeof textMetrics === "object" ? textMetrics : {};
  const meta = pedagogicalMeta && typeof pedagogicalMeta === "object" ? pedagogicalMeta : {};
  const structure =
    metrics.structureSignals && typeof metrics.structureSignals === "object"
      ? metrics.structureSignals
      : {};

  const argumentativeDensity = toFiniteNumber(meta.argumentativeDensity);
  const headingDensity = toFiniteNumber(structure.headingDensity);
  const hasExplicitHeadings = Boolean(structure.hasExplicitHeadings);
  const genre = String(meta.genre || "").trim();

  const fillableMap = argumentativeDensity >= FILLABLE_MAP_DENSITY_THRESHOLD;
  const checkpoints =
    hasExplicitHeadings || headingDensity >= CHECKPOINTS_HEADING_DENSITY_THRESHOLD;
  const criticalMode =
    argumentativeDensity >= CRITICAL_MODE_DENSITY_THRESHOLD ||
    CRITICAL_MODE_GENRES.includes(genre);

  return { fillableMap, checkpoints, criticalMode };
}
