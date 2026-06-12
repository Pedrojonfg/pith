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
The ontological question of being and nothingness raises a fundamental problem for
contemporary hermeneutics. From a phenomenological perspective, intentionality of
consciousness cannot be reduced to merely empirical analysis without losing its
transcendental dimension. The dialectical argument requires treating intersubjectivity
as a condition for knowledge. Modern epistemology, in its critique of idealism, has
tried to ground truth in perceptual experience without abandoning a priori categories.
This problem runs through the Western philosophical tradition from Kant to Heidegger
and forces us to rethink the relation between subject and object, representation and
reality, synthesis and analysis. Deconstruction of metaphysics does not imply absolute
relativism but a careful reconstruction of the conceptual frameworks that sustain
interpretive practices. Therefore, the coherence of a philosophical system depends on
both explanatory power and resistance to empirical and conceptual refutation.
The genealogy of concepts reveals historical contingencies often presented as logical
necessities. Consequently, the philosopher must interrogate the assumptions of their
own discourse without falling into paralyzing skepticism. The dialectic between
universal and particular remains an irreducible core of critical thought.
`.trim();

const FIRST_PERSON_NOTES = `
Today in class I took notes on the industrial revolution. We saw that mechanization
changed everything. I thought the professor's explanation of the social impact was
useful. I think we should review this before the exam. My notes are messy but I
captured the main ideas about factories and urbanization.
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
  const text = "As the author notes (Smith, 2019), the theory evolves. See also [1].";
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
  const text = "The integral $\\int_0^1 f(x)\\,dx$ and $\\frac{a}{b}$ with sum $\\sum_{i=1}^n x_i$ and ∑.";
  const m = analyzeText(text);
  assert(m.contentSignals.hasMathNotation === true, "math: LaTeX and symbols detected");
}

function testDefinitionPatterns() {
  const en = "The concept is defined as the primary unit of study.";
  assert(analyzeText(en).contentSignals.hasDefinitionPatterns === true, "definitions: English");
}

function testExplicitHeadings() {
  const text = "# Intro\n\nBody.\n\n## Section\n\nMore body.";
  const m = analyzeText(text);
  assert(m.structureSignals.hasExplicitHeadings === true, "headings: detected");
  assert(m.structureSignals.headingDensity > 0, "headings: density > 0");
}

function testAcademicVocabEnglish() {
  const en = "Epistemology and ontology are fundamental; therefore, however, methodology matters.";
  const m = analyzeText(en);
  assert(m.contentSignals.academicVocabDensity > 0.1, "academic vocab: English terms counted");
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
testAcademicVocabEnglish();
testDeterministic();
testShortSizeCategory();
testLongParagraphRatio();

console.log(
  `\n20260609_flow-recommendation-analyzer: ${passed} passed, ${failed} failed`
);
process.exit(failed > 0 ? 1 : 0);
