import { parseHeadings } from "./headings.js?v=20260622_9";
import { getPageSlice, charOffsetToPage } from "./pagination.js?v=20260622_9";
import { addAnnotation } from "./annotations.js?v=20260622_9";
import { storeActiveSession } from "../session.js?v=20260622_9";
import { generateCheckpointQuestion } from "./phase0.js?v=20260622_9";
import { getStudyLanguage } from "../ui.js?v=20260622_9";

const CHECKPOINT_DELAY_MS = 10000;
export const CHECKPOINT_CHIP_LABEL = "[= CHECKPOINT · 30 seg]";

/** Section boundaries within scope coordinates. */
export function buildSectionBoundaries(scopeText, format) {
  const text = String(scopeText || "");
  const headings = parseHeadings(text, format);
  if (!headings.length) {
    return [{ id: "full", charStart: 0, charEnd: text.length, title: "Document" }];
  }
  return headings.map((h, i) => {
    const next = headings[i + 1];
    return {
      id: String(h.label || i).toLowerCase().replace(/\s+/g, "-").slice(0, 40),
      charStart: h.charStart,
      charEnd: next ? next.charStart : text.length,
      title: h.label,
    };
  });
}

export function isLastPageOfSection(breakpoints, pageIndex, section) {
  const slice = getPageSlice(breakpoints, pageIndex);
  return slice.charEnd >= section.charEnd;
}

let checkpointTimer = null;
let checkpointEl = null;
let checkpointGen = 0;

export function clearCheckpointTimer() {
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = null;
}

/** Hide chip, cancel pending timer, and invalidate in-flight async show. */
export function hideCheckpointChip() {
  clearCheckpointTimer();
  checkpointGen += 1;
  if (checkpointEl) {
    checkpointEl.hidden = true;
    checkpointEl.innerHTML = "";
  }
}

function scopeTextForSession(session) {
  const slow = session?.slow;
  return String(slow?.normalizedTextFull || "").slice(
    slow?.readingScope?.charStart || 0,
    slow?.readingScope?.charEnd,
  );
}

async function dismissCheckpointsOnPage(session, breakpoints, pageIndex) {
  const slow = session?.slow;
  if (!slow) return;
  const sections = buildSectionBoundaries(scopeTextForSession(session), slow.normalizedFormat);
  const ids = sections
    .filter((s) => isLastPageOfSection(breakpoints, pageIndex, s))
    .map((s) => s.id);
  slow.checkpointsDismissed = [...new Set([...(slow.checkpointsDismissed || []), ...ids])];
  hideCheckpointChip();
  await storeActiveSession(session);
}

export function maybeScheduleCheckpoint(session, breakpoints, pageIndex, onAnswer) {
  clearCheckpointTimer();
  const slow = session?.slow;
  if (!slow || slow.phase !== "phase1" || slow.checkpointsEnabled === false) {
    hideCheckpointChip();
    return;
  }

  const scopeText = scopeTextForSession(session);
  const sections = buildSectionBoundaries(scopeText, slow.normalizedFormat);
  const dismissed = new Set(slow.checkpointsDismissed || []);
  const section = sections.find(
    (s) => isLastPageOfSection(breakpoints, pageIndex, s) && !dismissed.has(s.id),
  );
  if (!section) {
    hideCheckpointChip();
    return;
  }

  checkpointTimer = setTimeout(() => {
    void showCheckpointChip(session, section, breakpoints, pageIndex, onAnswer);
  }, CHECKPOINT_DELAY_MS);
}

function getSectionText(session, section) {
  return scopeTextForSession(session).slice(section.charStart, section.charEnd);
}

export async function resolveCheckpointQuestion(session, section) {
  const slow = session?.slow;
  if (!slow) return "";
  const cached = slow.checkpointQuestions?.[section.id];
  if (cached) return cached;

  const question = await generateCheckpointQuestion({
    section,
    argumentMap: slow.phase0?.argumentMap,
    sectionText: getSectionText(session, section),
    llmModel: session.llmModel || session._meta?.llm_model,
    phase0Skipped: slow.phase0Status === "skipped",
  });

  slow.checkpointQuestions = { ...(slow.checkpointQuestions || {}), [section.id]: question };
  await storeActiveSession(session);
  return question;
}

async function showCheckpointChip(session, section, breakpoints, pageIndex, onAnswer) {
  const slow = session?.slow;
  if (
    !slow ||
    slow.checkpointsEnabled === false ||
    (slow.checkpointsDismissed || []).includes(section.id)
  ) {
    return;
  }

  const gen = ++checkpointGen;
  if (!checkpointEl) {
    checkpointEl = document.createElement("div");
    checkpointEl.id = "slowCheckpointChip";
    checkpointEl.className = "slow-checkpoint-chip";
    document.body.appendChild(checkpointEl);
  }
  checkpointEl.innerHTML = "";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "slow-checkpoint-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss checkpoint");
  dismiss.textContent = "×";
  const onDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissCheckpointsOnPage(session, breakpoints, pageIndex);
  };
  dismiss.addEventListener("click", onDismiss);

  const label = document.createElement("span");
  label.className = "slow-checkpoint-label";
  label.textContent = CHECKPOINT_CHIP_LABEL;

  const questionEl = document.createElement("p");
  questionEl.className = "slow-checkpoint-question";
  questionEl.textContent = "…";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "slow-checkpoint-input";
  const lang = getStudyLanguage() || "English";
  input.placeholder = /spanish|español|^es/i.test(lang) ? "Tu respuesta…" : "Your answer…";

  const send = document.createElement("button");
  send.type = "button";
  send.textContent = "?";
  send.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    await addAnnotation(session, {
      type: "?",
      charStart: section.charEnd - 1,
      charEnd: section.charEnd,
      userText: text,
    });
    dismissCheckpointsOnPage(session, breakpoints, pageIndex);
    if (typeof onAnswer === "function") onAnswer();
  });

  checkpointEl.append(label, dismiss, questionEl, input, send);
  checkpointEl.hidden = false;

  let startX = 0;
  checkpointEl.addEventListener(
    "touchstart",
    (e) => {
      startX = e.changedTouches?.[0]?.clientX || 0;
    },
    { once: true, passive: true },
  );
  checkpointEl.addEventListener(
    "touchend",
    (e) => {
      const dx = (e.changedTouches?.[0]?.clientX || 0) - startX;
      if (Math.abs(dx) > 50) dismissCheckpointsOnPage(session, breakpoints, pageIndex);
    },
    { once: true, passive: true },
  );

  try {
    const question = await resolveCheckpointQuestion(session, section);
    if (gen !== checkpointGen || checkpointEl.hidden) return;
    questionEl.textContent = question;
  } catch {
    if (gen !== checkpointGen || checkpointEl.hidden) return;
    questionEl.textContent = "…";
  }
}

export { charOffsetToPage };
