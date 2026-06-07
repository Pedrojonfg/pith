/**
 * T12 — Flashcards UI: convert annotations → review queue
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260606_t12-flashcards.mjs
 */
import { JSDOM } from "jsdom";
import { resetStorage } from "./setup-dom.mjs";
import { LS_REVIEW_FLASHCARDS_PREFIX } from "../src/js/config.js";
import {
  addSlowFlashcardFromPayload,
  addSlowFlashcards,
  formatSlowFlashcardsForReview,
  getSlowFlashcardAnnotationIds,
  loadSlowFlashcards,
  normalizeSlowFlashcardPayload,
  SLOW_FLASHCARD_SOURCE,
} from "../src/js/review.js";
import {
  annotationsToFlashcardPayload,
  convertAnnotationsToFlashcards,
} from "../src/js/slow/gamification.js";
import {
  FLASHCARD_CONVERTIBLE_TYPES,
  getConvertibleFlashcardAnnotations,
  renderPhase3FlashcardPanel,
  wirePhase3FlashcardConvert,
} from "../src/js/slow/phase3.js";

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

const SESSION_ID = "slow-test-session-12";

function makeSession(annotations) {
  return {
    studyMode: "slow",
    _meta: { session_id: SESSION_ID },
    slow: { annotations },
  };
}

resetStorage();

// --- gamification payloads ---

const fcSession = makeSession([
  { id: "fc1", type: "≈", userText: "idea clave" },
  { id: "fc2", type: "→", userText: "explicación" },
  { id: "fc3", type: "⚑", userText: "flag only" },
  { id: "fc4", type: "⊘", userText: "objeción" },
]);

const cards = convertAnnotationsToFlashcards(fcSession);
assert(cards.length === 3, "T12 happy: convert filters →/≈/⊘ only (not ⚑)");
assert(cards.every((c) => c.source === "slow_mode"), "T12 happy: slow_mode source on payloads");

const payload = annotationsToFlashcardPayload({ id: "x1", type: "≈", userText: "nota corta" });
assert(payload?.front?.includes("≈") && payload.annotationId === "x1", "T12 happy: single payload shape");

assert(
  normalizeSlowFlashcardPayload({ front: "  ", annotationId: "a" }) === null,
  "T12 fail: empty front rejected",
);

// --- review queue API ---

const { added, total } = addSlowFlashcardFromPayload(SESSION_ID, payload);
assert(added === 1 && total === 1, "T12 happy: add single card to queue");

const dup = addSlowFlashcardFromPayload(SESSION_ID, payload);
assert(dup.added === 0 && dup.total === 1, "T12 edge: duplicate annotationId skipped");

const batch = addSlowFlashcards(SESSION_ID, [
  { front: "→ otra", back: "back", annotationId: "x2", source: SLOW_FLASHCARD_SOURCE },
  { front: "", annotationId: "bad" },
]);
assert(batch.total === 2 && batch.added === 1, "T12 edge: batch adds only valid new cards");

const stored = loadSlowFlashcards(SESSION_ID);
assert(stored.length === 2, "T12 happy: persisted in localStorage");
assert(
  localStorage.getItem(`${LS_REVIEW_FLASHCARDS_PREFIX}${SESSION_ID}`)?.includes("x1"),
  "T12 happy: storage key uses session id prefix",
);

const ids = getSlowFlashcardAnnotationIds(SESSION_ID);
assert(ids.has("x1") && ids.has("x2"), "T12 happy: annotation id set for UI state");

const reviewText = formatSlowFlashcardsForReview(stored);
assert(
  reviewText.includes("SPACED REPETITION FLASHCARDS") && reviewText.includes("→ otra"),
  "T12 happy: review content includes flashcard section",
);
assert(formatSlowFlashcardsForReview([]) === "", "T12 fail: empty queue yields no section");

// --- phase3 UI ---

const uiSession = makeSession([
  { id: "u1", type: "≈", userText: "parafraseo útil" },
  { id: "u2", type: "?", userText: "pregunta no convertible" },
  { id: "u3", type: "↯", userText: "tensión" },
]);

const convertible = getConvertibleFlashcardAnnotations(uiSession);
assert(
  convertible.length === 2 && convertible.every((a) => FLASHCARD_CONVERTIBLE_TYPES.includes(a.type)),
  "T12 happy: UI list only →/≈/⊘/↯ with text",
);

addSlowFlashcardFromPayload(SESSION_ID, annotationsToFlashcardPayload({ id: "u1", type: "≈", userText: "parafraseo útil" }));

const panelHtml = renderPhase3FlashcardPanel(uiSession, "Spanish", SESSION_ID);
assert(panelHtml.includes("Convertir"), "T12 happy: Convertir button in panel");
assert(panelHtml.includes("is-converted"), "T12 happy: already-queued card marked converted");
assert(panelHtml.includes("↯"), "T12 happy: ↯ type listed");

const dom = new JSDOM(`<div id="host">${panelHtml}</div>`);
const host = dom.window.document.getElementById("host");

wirePhase3FlashcardConvert(host, uiSession);
const btn = host.querySelector('button[data-annotation-id="u3"]:not([disabled])');
assert(btn, "T12 happy: unconverted ↯ has active Convertir button");

btn?.click();
assert(
  loadSlowFlashcards(SESSION_ID).some((c) => c.annotationId === "u3"),
  "T12 happy: one tap adds card to review queue",
);

const statusEl = host.querySelector(".slow-flashcard-status");
assert(statusEl && !statusEl.hidden && statusEl.textContent.includes("review"), "T12 happy: visual confirmation after convert");

console.log(`\nT12 flashcards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
