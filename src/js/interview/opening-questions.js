/** Static Socratic/Feynman opening questions — zero LLM latency (20260620-nodoc-interview-capture). */

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

/**
 * @param {string} [studyLang]
 * @returns {{ questions: string[], defaultIndex: number }}
 */
export function getOpeningQuestions(studyLang) {
  const lang = String(studyLang || "English").trim();
  const questions = BANK[lang] || BANK.English;
  return { questions: [...questions], defaultIndex: 0 };
}
