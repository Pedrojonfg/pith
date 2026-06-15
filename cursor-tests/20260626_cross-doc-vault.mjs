/**
 * Cross-Document Concept Vault integration tests
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260626_cross-doc-vault.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  loadRegistry,
  saveRegistry,
  upsertConcept,
  getConceptBySlug,
  getDueFacetSchedules,
  REGISTRY_STORAGE_KEY,
} from "../src/js/concept-registry/registry-store.js";
import { resolveGlobalConcept, normalizeSlug } from "../src/js/concept-registry/identity-resolution.js";
import {
  onConceptEngagement,
  qualifiesForGreen,
} from "../src/js/concept-registry/promotion.js";
import { buildVaultGraph } from "../src/js/concept-registry/vault-graph-adapter.js";
import { buildGlobalReviewQueue } from "../src/js/concept-registry/global-review.js";
import {
  createSession,
  getSession,
  saveActiveSession,
  addConceptsToShared,
} from "../src/js/session-store.js";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

resetStorage();
localStorage.removeItem(REGISTRY_STORAGE_KEY);

// --- registry store round-trip ---

const concept = upsertConcept({
  canonicalName: "Laplace Transform",
  slug: "laplace-transform",
  aliases: [],
  maturity: "yellow",
  mastery: 0,
  facets: [
    {
      facet: "recognition",
      interval: 0,
      repetitions: 0,
      easeFactor: 2.5,
      dueDate: "2020-01-01",
      lastReviewedAt: "",
      lastQuality: 0,
    },
  ],
  content: null,
  sourceDocIds: ["doc-a"],
});
assert(concept.id && concept.slug === "laplace-transform", "registry: upsertConcept");

const reloaded = loadRegistry();
assert(reloaded.concepts.length === 1, "registry: loadRegistry round-trip");

// --- identity resolution ---

const resolved = await resolveGlobalConcept({
  canonicalName: "Laplace Transform",
  sourceDocId: "doc-b",
});
assert(resolved.conceptId === concept.id && resolved.created === false, "resolution: slug reuse");

const split = await resolveGlobalConcept({
  canonicalName: "Inverse Laplace Transform",
  sourceDocId: "doc-a",
});
assert(split.created === true && split.conceptId !== concept.id, "resolution: ambiguous split");

// --- gray → yellow promotion ---

const session = await createSession("# Cross doc\n\nTest", { docId: "doc-promo" });
addConceptsToShared("doc-promo", [
  { canonicalId: "abc123", label: "Entropy", definition: "Measure of disorder" },
]);
const fresh = getSession("doc-promo");
const result = await onConceptEngagement({
  session: fresh,
  conceptId: "abc123",
  facet: "recognition",
  quality: 4,
  source: "rsvp",
});
assert(result.globalConceptId && result.maturity === "yellow", "promotion: gray→yellow");

const after = getSession("doc-promo");
const entry = after.shared.conceptInventory.find((c) => c.canonicalId === "abc123");
assert(entry?.globalConceptId === result.globalConceptId, "promotion: backfill globalConceptId");

// --- yellow → green ---

assert(qualifiesForGreen("synthesis", 4, "recall") === true, "green: synthesis qualifies");
assert(qualifiesForGreen("applicative", 5, "recall") === false, "green: applicative alone excluded");

const greenResult = await onConceptEngagement({
  session: after,
  conceptId: "abc123",
  facet: "synthesis",
  quality: 4,
  source: "recall",
  contentText: "Entropy increases in isolated systems.",
  recallType: "synthesis",
});
assert(greenResult.promotedToGreen === true, "promotion: yellow→green");

// --- global review queue dedup ---

saveRegistry({
  schemaVersion: 1,
  concepts: [
    {
      ...concept,
      facets: [
        {
          facet: "recognition",
          interval: 1,
          repetitions: 1,
          easeFactor: 2.5,
          dueDate: "2020-01-01",
          lastReviewedAt: "2020-01-01",
          lastQuality: 4,
        },
      ],
    },
  ],
  observations: [],
  lastUpdated: Date.now(),
});

const queue = buildGlobalReviewQueue({ projectId: "all" });
assert(queue.some((i) => i.sourceType === "global_concept"), "review: global queue includes facet schedule");

// --- vault graph cold vs focused ---

const cold = buildVaultGraph({ focusedDocId: null });
assert(cold.nodes.every((n) => n.maturity !== "gray" || n.scope === "global"), "graph: cold has no local gray");

const focused = buildVaultGraph({ focusedDocId: "doc-promo" });
assert(
  focused.nodes.some((n) => n.maturity === "gray" && n.scope === "local"),
  "graph: focused overlays gray neighbors",
);

// --- session schema v3 migration ---

const v2like = await createSession("# v2\n", { docId: "doc-v3" });
v2like.schemaVersion = 2;
delete v2like.shared.conceptInventory[0]?.globalConceptId;
saveActiveSession(v2like);
const migrated = getSession("doc-v3");
assert(migrated.schemaVersion === 3, "migration: schemaVersion 3");
assert(
  migrated.shared.conceptInventory.every((c) => "globalConceptId" in c),
  "migration: globalConceptId field present",
);

assert(normalizeSlug("Foo Bar!") === "foo-bar", "slug: normalize");

console.log(`\n20260626_cross-doc-vault: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
