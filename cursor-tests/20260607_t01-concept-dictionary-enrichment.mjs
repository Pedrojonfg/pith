/**
 * T01 — concept dictionary extraction + enrichment prompts
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260607_t01-concept-dictionary-enrichment.mjs
 */
import {
  buildBlockGenerationSystemPrompt,
  buildConceptEnrichmentSystemPrompt,
  buildConceptEnrichmentUserContent,
  CONCEPT_DICTIONARY_ENRICHMENT_RULES,
  enrichBlockConceptDefinitions,
} from "../src/js/api.js";

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

const thorough = buildBlockGenerationSystemPrompt({
  language: "Spanish",
  n_test: 2,
  n_socratic: 1,
  explanation_profile: "thorough",
});
assert(!thorough.includes("definition of max 15 words"), "block prompt no longer caps dictionary at 15 words");
assert(thorough.includes("one-line scope hint"), "block prompt asks for scope hint only in first pass");
assert(thorough.includes("fuller entries are generated in a separate pass"), "block prompt mentions enrichment pass");

const vocab = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: 2,
  n_socratic: 0,
  blockTitle: "Key terms: Divergence theorem",
});
assert(vocab.includes("every term in this vocabulary block"), "vocabulary block extracts all terms");

const enrichSys = buildConceptEnrichmentSystemPrompt("Spanish");
assert(enrichSys.includes("40-150 words"), "enrichment allows substantive definitions");
assert(enrichSys.includes("Do NOT invent external history"), "enrichment forbids external invention");
assert(enrichSys.includes(CONCEPT_DICTIONARY_ENRICHMENT_RULES.slice(0, 40)), "enrichment shares core rules");

const enrichUser = buildConceptEnrichmentUserContent({
  blockTitle: "Stokes theorem",
  materialText: "Source chunk about circulation.",
  explanation: "RSVP explanation paragraph.",
  concepts: [{ term: "Circulation", definition: "hint" }],
});
assert(enrichUser.includes("1. Circulation"), "enrichment user lists numbered terms");
assert(enrichUser.includes("Study material (primary source"), "enrichment user labels primary source");

let fetchCalls = 0;
globalThis.fetch = async (_url, init) => {
  fetchCalls += 1;
  const body = JSON.parse(init.body);
  const user = body?.messages?.[1]?.content || "";
  assert(user.includes("Circulation"), "enrichment API call receives term list");
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              concepts: [
                {
                  term: "Circulation",
                  definition:
                    "En el texto, la circulación mide la integral de línea de un campo vectorial sobre una curva cerrada. El autor la usa para conectar el rotacional con el flujo local.",
                },
              ],
            }),
          },
        },
      ],
    }),
  };
};
globalThis.localStorage.setItem("ds_api_key", "test-key");

const enriched = await enrichBlockConceptDefinitions({
  llmModel: "deepseek-chat",
  language: "Spanish",
  blockTitle: "Stokes",
  materialText: "Material",
  explanation: "Explanation",
  concepts: [{ term: "Circulation", definition: "short hint" }],
});
assert(fetchCalls === 1, "enrichment makes one LLM call");
assert(enriched[0]?.definition.includes("integral de línea"), "enrichment replaces stub definition");

console.log(`\nT01 concept-dictionary-enrichment: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
