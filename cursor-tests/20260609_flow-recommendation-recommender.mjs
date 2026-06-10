/**
 * T03 — recommendation/recommender.js
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-recommender.mjs
 */
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import {
  computeModeRecommendation,
  computeStepTimes,
  GENRE_LABEL_EN,
  TIME_FACTORS,
} from "../src/js/recommendation/recommender.js";

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

const PHILOSOPHICAL_PAPER = `
La cuestión ontológica del ser y la nada plantea un problema fundamental para la
hermenéutica contemporánea. Desde la perspectiva fenomenológica, la intencionalidad
de la conciencia no puede reducirse a un análisis meramente empírico sin perder su
dimensión trascendental. El argumento dialéctico exige considerar la intersubjetividad
como condición de posibilidad del conocimiento. La epistemología moderna, en su
crítica al idealismo, ha intentado fundamentar la verdad en la experiencia perceptiva
sin abandonar del todo las categorías a priori. Esta problemática, que atraviesa toda
la tradición filosófica occidental desde Kant hasta Heidegger, obliga a repensar la
relación entre sujeto y objeto, entre representación y realidad, entre síntesis y
análisis. La deconstrucción del metafísico no implica un relativismo absoluto sino
una reconstrucción cuidadosa de los marcos conceptuales que sostienen nuestras
prácticas interpretativas. Por tanto, la coherencia de un sistema filosófico depende
tanto de su capacidad explicativa como de su resistencia ante la refutación empírica
y conceptual. La genealogía de los conceptos revela contingencias históricas que
muchas veces se presentan como necesidades lógicas. En consecuencia, el filósofo debe
interrogar los presupuestos de su propio discurso sin caer en un escepticismo
paralizante. La dialéctica entre universal y particular, entre abstracción y
concreción, permanece como núcleo irreductible del pensamiento crítico. Cada tesis
genera su antítesis y exige una síntesis que no clausure prematuramente la pregunta.
`.trim();

const FIRST_PERSON_NOTES = `
Hoy en clase yo tomé apuntes sobre la revolución industrial. Nosotros vimos que
la mecanización cambió todo. Me pareció interesante cómo mi profesor explicó el
impacto social. I think we should review this before the exam. My notes are messy
but I captured the main ideas about factories and urbanization.
`.repeat(20).trim();

const STEP_MODES = new Set(["rsvp", "slow", "cloze", "questions", "review"]);

function assertFullSchema(rec, label) {
  assert(typeof rec.computedAt === "number" && rec.computedAt > 0, `${label}: computedAt`);
  assert(rec.method === "deterministic" || rec.method === "llm_meta", `${label}: method`);
  assert(rec.analysis && typeof rec.analysis === "object", `${label}: analysis object`);
  assert(typeof rec.analysis.genre === "string" && rec.analysis.genre.length > 0, `${label}: analysis.genre`);
  assert(
    typeof rec.analysis.argumentativeDensity === "number",
    `${label}: analysis.argumentativeDensity`,
  );
  assert(typeof rec.analysis.conceptualLoad === "number", `${label}: analysis.conceptualLoad`);
  assert(
    typeof rec.analysis.estimatedReadTimeMin === "number",
    `${label}: analysis.estimatedReadTimeMin`,
  );
  assert(typeof rec.analysis.genreLabel === "string" && rec.analysis.genreLabel.length > 0, `${label}: analysis.genreLabel`);
  assert(Array.isArray(rec.primaryFlow) && rec.primaryFlow.length >= 1, `${label}: primaryFlow`);
  assert(Array.isArray(rec.quickFlow) && rec.quickFlow.length >= 1, `${label}: quickFlow`);
  assert(typeof rec.reasoning === "string" && rec.reasoning.length > 0, `${label}: reasoning`);
  assert(rec.currentStepIndex === 0, `${label}: currentStepIndex 0`);
  assert(Array.isArray(rec.completedSteps) && rec.completedSteps.length === 0, `${label}: completedSteps`);
  assert(rec.userOverride === false, `${label}: userOverride false`);

  for (const flowName of ["primaryFlow", "quickFlow"]) {
    for (const step of rec[flowName]) {
      assert(typeof step.id === "string" && step.id.startsWith("step_"), `${label}: ${flowName} step id`);
      assert(STEP_MODES.has(step.mode), `${label}: ${flowName} mode valid`);
      assert(typeof step.label === "string" && step.label.length > 0, `${label}: ${flowName} label`);
      assert(typeof step.description === "string" && step.description.length > 0, `${label}: ${flowName} description`);
      assert(typeof step.estimatedTimeMin === "number" && step.estimatedTimeMin >= 1, `${label}: ${flowName} estimatedTimeMin`);
      assert(step.optional === false, `${label}: ${flowName} optional false`);
      assert(step.completedAt === null, `${label}: ${flowName} completedAt null`);
      assert(step.skippedAt === null, `${label}: ${flowName} skippedAt null`);
    }
  }
}

