/**
 * T02 — hierarchy pedagogical_meta + deterministic fallback
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260609_flow-recommendation-hierarchy-meta.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import { analyzeText } from "../src/js/recommendation/analyzer.js";
import {
  buildDeterministicPedagogicalMeta,
  buildDocumentHierarchy,
  buildHierarchyUserPrompt,
  parsePedagogicalMetaFromLlm,
} from "../src/js/normalization/hierarchy.js";
import {
  getCachedHierarchy,
  hashText,
  setCachedHierarchy,
} from "../src/js/normalization/hierarchy-cache.js";

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

const PAPER_NO_HEADINGS =
  "The concept of moral luck was introduced by Bernard Williams and Thomas Nagel. ".repeat(80);

function buildFixtureTree(text) {
  return [
    {
      title: "Moral Luck",
      level: 1,
      startOffset: 0,
      endOffset: text.length,
      children: [
        {
          title: "Introduction",
          level: 2,
          startOffset: 0,
          endOffset: Math.floor(text.length / 2),
          children: [],
        },
        {
          title: "Discussion",
          level: 2,
          startOffset: Math.floor(text.length / 2),
          endOffset: text.length,
          children: [],
        },
      ],
    },
  ];
}

function buildPhilosophicalLlmResponse(text) {
  return JSON.stringify({
    tree: buildFixtureTree(text),
    pedagogical_meta: {
      genre: "philosophical",
      argumentative_density: 5,
      conceptual_load: 4,
      primary_learning_goal: "understand_argument",
      reasoning: "Dense moral philosophy argument without explicit headings",
    },
  });
}

async function testLlmPhilosophicalMeta() {
  resetStorage();
  const result = await buildDocumentHierarchy(
    PAPER_NO_HEADINGS,
    async () => buildPhilosophicalLlmResponse(PAPER_NO_HEADINGS),
    { useCache: false },
  );
  assert(result?.method === "llm", "LLM mode used");
  assert(result?.pedagogicalMeta?.genre === "philosophical", "philosophical genre from LLM");
  assert(
    (result?.pedagogicalMeta?.argumentativeDensity ?? 0) >= 4,
    "argumentativeDensity >= 4 from LLM",
  );
}

async function testDeterministicWithHeadingsHasMeta() {
  const text = `# Moral Luck

Therefore the argument proceeds dialectically through epistemology and ethics.
Therefore the conclusion follows from the premise regarding moral responsibility.
`;
  let llmCalls = 0;
  const result = await buildDocumentHierarchy(text, async () => {
    llmCalls += 1;
    return "{}";
  });
  assert(result?.method === "deterministic", "headings → deterministic");
  assert(llmCalls === 0, "deterministic path skips LLM");
  assert(result?.pedagogicalMeta != null, "deterministic returns pedagogicalMeta");
  assert(typeof result?.pedagogicalMeta?.genre === "string", "genre present");
}

async function testTrivialShortDocHasMeta() {
  const result = await buildDocumentHierarchy("Short note.", null);
  assert(result?.method === "trivial", "short doc → trivial");
  assert(result?.pedagogicalMeta != null, "trivial returns pedagogicalMeta");
}

async function testInvalidJsonFallbackHasMeta() {
  resetStorage();
  const result = await buildDocumentHierarchy(
    PAPER_NO_HEADINGS,
    async () => "not json",
    { useCache: false },
  );
  assert(result?.method === "deterministic", "invalid JSON → deterministic");
  assert(result?.pedagogicalMeta != null, "fallback includes pedagogicalMeta");
}

function testParsePedagogicalMetaFromLlm() {
  const meta = parsePedagogicalMetaFromLlm(
    JSON.stringify({
      tree: [],
      pedagogical_meta: {
        genre: "scientific_empirical",
        argumentative_density: 2,
        conceptual_load: 3,
        primary_learning_goal: "survey_field",
        reasoning: "Empirical study with citations",
      },
    }),
  );
  assert(meta?.genre === "scientific_empirical", "parse genre");
  assert(meta?.argumentativeDensity === 2, "parse argumentative_density");
  assert(meta?.primaryLearningGoal === "survey_field", "parse primary_learning_goal");
}

function testParsePedagogicalMetaInvalid() {
  assert(parsePedagogicalMetaFromLlm("[]") === null, "array root → null meta");
  assert(parsePedagogicalMetaFromLlm("{") === null, "invalid JSON → null");
}

function testBuildDeterministicPhilosophicalSignals() {
  const text =
    "Therefore the epistemological argument proceeds through dialectical analysis of consciousness and normativity. ".repeat(
      30,
    );
  const metrics = analyzeText(text);
  const meta = buildDeterministicPedagogicalMeta(metrics);
  assert(meta.genre === "philosophical", "heuristic philosophical genre");
  assert(meta.argumentativeDensity >= 4, "heuristic argumentativeDensity >= 4");
}

function testBuildDeterministicLectureNotes() {
  const text = "Yo creo que nosotros debemos repasar esto en clase. ".repeat(40);
  const meta = buildDeterministicPedagogicalMeta(analyzeText(text));
  assert(meta.genre === "lecture_notes", "first person → lecture_notes");
}

function testPromptIncludesPedagogicalMeta() {
  const prompt = buildHierarchyUserPrompt(PAPER_NO_HEADINGS, { includeSummary: false });
  assert(prompt.includes("pedagogical_meta"), "prompt mentions pedagogical_meta");
  assert(prompt.includes('"tree"'), "prompt mentions tree wrapper format");
}

async function testCacheStoresPedagogicalMeta() {
  resetStorage();
  const hash = hashText(PAPER_NO_HEADINGS);
  const pedagogicalMeta = {
    genre: "philosophical",
    argumentativeDensity: 5,
    conceptualLoad: 4,
    primaryLearningGoal: "understand_argument",
    genreReasoning: "Cached philosophical classification",
  };
  setCachedHierarchy(hash, {
    tree: buildFixtureTree(PAPER_NO_HEADINGS),
    method: "llm",
    pedagogicalMeta,
  });

  const cached = getCachedHierarchy(hash);
  assert(cached?.pedagogicalMeta?.genre === "philosophical", "cache stores pedagogicalMeta");

  let calls = 0;
  const result = await buildDocumentHierarchy(
    PAPER_NO_HEADINGS,
    async () => {
      calls += 1;
      return buildPhilosophicalLlmResponse(PAPER_NO_HEADINGS);
    },
    { useCache: true, textHash: hash },
  );
  assert(calls === 0, "cache hit skips LLM");
  assert(result?.fromCache === true, "fromCache flag set");
  assert(result?.pedagogicalMeta?.genre === "philosophical", "cached meta returned");
}

await testLlmPhilosophicalMeta();
await testDeterministicWithHeadingsHasMeta();
await testTrivialShortDocHasMeta();
await testInvalidJsonFallbackHasMeta();
testParsePedagogicalMetaFromLlm();
testParsePedagogicalMetaInvalid();
testBuildDeterministicPhilosophicalSignals();
testBuildDeterministicLectureNotes();
testPromptIncludesPedagogicalMeta();
await testCacheStoresPedagogicalMeta();

console.log(
  `\n20260609_flow-recommendation-hierarchy-meta: ${passed} passed, ${failed} failed`,
);
process.exit(failed > 0 ? 1 : 0);
