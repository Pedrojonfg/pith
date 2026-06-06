import { parseHeadings } from "./headings.js?v=20260528_1";
import { getPageSlice, charOffsetToPage } from "./pagination.js?v=20260528_1";
import { addAnnotation } from "./annotations.js?v=20260528_1";
import { storeActiveSession } from "../session.js?v=20260527_1";

const CHECKPOINT_DELAY_MS = 10000;

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

export function clearCheckpointTimer() {
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = null;
}

export function maybeScheduleCheckpoint(session, breakpoints, pageIndex, onAnswer) {
  clearCheckpointTimer();
  const slow = session?.slow;
  if (!slow || slow.phase !== "phase1") return;

  const scopeText = String(session.slow?.normalizedTextFull || "").slice(
    slow.readingScope?.charStart || 0,
    slow.readingScope?.charEnd,
  );
  const sections = buildSectionBoundaries(scopeText, slow.normalizedFormat);
  const dismissed = new Set(slow.checkpointsDismissed || []);
  const section = sections.find(
    (s) => isLastPageOfSection(breakpoints, pageIndex, s) && !dismissed.has(s.id),
  );
  if (!section) return;

  checkpointTimer = setTimeout(() => {
    showCheckpointChip(session, section, onAnswer);
  }, CHECKPOINT_DELAY_MS);
}

function showCheckpointChip(session, section, onAnswer) {
  if (!checkpointEl) {
    checkpointEl = document.createElement("div");
    checkpointEl.id = "slowCheckpointChip";
    checkpointEl.className = "slow-checkpoint-chip";
    document.body.appendChild(checkpointEl);
  }
  checkpointEl.innerHTML = "";
  const label = document.createElement("span");
  label.textContent = `[≡ CHECKPOINT · ${section.title}]`;
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => {
    session.slow.checkpointsDismissed = [...(session.slow.checkpointsDismissed || []), section.id];
    storeActiveSession(session);
    checkpointEl.hidden = true;
  });
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Integra la sección en una frase…";
  const send = document.createElement("button");
  send.type = "button";
  send.textContent = "→";
  send.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) return;
    addAnnotation(session, {
      type: "→",
      charStart: section.charEnd - 1,
      charEnd: section.charEnd,
      userText: text,
    });
    session.slow.checkpointsDismissed = [...(session.slow.checkpointsDismissed || []), section.id];
    storeActiveSession(session);
    checkpointEl.hidden = true;
    if (typeof onAnswer === "function") onAnswer();
  });
  checkpointEl.append(dismiss, label, input, send);
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
      if (Math.abs(dx) > 50) {
        session.slow.checkpointsDismissed = [...(session.slow.checkpointsDismissed || []), section.id];
        storeActiveSession(session);
        checkpointEl.hidden = true;
      }
    },
    { once: true, passive: true },
  );
}

export { charOffsetToPage };
