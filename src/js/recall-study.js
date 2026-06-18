import {
  deepSeekRecallTutor,
  deriveRecallQuestionCount,
  generateRecallQuestions,
  recallTypesForGoal,
} from "./recall-api.js";
import {
  computeInventoryHash,
  createEmptyRecallSlice,
  normalizeRecallSlice,
} from "./recall-slice.js";
import { ingestSm2FromRecallAnswer } from "./sm2-ingest.js";
import { promoteFromRecall } from "./concept-registry/ingest.js";
import { syncAssessmentSignalsFromRecall, getAssessmentSignals } from "./session-store.js";

/**
 * @param {object} doc
 * @param {object} pedagogicalMeta
 * @returns {object}
 */
export function buildDefaultRecallConfig(doc, pedagogicalMeta = null) {
  const meta = pedagogicalMeta || doc?.shared?.docHierarchy?.pedagogical_meta || {};
  const goal = String(meta.primaryLearningGoal || "understand_argument").trim();
  const chars = String(doc?.shared?.rawMarkdown || "").length;
  return {
    questionCount: deriveRecallQuestionCount(chars),
    types: recallTypesForGoal(goal),
    scope: "full",
  };
}

/**
 * @param {object} inventory
 * @param {string[]} conceptIds
 * @returns {{ term: string, definition: string }[]}
 */
export function resolveConceptDefinitions(inventory, conceptIds) {
  const byId = new Map(
    (Array.isArray(inventory) ? inventory : []).map((c) => [
      String(c.canonicalId || c.id || "").trim(),
      c,
    ]),
  );
  return (Array.isArray(conceptIds) ? conceptIds : [])
    .map((id) => {
      const key = String(id || "").trim();
      const c = byId.get(key);
      return {
        term: String(c?.label || c?.term || key).trim(),
        definition: String(c?.definition || c?.authorUsage || "").trim(),
      };
    })
    .filter((row) => row.term);
}

/**
 * @param {object} els
 * @param {object} slice
 * @param {number} index
 * @param {object} doc
 */