function testPhilosophicalPaperSlowFirst() {
  const metrics = analyzeText(PHILOSOPHICAL_PAPER);
  const rec = computeModeRecommendation(metrics, {
    genre: "philosophical",
    argumentativeDensity: 5,
    conceptualLoad: 4,
    primaryLearningGoal: "understand_argument",
    genreReasoning: "Texto filosófico denso",
  });

  assert(rec.primaryFlow[0].mode === "slow", "philosophical: primary starts with slow");
  assert(
    rec.primaryFlow.map((s) => s.mode).join(",") === "slow,cloze,review",
    "philosophical: full primary flow",
  );
  assert(
    rec.quickFlow.map((s) => s.mode).join(",") === "rsvp,questions",
    "philosophical: quick flow",
  );
  assert(rec.analysis.genreLabel === GENRE_LABEL_EN.philosophical, "philosophical: genreLabel EN");
  assertFullSchema(rec, "philosophical");
}

function testNotesRsvpOrQuestions() {
  const metrics = analyzeText(FIRST_PERSON_NOTES);
  assert(metrics.contentSignals.firstPersonRatio > 0.03, "notes fixture: first person ratio");

  const rec = computeModeRecommendation(metrics, {
    genre: "lecture_notes",
    argumentativeDensity: 2,
    conceptualLoad: 2,
    primaryLearningGoal: "memorize_facts",
    genreReasoning: "Apuntes de clase con primera persona",
  });

  const primaryFirst = rec.primaryFlow[0].mode;
  assert(
    primaryFirst === "rsvp" || primaryFirst === "questions",
    "notes: primary starts with rsvp or questions",
  );
  assert(
    rec.primaryFlow.some((s) => s.mode === "questions"),
    "notes: questions in primary flow",
  );
  assert(rec.quickFlow[0].mode === "questions", "notes: quick flow is questions only");
  assertFullSchema(rec, "notes");
}

function testTinySingleStep() {
  const tinyText = "Definición breve: la fotosíntesis convierte luz en energía química.";
  const metrics = analyzeText(tinyText);
  assert(metrics.sizeCategory === "tiny", "tiny fixture: sizeCategory");

  const rec = computeModeRecommendation(metrics, {
    genre: "unknown",
    argumentativeDensity: 2,
    conceptualLoad: 1,
    primaryLearningGoal: "memorize_facts",
    genreReasoning: "Texto muy corto",
  });

  assert(rec.primaryFlow.length === 1, "tiny: single primary step");
  assert(rec.quickFlow.length === 1, "tiny: single quick step");
  assert(rec.primaryFlow[0].mode === "questions", "tiny: questions only");
  assert(rec.quickFlow[0].mode === "questions", "tiny: quick questions only");
  assertFullSchema(rec, "tiny");
}

function testTimeFactors() {
  assert(TIME_FACTORS.rsvp(4000) === 10, "TIME_FACTORS rsvp");
  assert(TIME_FACTORS.slow(12000) === 100, "TIME_FACTORS slow");
  assert(TIME_FACTORS.cloze(10) === 5, "TIME_FACTORS cloze");
  assert(TIME_FACTORS.questions(1600) === 2, "TIME_FACTORS questions");
  assert(TIME_FACTORS.review(10) === 3, "TIME_FACTORS review");
}

function testComputeStepTimes() {
  const metrics = { wordCount: 10000 };
  const steps = [
    { id: "step_slow_1", mode: "slow", label: "x", description: "y", estimatedTimeMin: 0 },
    { id: "step_cloze_1", mode: "cloze", label: "x", description: "y", estimatedTimeMin: 0 },
    { id: "step_review_1", mode: "review", label: "x", description: "y", estimatedTimeMin: 0 },
  ];
  const timed = computeStepTimes(metrics, steps);
  assert(timed[0].estimatedTimeMin === TIME_FACTORS.slow(10000), "step times: slow from words");
  const items = Math.max(5, Math.ceil(10000 / 200));
  assert(timed[1].estimatedTimeMin === TIME_FACTORS.cloze(items), "step times: cloze from items proxy");
  assert(timed[2].estimatedTimeMin === TIME_FACTORS.review(items), "step times: review from items proxy");
}

function testArgumentativeDensityTriggersSlow() {
  const metrics = analyzeText("word ".repeat(500).trim());
  const rec = computeModeRecommendation(metrics, {
    genre: "essay",
    argumentativeDensity: 4,
    conceptualLoad: 2,
    primaryLearningGoal: "understand_argument",
    genreReasoning: "Ensayo denso",
  });
  assert(rec.primaryFlow[0].mode === "slow", "density>=4: slow first without philosophical genre");
}

function testLlmMetaMethod() {
  const metrics = analyzeText(PHILOSOPHICAL_PAPER);
  const rec = computeModeRecommendation(
    metrics,
    {
      genre: "philosophical",
      argumentativeDensity: 5,
      conceptualLoad: 4,
      primaryLearningGoal: "understand_argument",
      genreReasoning: "LLM",
    },
    { method: "llm_meta" },
  );
  assert(rec.method === "llm_meta", "options: llm_meta method preserved");
}

testPhilosophicalPaperSlowFirst();
testNotesRsvpOrQuestions();
testTinySingleStep();
testTimeFactors();
testComputeStepTimes();
testArgumentativeDensityTriggersSlow();
testLlmMetaMethod();

console.log(
  `\n20260609_flow-recommendation-recommender: ${passed} passed, ${failed} failed`,
);
process.exit(failed > 0 ? 1 : 0);
