/** Static Socratic/Feynman opening questions — zero LLM latency (20260620-nodoc-interview-capture). */

import { BOOK_LOOKUP_FLAGS } from "../config/flags.js";

const BANK = Object.freeze({
  English: [
    "In your own words, what was this material mainly about? Try to compress the core idea into two or three sentences.",
    "What surprised you, challenged a prior belief, or felt most important to remember?",
    "If you had to teach the main takeaway to a friend in one minute, what would you say?",
  ],
  Spanish: [
    "Con tus propias palabras, ¿de qué trataba principalmente este material? Intenta condensar la idea central en dos o tres frases.",
    "¿Qué te sorprendió, cuestionó una creencia previa o te pareció lo más importante recordar?",
    "Si tuvieras que enseñar la idea principal a un amigo en un minuto, ¿qué dirías?",
  ],
  French: [
    "Dans vos propres mots, de quoi parlait principalement ce contenu ? Essayez de condenser l'idée centrale en deux ou trois phrases.",
    "Qu'est-ce qui vous a surpris, remis en question ou semblé le plus important à retenir ?",
    "Si vous deviez enseigner l'essentiel à un ami en une minute, que diriez-vous ?",
  ],
  German: [
    "Mit eigenen Worten: Worum ging es in diesem Material hauptsächlich? Fassen Sie die Kernidee in zwei oder drei Sätzen zusammen.",
    "Was hat Sie überrascht, ein früheres Urteil in Frage gestellt oder schien am wichtigsten zu merken?",
    "Wenn Sie das Wichtigste in einer Minute einem Freund erklären müssten — was würden Sie sagen?",
  ],
});

const CHAPTER_TEMPLATES = Object.freeze({
  English: (chapterTitle) =>
    `What do you remember from the chapter "${chapterTitle}"? Explain it as if telling someone who has not read it.`,
  Spanish: (chapterTitle) =>
    `¿Qué recuerdas del capítulo «${chapterTitle}»? Explícalo como si se lo contaras a alguien que no lo ha leído.`,
  French: (chapterTitle) =>
    `Que retenez-vous du chapitre « ${chapterTitle} » ? Expliquez-le comme à quelqu'un qui ne l'a pas lu.`,
  German: (chapterTitle) =>
    `Was erinnern Sie sich aus dem Kapitel „${chapterTitle}"? Erklären Sie es, als ob Sie es jemandem erzählen, der es nicht gelesen hat.`,
});

function shuffleArray(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * @param {string} studyLang
 * @param {import('../session-types.js').BookMeta} [bookMeta]
 * @returns {{ questions: string[], defaultIndex: number }}
 */
export function getOpeningQuestions(studyLang, bookMeta) {
  const lang = String(studyLang || "English").trim();
  if (
    bookMeta?.level === "A" &&
    Array.isArray(bookMeta.toc) &&
    bookMeta.toc.length >= BOOK_LOOKUP_FLAGS.BOOK_TOC_MIN_ENTRIES
  ) {
    const templateFn = CHAPTER_TEMPLATES[lang] || CHAPTER_TEMPLATES.English;
    let chapters = bookMeta.toc
      .map((c) => String(c?.title || "").trim())
      .filter(Boolean);
    chapters = shuffleArray(chapters);
    const max = BOOK_LOOKUP_FLAGS.BOOK_TOC_MAX_OPENING_QUESTIONS;
    if (chapters.length > 8) {
      chapters = chapters.slice(0, max);
    }
    const questions = chapters.map((t) => templateFn(t));
    return { questions, defaultIndex: 0 };
  }
  const questions = BANK[lang] || BANK.English;
  return { questions: [...questions], defaultIndex: 0 };
}
