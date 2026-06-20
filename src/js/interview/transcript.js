/** Pure interview transcript helpers (20260620-nodoc-interview-capture). */

/**
 * @param {{ turn: number, question: string, questionSource: 'fixed'|'generated', answer: string, answeredAt?: number }} params
 */
export function createTurn({ turn, question, questionSource, answer, answeredAt = Date.now() }) {
  const safeAnswer = String(answer || "").trim();
  if (!safeAnswer) throw new Error("Interview answer cannot be empty.");
  const src = questionSource === "generated" ? "generated" : "fixed";
  return {
    turn: Math.max(1, Math.floor(Number(turn) || 1)),
    question: String(question || "").trim(),
    questionSource: src,
    answer: safeAnswer,
    answeredAt: Number.isFinite(Number(answeredAt)) ? Number(answeredAt) : Date.now(),
  };
}

/**
 * @param {object[]} transcript
 * @param {object} turn
 */
export function appendTurn(transcript, turn) {
  const list = Array.isArray(transcript) ? transcript : [];
  return [...list, turn];
}

/**
 * @param {object[]} transcript
 */
export function concatTranscriptForSource(transcript) {
  const list = Array.isArray(transcript) ? transcript : [];
  return list
    .map((row) => {
      const q = String(row?.question || "").trim();
      const a = String(row?.answer || "").trim();
      if (!q && !a) return "";
      return `Q: ${q}\nA: ${a}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * @param {object[]} transcript
 */
export function countAnsweredTurns(transcript) {
  return (Array.isArray(transcript) ? transcript : []).filter((row) =>
    String(row?.answer || "").trim(),
  ).length;
}

/**
 * @param {object[]} transcript
 * @param {number} minTurns
 */
export function canProceedToSynthesis(transcript, minTurns) {
  return countAnsweredTurns(transcript) >= Math.max(1, Math.floor(Number(minTurns) || 2));
}

/**
 * @param {object[]} transcript
 */
export function dynamicFollowUpsUsed(transcript) {
  return (Array.isArray(transcript) ? transcript : []).filter(
    (row) => row?.questionSource === "generated",
  ).length;
}

/**
 * @param {unknown} raw
 * @returns {object[]}
 */
export function normalizeInterviewTranscript(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === "object")
    .map((row, idx) => ({
      turn: Math.max(1, Math.floor(Number(row.turn) || idx + 1)),
      question: String(row.question || "").trim(),
      questionSource: row.questionSource === "generated" ? "generated" : "fixed",
      answer: String(row.answer || "").trim(),
      answeredAt: Number.isFinite(Number(row.answeredAt)) ? Number(row.answeredAt) : Date.now(),
    }))
    .filter((row) => row.question || row.answer);
}
