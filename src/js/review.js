import { deepSeekGenerateReviewBatch, deepSeekReviewSocraticTutor } from "./api.js?v=20260503_7";
import { buildMarkdown } from "./export.js?v=20260503_7";
import { LS_REVIEW_SESSION_MD_KEY } from "./config.js?v=20260503_7";
import { clampInt, getStoredKey, state } from "./session.js?v=20260503_7";
import { els, showScreen, typesetMath } from "./ui.js?v=20260503_7";

let reviewType = "both"; // "test" | "socratic" | "both"
let reviewQuestions = [];
let reviewIndex = 0;
let reviewCorrect = 0;
let reviewTestTotal = 0;
let reviewAnswers = [];
let reviewGenCancelToken = { cancelled: false };
let reviewSessionContent = "";

function setReviewConfigError(msg) {
  els.reviewConfigError.hidden = false;
  els.reviewConfigError.textContent = String(msg || "");
}
function clearReviewConfigError() {
  els.reviewConfigError.hidden = true;
  els.reviewConfigError.textContent = "";
}
function setReviewGeneratingError(msg) {
  els.reviewGeneratingError.hidden = false;
  els.reviewGeneratingError.textContent = String(msg || "");
}
function clearReviewGeneratingError() {
  els.reviewGeneratingError.hidden = true;
  els.reviewGeneratingError.textContent = "";
}
function setReviewError(msg) {
  els.reviewError.hidden = false;
  els.reviewError.textContent = String(msg || "");
}
function clearReviewError() {
  els.reviewError.hidden = true;
  els.reviewError.textContent = "";
}

function setReviewType(nextType) {
  reviewType = nextType;
  const isTest = reviewType === "test";
  const isSocratic = reviewType === "socratic";
  const isBoth = reviewType === "both";
  els.reviewTypeTestBtn.setAttribute("aria-pressed", String(isTest));
  els.reviewTypeSocraticBtn.setAttribute("aria-pressed", String(isSocratic));
  els.reviewTypeBothBtn.setAttribute("aria-pressed", String(isBoth));
}

function getReviewQuestionCount() {
  return clampInt(els.reviewNQuestionsInput.value, 1, 100, 20);
}

function getSessionMarkdownForReview() {
  const stored = localStorage.getItem(LS_REVIEW_SESSION_MD_KEY);
  if (stored && stored.trim()) return stored;
  if (!state.activeSession) return "";
  const md = buildMarkdown(state.activeSession);
  try {
    localStorage.setItem(LS_REVIEW_SESSION_MD_KEY, md);
  } catch {
    // ignore
  }
  return md;
}

function extractSessionContentFromMarkdown(md) {
  const text = String(md || "");
  if (!text.trim()) return "";
  const parts = [];
  const re =
    /^##\s+Block\s+\d+:\s+.*\n([\s\S]*?)\n###\s+Questions(?:\s*&\s*Answers)?\s*$/gim;
  let m = null;
  while ((m = re.exec(text))) {
    const expl = String(m[1] || "").trim();
    if (expl) parts.push(expl);
  }
  return parts.join("\n\n").trim();
}

