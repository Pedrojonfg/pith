/** Fisher–Yates shuffle for MC option order (anti–"answer is always B" bias). */

export const OPTION_LETTERS = ["A", "B", "C", "D"];

/** Strip model echo like "B. answer text" — UI renders the letter separately. */
export function stripOptionLetterPrefix(text) {
  const s = String(text ?? "").trim();
  if (!s) return "";
  return s
    .replace(/^\([A-Da-d]\)\s*/, "")
    .replace(/^[A-Da-d][.)]\s*/, "")
    .trim();
}

function cleanOptionText(text) {
  return stripOptionLetterPrefix(String(text ?? "").trim());
}

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

function optionTextFromEntry(entry) {
  if (entry == null) return "";
  if (typeof entry === "string" || typeof entry === "number") return String(entry).trim();
  if (typeof entry !== "object") return "";
  const keys = ["text", "label", "value", "option", "content", "answer"];
  for (const k of keys) {
    if (entry[k] != null && String(entry[k]).trim()) return String(entry[k]).trim();
  }
  for (const letter of OPTION_LETTERS) {
    if (entry[letter] != null && String(entry[letter]).trim()) return String(entry[letter]).trim();
    const lower = letter.toLowerCase();
    if (entry[lower] != null && String(entry[lower]).trim()) return String(entry[lower]).trim();
  }
  const vals = Object.values(entry).filter((v) => typeof v === "string" && String(v).trim());
  if (vals.length === 1) return String(vals[0]).trim();
  return "";
}

/**
 * Coerce model output into { A, B, C, D } option texts.
 * Handles lowercase keys, numeric keys, arrays, and `choices` aliases.
 */
export function normalizeTestOptions(raw) {
  if (raw == null) return null;

  const fromTexts = (texts) => {
    if (!Array.isArray(texts) || texts.length < 4) return null;
    const slice = texts.slice(0, 4).map((t) => cleanOptionText(t));
    if (!slice.every(Boolean)) return null;
    const out = {};
    for (let i = 0; i < 4; i += 1) out[OPTION_LETTERS[i]] = slice[i];
    return out;
  };

  if (Array.isArray(raw)) {
    const texts = raw.map(optionTextFromEntry);
    return fromTexts(texts);
  }

  if (typeof raw !== "object") return null;

  const out = {};
  let filled = 0;
  for (let i = 0; i < OPTION_LETTERS.length; i += 1) {
    const letter = OPTION_LETTERS[i];
    const keyCandidates = [
      letter,
      letter.toLowerCase(),
      String(i),
      String(i + 1),
      `option${letter}`,
      `option_${letter}`,
      `option${letter.toLowerCase()}`,
      `option_${letter.toLowerCase()}`,
    ];
    let text = "";
    for (const k of keyCandidates) {
      if (raw[k] != null && String(raw[k]).trim()) {
        text = String(raw[k]).trim();
        break;
      }
    }
    if (text) {
      out[letter] = cleanOptionText(text);
      filled += 1;
    }
  }
  if (filled === 4) return out;

  const values = Object.entries(raw)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([, v]) => String(v).trim());
  if (values.length >= 4) return fromTexts(values);

  return null;
}

function normalizeTestAnswer(answer, options) {
  const raw = String(answer ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (OPTION_LETTERS.includes(upper)) return upper;
  const asNum = Number(raw);
  if (Number.isInteger(asNum) && asNum >= 0 && asNum <= 3) return OPTION_LETTERS[asNum];
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= 4) return OPTION_LETTERS[asNum - 1];
  for (const letter of OPTION_LETTERS) {
    const text = options[letter] != null ? String(options[letter]).trim() : "";
    if (text && (text === raw || text.toLowerCase() === raw.toLowerCase())) return letter;
  }
  return upper.length === 1 ? upper : raw;
}

/** Map each pre-shuffle option letter to its letter after permuting option texts. */
export function computeOptionLetterMap(beforeOptions, afterOptions) {
  const letterMap = {};
  if (!beforeOptions || !afterOptions) return letterMap;
  for (const oldLetter of OPTION_LETTERS) {
    const text = beforeOptions[oldLetter];
    if (text == null) continue;
    for (const newLetter of OPTION_LETTERS) {
      if (afterOptions[newLetter] === text) {
        letterMap[oldLetter] = newLetter;
        break;
      }
    }
  }
  return letterMap;
}

function mapLetterPreservingCase(sourceLetter, targetUpper) {
  if (sourceLetter === sourceLetter.toLowerCase()) return targetUpper.toLowerCase();
  return targetUpper;
}

/**
 * Rewrite A–D references in pre-shuffle feedback so they match the shuffled option layout.
 * Idempotent when letterMap is identity.
 */
