/**
 * T01 — recommendation/analyzer.js
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-analyzer.mjs
 */
import { analyzeText } from "../src/js/recommendation/analyzer.js";

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
`.trim();

function testNullUndefinedEmpty() {
  for (const input of [null, undefined, ""]) {
    const m = analyzeText(input);
    assert(m.charCount === 0, "empty-like: charCount 0");
    assert(m.wordCount === 0, "empty-like: wordCount 0");
    assert(m.estimatedReadTimeMin === 0, "empty-like: read time 0");
    assert(m.sizeCategory === "tiny", "empty-like: sizeCategory tiny");
    assert(m.structureSignals.hasExplicitHeadings === false, "empty-like: no headings");
    assert(m.contentSignals.academicVocabDensity === 0, "empty-like: vocab density 0");
    assert(m.contentSignals.firstPersonRatio === 0, "empty-like: first person 0");
  }
}

function testPhilosophicalPaperNoHeadings() {
  const m = analyzeText(PHILOSOPHICAL_PAPER);
  assert(m.structureSignals.hasExplicitHeadings === false, "philosophical: no headings");
  assert(m.wordCount > 100, "philosophical: substantial word count");
  assert(m.contentSignals.academicVocabDensity > 0.05, "philosophical: academic vocab density");
  assert(m.structureSignals.avgParagraphLength > 20, "philosophical: dense paragraphs");
  assert(m.contentSignals.firstPersonRatio < 0.01, "philosophical: low first person");
  assert(m.sizeCategory === "tiny", "philosophical sample fits tiny category");
}

function testFirstPersonNotes() {
  const m = analyzeText(FIRST_PERSON_NOTES);
  assert(m.contentSignals.firstPersonRatio > 0.05, "notes: firstPersonRatio detected");
  assert(m.contentSignals.hasBibliography === false, "notes: no bibliography");
}

function testBibliographyCitation() {
  const text = "Como señala el autor (Smith, 2019), la teoría evoluciona. Ver también [1].";
  const m = analyzeText(text);
  assert(m.contentSignals.hasBibliography === true, "bibliography: [1] or (Author, year)");
}

function testTinySizeCategory() {
  const text = "a".repeat(1999);
  const m = analyzeText(text);
  assert(m.charCount === 1999, "tiny: char count");
  assert(m.sizeCategory === "tiny", "tiny: < 2k chars");
}

function testMathNotation() {
  const text = "La integral $\\int_0^1 f(x)\\,dx$ y $\\frac{a}{b}$ con suma $\\sum_{i=1}^n x_i$ y ∑.";
  const m = analyzeText(text);
  assert(m.contentSignals.hasMathNotation === true, "math: LaTeX and symbols detected");
}

function testDefinitionPatterns() {
  const es = "El término se define como la unidad básica del análisis.";
  const en = "The concept is defined as the primary unit of study.";
  assert(analyzeText(es).contentSignals.hasDefinitionPatterns === true, "definitions: Spanish");
  assert(analyzeText(en).contentSignals.hasDefinitionPatterns === true, "definitions: English");
}

function testExplicitHeadings() {
  const text = "# Intro\n\nBody.\n\n## Section\n\nMore body.";
  const m = analyzeText(text);
  assert(m.structureSignals.hasExplicitHeadings === true, "headings: detected");
  assert(m.structureSignals.headingDensity > 0, "headings: density > 0");
}

function testAcademicVocabBilingual() {
  const es = "La epistemología y la ontología son fundamentales therefore however.";
  const m = analyzeText(es);
  assert(m.contentSignals.academicVocabDensity > 0.1, "academic vocab: ES+EN terms counted");
}

function testDeterministic() {
  const a = analyzeText(PHILOSOPHICAL_PAPER);
  const b = analyzeText(PHILOSOPHICAL_PAPER);
  assert(JSON.stringify(a) === JSON.stringify(b), "deterministic: same input same output");
}

function testShortSizeCategory() {
  const text = "word ".repeat(500).trim();
  assert(text.length >= 2000 && text.length < 8000, "short fixture length in range");
  const m = analyzeText(text);
  assert(m.sizeCategory === "short", "short: 2k–8k chars");
  assert(m.estimatedReadTimeMin === Math.ceil(m.wordCount / 200), "read time ceil(words/200)");
}

function testLongParagraphRatio() {
  const longPara = Array(160).fill("term").join(" ");
  const m = analyzeText(longPara);
  assert(m.structureSignals.longParagraphRatio === 1, "long paragraph: ratio 1 for single long block");
}

testNullUndefinedEmpty();
testPhilosophicalPaperNoHeadings();
testFirstPersonNotes();
testBibliographyCitation();
testTinySizeCategory();
testMathNotation();
testDefinitionPatterns();
testExplicitHeadings();
testAcademicVocabBilingual();
testDeterministic();
testShortSizeCategory();
testLongParagraphRatio();

console.log(
  `\n20260609_flow-recommendation-analyzer: ${passed} passed, ${failed} failed`
);
process.exit(failed > 0 ? 1 : 0);
