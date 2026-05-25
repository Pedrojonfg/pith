/** Fisher–Yates shuffle for MC option order (anti–"answer is always B" bias). */

export const OPTION_LETTERS = ["A", "B", "C", "D"];

function randomIndex(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export function shuffleInPlace(arr) {
  const a = Array.isArray(arr) ? arr : [];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * Permute A–D option texts and update `answer` to the new letter for the same text.
 * Idempotent when `_optionsShuffled` is already set.
 */
export function shuffleTestQuestionOptions(question) {
  if (!question || typeof question !== "object") return question;
  if (question._optionsShuffled) return question;

  const type = String(question.type || "").trim().toLowerCase();
  if (type !== "test") return question;

  const options = question.options && typeof question.options === "object" ? question.options : null;
  if (!options) return question;

  const answerKey = String(question.answer ?? "").trim().toUpperCase();
  if (!OPTION_LETTERS.includes(answerKey)) return question;

  const correctText = options[answerKey];
  const values = OPTION_LETTERS.map((l) => options[l]);
  const shuffledValues = shuffleInPlace(values.slice());

  const newOptions = {};
  for (let i = 0; i < OPTION_LETTERS.length; i += 1) {
    newOptions[OPTION_LETTERS[i]] = shuffledValues[i];
  }

  let newAnswer = answerKey;
  for (const letter of OPTION_LETTERS) {
    if (newOptions[letter] === correctText) {
      newAnswer = letter;
      break;
    }
  }

  return {
    ...question,
    options: newOptions,
    answer: newAnswer,
    _optionsShuffled: true,
  };
}

export function shuffleTestQuestionsInList(questions) {
  if (!Array.isArray(questions)) return questions;
  return questions.map((q) => shuffleTestQuestionOptions(q));
}