export function remapFeedbackOptionLetters(feedback, letterMap) {
  if (feedback == null || feedback === "") return feedback;
  const map =
    letterMap && typeof letterMap === "object"
      ? letterMap
      : computeOptionLetterMap(null, null);
  if (OPTION_LETTERS.every((l) => (map[l] || l) === l)) return String(feedback);

  const latexSlots = [];
  let text = String(feedback).replace(/\\(?:\(|\[)[\s\S]*?\\(?:\)|\])/g, (match) => {
    const slot = latexSlots.length;
    latexSlots.push(match);
    return `\x00LATEX${slot}\x00`;
  });

  const replaceLetter = (letter) => {
    const mapped = map[String(letter).toUpperCase()] || String(letter).toUpperCase();
    return mapLetterPreservingCase(letter, mapped);
  };

  text = text.replace(
    /\b(option|options|opción|opcion|opciones|choice|choices|alternativa|alternativas)\s+([A-Da-d])\b/gi,
    (full, word, letter) => `${word} ${replaceLetter(letter)}`,
  );

  text = text.replace(
    /\b(la|el|the)\s+([A-Da-d])\b/gi,
    (full, word, letter) => `${word} ${replaceLetter(letter)}`,
  );

  text = text.replace(/([\[(])\s*([A-Da-d])\s*([\])])/g, (_full, open, letter, close) =>
    `${open}${replaceLetter(letter)}${close}`,
  );

  text = text.replace(/\b([A-Da-d])([).:])/g, (full, letter, punct, offset, whole) => {
    const beforeChar = whole[offset - 1];
    if (beforeChar === "(" || beforeChar === "[") return full;
    return `${replaceLetter(letter)}${punct}`;
  });

  text = text.replace(
    /\b([A-Da-d])(?=\s*(?:,|\/|\s+y\s+|\s+o\s+|\s+and\s+|\s+or\s+)\s*[A-Da-d]\b)/gi,
    (letter) => replaceLetter(letter),
  );

  text = text.replace(/\b([A-Da-d])\b/g, (full, letter, offset, whole) => {
    const before = whole.slice(0, offset);
    if (
      /(?:option|options|opción|opcion|opciones|choice|choices|alternativa|alternativas)\s+$/i.test(
        before,
      ) ||
      /(?:^|\s)(?:la|el|the)\s+$/i.test(before)
    ) {
      return letter;
    }
    const after = whole.slice(offset + full.length);
    if (
      /^(?:\s+(?:is|are|was|were|es|son|era|eran|falla|fallan|fails|confunde|confuses|trata|treats|ignora|ignores|mezcla|mixes|asume|assumes|describe|describe|identifica|identifies))\b/i.test(
        after,
      )
    ) {
      return replaceLetter(letter);
    }
    if (/(?:^|\s)(?:unlike|frente a|compared to|a diferencia de|versus|vs\.?)\s*$/i.test(before)) {
      return replaceLetter(letter);
    }
    return letter;
  });

  return text.replace(/\x00LATEX(\d+)\x00/g, (_full, slot) => latexSlots[Number(slot)] || "");
}

/** Normalize test question `options` / `choices` and `answer` before render or shuffle. */
export function normalizeTestQuestion(question) {
  if (!question || typeof question !== "object") return question;
  if (String(question.type || "").trim().toLowerCase() !== "test") return question;

  let normalized =
    normalizeTestOptions(question.options) ||
    normalizeTestOptions(question.choices) ||
    normalizeTestOptions(question.answers);

  if (!normalized) {
    const fromRoot = {};
    let ok = true;
    for (const letter of OPTION_LETTERS) {
      const keys = [
        `option_${letter}`,
        `option_${letter.toLowerCase()}`,
        `option${letter}`,
        `option${letter.toLowerCase()}`,
      ];
      let text = "";
      for (const k of keys) {
        if (question[k] != null && String(question[k]).trim()) {
          text = String(question[k]).trim();
          break;
        }
      }
      if (!text) ok = false;
      else fromRoot[letter] = cleanOptionText(text);
    }
    if (ok) normalized = fromRoot;
  }

  if (!normalized) return question;

  return {
    ...question,
    options: normalized,
    answer: normalizeTestAnswer(question.answer, normalized),
  };
}

/**
 * Permute A–D option texts and update `answer` to the new letter for the same text.
 * Idempotent when `_optionsShuffled` is already set.
 */
export function shuffleTestQuestionOptions(question) {
  if (!question || typeof question !== "object") return question;

  const q = normalizeTestQuestion(question);
  if (q._optionsShuffled) return q;

  const type = String(q.type || "").trim().toLowerCase();
  if (type !== "test") return q;

  const options = q.options && typeof q.options === "object" ? q.options : null;
  if (!options) return q;

  const answerKey = String(q.answer ?? "").trim().toUpperCase();
  if (!OPTION_LETTERS.includes(answerKey)) return q;

  const correctText = options[answerKey];
  const values = OPTION_LETTERS.map((l) => options[l]);
  if (!values.every((v) => v != null && String(v).trim())) return q;

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

  const letterMap = computeOptionLetterMap(options, newOptions);
  const feedback =
    q.feedback != null && String(q.feedback).trim()
      ? remapFeedbackOptionLetters(String(q.feedback), letterMap)
      : q.feedback;

  return {
    ...q,
    options: newOptions,
    answer: newAnswer,
    feedback,
    _optionsShuffled: true,
    _optionLetterMap: letterMap,
  };
}

export function shuffleTestQuestionsInList(questions) {
  if (!Array.isArray(questions)) return questions;
  return questions.map((q) => shuffleTestQuestionOptions(q));
}