export function renderRecallScreen(els, slice, index, doc) {
  const questions = Array.isArray(slice?.questions) ? slice.questions : [];
  const total = questions.length;
  const qi = Math.min(Math.max(0, index), Math.max(0, total - 1));
  const q = questions[qi];

  if (els.recallProgress) {
    els.recallProgress.textContent = total ? `${qi + 1} / ${total}` : "0 / 0";
  }
  if (els.recallQuestionText) {
    els.recallQuestionText.textContent = q?.question || "Generating questions…";
  }
  if (els.recallTypeBadge) {
    const type = String(q?.recall_type || "").trim();
    if (type) {
      els.recallTypeBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      els.recallTypeBadge.hidden = false;
    } else {
      els.recallTypeBadge.hidden = true;
    }
  }
  if (els.recallAnswer) els.recallAnswer.value = String(q?.student_answer || "");
  if (els.recallFeedbackPanel) els.recallFeedbackPanel.hidden = !q?.tutor_feedback;
  if (els.recallCritique) {
    els.recallCritique.textContent = q?.tutor_feedback?.critique || "";
  }
  if (els.recallSuggestedText) {
    els.recallSuggestedText.textContent = q?.tutor_feedback?.suggested_answer || "";
  }
  if (els.recallSuggested) {
    els.recallSuggested.hidden = !q?.tutor_feedback?.suggested_answer;
  }
  if (els.recallQualityBadge) {
    const quality = q?.tutor_feedback?.quality;
    els.recallQualityBadge.textContent = quality ? `Quality: ${quality}` : "";
  }
  const answered = Boolean(q?.tutor_feedback);
  if (els.recallSubmitBtn) els.recallSubmitBtn.hidden = answered;
  if (els.recallNextBtn) {
    els.recallNextBtn.hidden = !answered || qi >= total - 1;
    els.recallNextBtn.textContent = qi >= total - 1 ? "Finish" : "Next question";
  }
  if (els.recallConceptPeekList && q?.concept_ids?.length) {
    const defs = resolveConceptDefinitions(doc?.shared?.conceptInventory, q.concept_ids);
    els.recallConceptPeekList.innerHTML = defs
      .map((d) => `<li><strong>${escapeHtml(d.term)}</strong>: ${escapeHtml(d.definition || "—")}</li>`)
      .join("");
  }
  if (els.recallError) {
    els.recallError.hidden = true;
    els.recallError.textContent = "";
  }
  if (els.recallStatus) els.recallStatus.textContent = "";
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {object} doc
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function generateRecallSliceForDoc(doc, options = {}) {
  let inventory = doc?.shared?.conceptInventory || [];
  const focusGlobalId = String(options.focusGlobalConceptId || "").trim();
  if (focusGlobalId) {
    inventory = inventory.filter((c) => c.globalConceptId === focusGlobalId);
    if (!inventory.length) {
      const concept = await import("./concept-registry/registry-store.js").then((m) =>
        m.getConceptById(focusGlobalId),
      );
      if (concept) {
        inventory = [
          {
            canonicalId: concept.slug,
            label: concept.canonicalName,
            definition: "",
            globalConceptId: concept.id,
          },
        ];
      }
    }
  }
  if (!inventory.length) throw new Error("Concept inventory required before recall generation.");
  const meta = doc?.shared?.docHierarchy?.pedagogical_meta || buildDeterministicPedagogicalMetaFallback(doc);
  const config = buildDefaultRecallConfig(doc, meta);
  const signals = getAssessmentSignals(doc.docId) || doc?.shared?.assessmentSignals || [];
  const questions = await generateRecallQuestions({
    rawMarkdown: doc.shared.rawMarkdown,
    conceptInventory: inventory,
    pedagogicalMeta: meta,
    assessmentSignals: signals,
    config,
    lang: options.language,
    llmModel: options.llmModel,
  });
  const slice = normalizeRecallSlice({
    status: "ready",
    questions,
    currentIndex: 0,
    config,
    _meta: {
      generatedAt: Date.now(),
      sourceInventoryHash: computeInventoryHash(inventory, meta),
      usedAssessmentSignals: signals.length > 0,
    },
  });
  return slice;
}

function buildDeterministicPedagogicalMetaFallback(doc) {
  const text = String(doc?.shared?.rawMarkdown || "");
  return { primaryLearningGoal: "understand_argument", argumentativeDensity: text.length > 20000 ? 3 : 2 };
}

/**
 * @param {object} handlers
 */
export function createRecallStudyController(handlers) {
  const {
    els,
    getDoc,
    persistSlice,
    showScreen,
    setStudyMode,
    runConceptInventoryForDoc,
    getLanguage,
    getLlmModel,
    getFocusGlobalConceptId,
    updateFlowProgress,
    onComplete,
  } = handlers;

  let generating = false;

  function currentDoc() {
    return getDoc();
  }

  function getSlice(doc) {
    return normalizeRecallSlice(doc?.modes?.recall || createEmptyRecallSlice());
  }

  function saveSlice(doc, slice) {
    const next = normalizeRecallSlice(slice);
    doc.modes.recall = next;
    persistSlice(doc, "recall", next);
    return next;
  }

  async function runGeneration(doc, { freshInventory = false } = {}) {
    if (generating) return;
    generating = true;
    let slice = getSlice(doc);
    slice.status = "generating";
    saveSlice(doc, slice);
    renderRecallScreen(els, slice, 0, doc);
    if (els.recallStatus) els.recallStatus.textContent = "Generating recall questions…";

    try {
      if (freshInventory) {
        if (els.recallStatus) els.recallStatus.textContent = "Building concept inventory…";
        await runConceptInventoryForDoc(doc);
      }
      const next = await generateRecallSliceForDoc(doc, {
        language: getLanguage(),
        llmModel: getLlmModel(),
        focusGlobalConceptId: typeof getFocusGlobalConceptId === "function" ? getFocusGlobalConceptId() : null,
      });
      next.status = "in_progress";
      saveSlice(doc, next);
      renderRecallScreen(els, next, next.currentIndex, doc);
      showScreen("recall");
    } catch (err) {
      const failed = getSlice(doc);
      failed.status = "not_started";
      saveSlice(doc, failed);
      if (els.recallError) {
        els.recallError.hidden = false;
        els.recallError.textContent = String(err?.message || err || "Generation failed.");
      }
      if (els.recallStatus) els.recallStatus.textContent = "";
      throw err;
    } finally {
      generating = false;
    }
  }

  async function enterRecall(entry) {
    const doc = currentDoc();
    if (!doc) return;
    setStudyMode("recall");

    if (entry.action === "resume" && entry.slice) {
      const slice = normalizeRecallSlice(entry.slice);
      if (slice.status !== "in_progress") slice.status = "in_progress";
      saveSlice(doc, slice);
      renderRecallScreen(els, slice, slice.currentIndex, doc);
      showScreen("recall");
      return;
    }

    if (entry.action === "recall_bootstrap") {
      const existing = getSlice(doc);
      const meta = doc.shared?.docHierarchy?.pedagogical_meta || {};
      const hash = computeInventoryHash(doc.shared?.conceptInventory, meta);
      if (
        existing.status === "ready" &&
        existing.questions.length > 0 &&
        existing._meta?.sourceInventoryHash === hash
      ) {
        existing.status = "in_progress";
        saveSlice(doc, existing);
        renderRecallScreen(els, existing, existing.currentIndex, doc);
        showScreen("recall");
        return;
      }
      await runGeneration(doc);
      return;
    }

    if (entry.action === "recall_generate_fresh") {
      await runGeneration(doc, { freshInventory: true });
    }
  }

  async function submitAnswer() {
    const doc = currentDoc();
    if (!doc) return;
    const slice = getSlice(doc);
    const qi = slice.currentIndex;
    const q = slice.questions[qi];
    if (!q) return;

    const answer = String(els.recallAnswer?.value || "").trim();
    if (!answer) {
      if (els.recallError) {
        els.recallError.hidden = false;
        els.recallError.textContent = "Write an answer before submitting.";
      }
      return;
    }

    if (els.recallSubmitBtn) els.recallSubmitBtn.disabled = true;
    if (els.recallStatus) els.recallStatus.textContent = "Evaluating…";
    if (els.recallError) els.recallError.hidden = true;

    try {
      const feedback = await deepSeekRecallTutor({
        question: q.question,
        recall_type: q.recall_type,
        student_answer: answer,
        concept_ids: q.concept_ids,
        concept_definitions: resolveConceptDefinitions(doc.shared?.conceptInventory, q.concept_ids),
        source_chunk: (q.source_chunks || []).join("\n\n"),
        lang: getLanguage(),
        llmModel: getLlmModel(),
      });

      const updated = { ...q, student_answer: answer, tutor_feedback: feedback };
      const questions = slice.questions.slice();
      questions[qi] = updated;
      const nextSlice = saveSlice(doc, { ...slice, questions, status: "in_progress" });

      ingestSm2FromRecallAnswer({ docId: doc.docId, question: updated });
      void promoteFromRecall({ docId: doc.docId, question: updated });
      syncAssessmentSignalsFromRecall(doc.docId, updated);

      renderRecallScreen(els, nextSlice, qi, doc);
    } catch (err) {
      if (els.recallError) {
        els.recallError.hidden = false;
        els.recallError.textContent = String(err?.message || err || "Tutor evaluation failed.");
      }
    } finally {
      if (els.recallSubmitBtn) els.recallSubmitBtn.disabled = false;
      if (els.recallStatus) els.recallStatus.textContent = "";
    }
  }

  function nextQuestion() {
    const doc = currentDoc();
    if (!doc) return;
    const slice = getSlice(doc);
    const qi = slice.currentIndex;
    if (!slice.questions[qi]?.tutor_feedback) return;

    if (qi >= slice.questions.length - 1) {
      const done = saveSlice(doc, { ...slice, status: "complete" });
      if (updateFlowProgress) updateFlowProgress(doc, "recall");
      if (onComplete) onComplete(done);
      if (els.recallStatus) els.recallStatus.textContent = "Session complete.";
      return;
    }

    const nextSlice = saveSlice(doc, { ...slice, currentIndex: qi + 1 });
    renderRecallScreen(els, nextSlice, nextSlice.currentIndex, doc);
  }

  function wireHandlers() {
    els.recallSubmitBtn?.addEventListener("click", () => void submitAnswer());
    els.recallNextBtn?.addEventListener("click", () => nextQuestion());
    els.recallBackBtn?.addEventListener("click", () => handlers.onBack?.());
  }

  return { enterRecall, runGeneration, renderRecallScreen, wireHandlers, submitAnswer, nextQuestion };
}