function buildSessionContentForReview() {
  const md = getSessionMarkdownForReview();
  const parsed = extractSessionContentFromMarkdown(md);
  if (parsed) return parsed;

  const blocks = Array.isArray(state.activeSession?.blocks) ? state.activeSession.blocks : [];
  return blocks
    .map((b) => (b && typeof b === "object" ? String(b.explanation || "").trim() : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function parseJsonArrayFromModel(content) {
  const raw = String(content || "").trim();
  if (!raw) throw new Error("Empty model response.");
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error("Response is not a JSON array.");
    return arr;
  } catch {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start >= 0 && end > start) {
      const slice = raw.slice(start, end + 1);
      const arr = JSON.parse(slice);
      if (!Array.isArray(arr)) throw new Error("Response is not a JSON array.");
      return arr;
    }
    throw new Error("Failed to parse JSON array from model response.");
  }
}

function updateReviewScoreUi() {
  if (reviewTestTotal <= 0) {
    els.reviewScore.textContent = "";
    return;
  }
  els.reviewScore.textContent = `${reviewCorrect} / ${reviewTestTotal} correct`;
}

function normalizeReviewQuestion(q) {
  const obj = q && typeof q === "object" ? q : {};
  const type = String(obj.type || "").trim().toLowerCase();
  const question = String(obj.question || "").trim();
  const options = obj.options && typeof obj.options === "object" ? obj.options : null;
  const answer = obj.answer != null ? String(obj.answer).trim() : "";
  const feedback = obj.feedback != null ? String(obj.feedback).trim() : "";
  if (!question) return null;
  const safeType =
    type === "test" || type === "socratic"
      ? type
      : reviewType === "socratic"
        ? "socratic"
        : "test";
  return { type: safeType, question, options, answer, feedback };
}

function renderReviewQuestion() {
  clearReviewError();
  const total = reviewQuestions.length;
  const q = reviewQuestions[reviewIndex];
  if (!q) {
    setReviewError("No questions loaded.");
    return;
  }

  els.reviewMeta.textContent = `Question ${reviewIndex + 1} of ${total}`;
  updateReviewScoreUi();

  els.reviewQuestionText.textContent = String(q.question || "");
  typesetMath(els.reviewQuestionText);

  els.reviewTestView.hidden = true;
  els.reviewSocraticView.hidden = true;
  els.reviewTestOptions.innerHTML = "";
  els.reviewTestFeedback.hidden = true;
  els.reviewTestFeedback.textContent = "";
  els.reviewNextBtn.hidden = true;

  els.reviewSocraticAnswer.value = "";
  els.reviewSocraticResponseBox.hidden = true;
  els.reviewSocraticResponseBox.textContent = "";
  els.reviewSocraticStatus.textContent = "";
  els.reviewSocraticNextBtn.hidden = true;

  if (q.type === "test") {
    els.reviewTestView.hidden = false;
    const opts = q.options && typeof q.options === "object" ? q.options : {};
    const letters = ["A", "B", "C", "D"];
    for (const letter of letters) {
      const label = opts[letter] != null ? String(opts[letter]).trim() : "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${letter}. ${label || ""}`.trim();
      btn.addEventListener("click", () => {
        const correct = String(q.answer || "").trim();
        const isCorrect = correct && letter === correct;
        reviewAnswers[reviewIndex] = {
          type: "test",
          user_answer: letter,
          correct_answer: correct,
          correct: !!isCorrect,
        };
        if (isCorrect) reviewCorrect += 1;

        const all = Array.from(els.reviewTestOptions.querySelectorAll("button"));
        for (const b of all) b.disabled = true;
        for (const b of all) {
          const t = String(b.textContent || "");
          const l = t.slice(0, 1);
          if (correct && l === correct) b.classList.add("is-correct");
          if (l === letter && !isCorrect) b.classList.add("is-wrong");
        }

        updateReviewScoreUi();

        const fb =
          q.feedback ||
          (correct ? `Correct answer: ${correct}` : "") ||
          (isCorrect ? "Correct." : "Incorrect.");
        els.reviewTestFeedback.hidden = false;
        els.reviewTestFeedback.textContent = fb;
        typesetMath(els.reviewTestFeedback);

        const isLast = reviewIndex >= total - 1;
        els.reviewNextBtn.hidden = false;
        els.reviewNextBtn.textContent = isLast ? "Finish" : "Next";
      });
      els.reviewTestOptions.appendChild(btn);
    }
    return;
  }

  els.reviewSocraticView.hidden = false;
  setTimeout(() => els.reviewSocraticAnswer.focus(), 0);
}

function showReviewSummary() {
  const total = reviewQuestions.length;
  const hasAnyTest = reviewQuestions.some((q) => q && q.type === "test");

  if (!hasAnyTest) {
    els.reviewSummaryMeta.textContent = `Completed ${total} Socratic questions.`;
    els.reviewWrongList.hidden = true;
    els.reviewWrongList.textContent = "";
  } else {
    const scoredTotal = reviewQuestions.filter((q) => q && q.type === "test").length;
    const pct = scoredTotal ? Math.round((reviewCorrect / scoredTotal) * 100) : 0;
    els.reviewSummaryMeta.textContent = `${reviewCorrect} / ${scoredTotal} correct (${pct}%)`;

    const wrong = [];
    for (let i = 0; i < reviewQuestions.length; i += 1) {
      const q = reviewQuestions[i];
      if (!q || q.type !== "test") continue;
      const a = reviewAnswers[i];
      if (!a || a.correct) continue;
      wrong.push({
        question: String(q.question || ""),
        user: String(a.user_answer || ""),
        correct: String(a.correct_answer || ""),
      });
    }

    if (wrong.length) {
      const lines = [];
      lines.push("Wrong answers:");
      lines.push("");
      for (const w of wrong) {
        lines.push(`- Q: ${w.question}`);
        lines.push(`  - Your answer: ${w.user || "(blank)"}`);
        lines.push(`  - Correct: ${w.correct || "(unknown)"}`);
      }
      els.reviewWrongList.hidden = false;
      els.reviewWrongList.textContent = lines.join("\n");
    } else {
      els.reviewWrongList.hidden = true;
      els.reviewWrongList.textContent = "";
    }
  }

  showScreen("reviewSummary");
}

function resetReviewRun() {
  reviewQuestions = [];
  reviewIndex = 0;
  reviewCorrect = 0;
  reviewTestTotal = 0;
  reviewAnswers = [];
  reviewSessionContent = "";
  clearReviewConfigError();
  clearReviewGeneratingError();
  clearReviewError();
  els.reviewGeneratingLabel.textContent = "Generating questions…";
  els.reviewGeneratingFill.style.width = "0%";
  els.reviewTestFeedback.hidden = true;
  els.reviewTestFeedback.textContent = "";
  els.reviewSocraticResponseBox.hidden = true;
  els.reviewSocraticResponseBox.textContent = "";
  els.reviewSocraticStatus.textContent = "";
  els.reviewNextBtn.hidden = true;
  els.reviewSocraticNextBtn.hidden = true;
}

function showReviewConfig() {
  resetReviewRun();
  els.reviewConfigStatus.textContent = "";
  els.reviewNQuestionsInput.value = String(getReviewQuestionCount());
  setReviewType(reviewType);
  showScreen("reviewConfig");
}

async function startReviewGeneration() {
  clearReviewConfigError();
  clearReviewGeneratingError();

  const apiKey = getStoredKey();
  if (!apiKey) {
    setReviewConfigError("Missing API key.");
    return;
  }

  const nQuestions = getReviewQuestionCount();
  if (!state.activeSession) {
    setReviewConfigError("No active session found to review.");
    return;
  }

  const sessionContent = buildSessionContentForReview();
  if (!sessionContent) {
    setReviewConfigError("Could not extract session content for review.");
    return;
  }

  reviewSessionContent = sessionContent;
  reviewGenCancelToken = { cancelled: false };
  showScreen("reviewGenerating");

  const total = nQuestions;
  let done = 0;
  const batches = [];
  for (let i = 0; i < total; i += 20) {
    batches.push(Math.min(20, total - i));
  }

  const all = [];
  for (const batchSize of batches) {
    if (reviewGenCancelToken.cancelled) return;
    els.reviewGeneratingLabel.textContent = `Generating questions… (${done}/${total})`;
    els.reviewGeneratingFill.style.width = `${Math.round((done / total) * 100)}%`;

    const content = await deepSeekGenerateReviewBatch({
      apiKey,
      sessionContent,
      type: reviewType,
      batchSize,
    });

    const arr = parseJsonArrayFromModel(content);
    if (arr.length !== batchSize) {
      throw new Error(`Model returned ${arr.length} items, expected ${batchSize}.`);
    }

    for (const item of arr) {
      const norm = normalizeReviewQuestion(item);
      if (norm) all.push(norm);
    }

    done += batchSize;
    els.reviewGeneratingLabel.textContent = `Generating questions… (${done}/${total})`;
    els.reviewGeneratingFill.style.width = `${Math.round((done / total) * 100)}%`;
  }

  if (reviewGenCancelToken.cancelled) return;
  if (all.length !== total) {
    throw new Error(`Generated ${all.length} usable questions, expected ${total}.`);
  }

  reviewQuestions = all;
  reviewIndex = 0;
  reviewCorrect = 0;
  reviewTestTotal = reviewQuestions.filter((q) => q && q.type === "test").length;
  reviewAnswers = new Array(reviewQuestions.length).fill(null);

  showScreen("review");
  renderReviewQuestion();
}

export function wireReviewHandlers() {
  if (els.reviewSessionBtn) {
    els.reviewSessionBtn.addEventListener("click", () => showReviewConfig());
  }

  els.reviewTypeTestBtn.addEventListener("click", () => setReviewType("test"));
  els.reviewTypeSocraticBtn.addEventListener("click", () => setReviewType("socratic"));
  els.reviewTypeBothBtn.addEventListener("click", () => setReviewType("both"));

  els.reviewCancelBtn.addEventListener("click", () => showScreen("complete"));

  els.reviewStartBtn.addEventListener("click", async () => {
    els.reviewConfigStatus.textContent = "";
    els.reviewConfigStatus.textContent = "Preparing…";
    try {
      await startReviewGeneration();
    } catch (err) {
      setReviewGeneratingError(err?.message ? String(err.message) : String(err));
    } finally {
      els.reviewConfigStatus.textContent = "";
    }
  });

  els.reviewGeneratingCancelBtn.addEventListener("click", () => {
    reviewGenCancelToken.cancelled = true;
    showScreen("complete");
  });

  els.reviewQuitBtn.addEventListener("click", () => showScreen("complete"));

  els.reviewNextBtn.addEventListener("click", () => {
    const isLast = reviewIndex >= reviewQuestions.length - 1;
    if (isLast) {
      showReviewSummary();
      return;
    }
    reviewIndex += 1;
    renderReviewQuestion();
  });

  els.reviewSocraticSendBtn.addEventListener("click", async () => {
    clearReviewError();
    els.reviewSocraticResponseBox.hidden = true;
    els.reviewSocraticResponseBox.textContent = "";
    els.reviewSocraticNextBtn.hidden = true;

    const q = reviewQuestions[reviewIndex];
    if (!q || q.type !== "socratic") {
      setReviewError("Missing Socratic question.");
      return;
    }

    const apiKey = getStoredKey();
    if (!apiKey) {
      setReviewError("Missing API key.");
      return;
    }

    const answer = String(els.reviewSocraticAnswer.value || "").trim();
    if (!answer) {
      setReviewError("Please write an answer before submitting.");
      return;
    }

    els.reviewSocraticStatus.textContent = "Calling DeepSeek…";
    els.reviewSocraticSendBtn.disabled = true;
    try {
      const resp = await deepSeekReviewSocraticTutor({
        apiKey,
        sessionContent: reviewSessionContent,
        question: String(q.question || ""),
        studentAnswer: answer,
      });
      els.reviewSocraticResponseBox.hidden = false;
      els.reviewSocraticResponseBox.textContent = resp;
      typesetMath(els.reviewSocraticResponseBox);

      reviewAnswers[reviewIndex] = {
        type: "socratic",
        user_answer: answer,
        feedback: resp,
      };

      const isLast = reviewIndex >= reviewQuestions.length - 1;
      els.reviewSocraticNextBtn.hidden = false;
      els.reviewSocraticNextBtn.textContent = isLast ? "Finish" : "Next";
    } catch (err) {
      setReviewError(err?.message ? String(err.message) : String(err));
    } finally {
      els.reviewSocraticSendBtn.disabled = false;
      els.reviewSocraticStatus.textContent = "";
    }
  });

  els.reviewSocraticNextBtn.addEventListener("click", () => {
    const isLast = reviewIndex >= reviewQuestions.length - 1;
    if (isLast) {
      showReviewSummary();
      return;
    }
    reviewIndex += 1;
    renderReviewQuestion();
  });

  els.reviewSummaryBackBtn.addEventListener("click", () => showScreen("complete"));
  els.reviewSummaryNewBtn.addEventListener("click", () => showReviewConfig());
}

