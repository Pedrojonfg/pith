/**
 * Study Source Fidelity — T01–T13 closure suite
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260613_source-fidelity.mjs
 */
import {
  SOURCE_FIDELITY_RULES,
  buildSourceFirstRsvpStructure,
  mergeFidelityIntoSystemPrompt,
} from "../src/js/source-fidelity.js";
import { assignAlignedChunks } from "../src/js/chunk-alignment.js";
import {
  validateBlockFidelity,
  extractKeyTermsFromBlockMeta,
} from "../src/js/fidelity-validation.js";
import {
  buildBlockGenerationSystemPrompt,
  buildSplitBlocksPrompt,
  buildConceptInventoryPrompt,
  buildQuestionsOnlySystemPrompt,
  buildPrePackingAssessmentSystemPrompt,
  parseConceptInventoryFromModelResponse,
} from "../src/js/api.js";
import {
  buildGuidePrompt,
  resolveGuideDocumentExcerpt,
} from "../src/js/guide-chat.js";
import { JSDOM } from "jsdom";
import { isSourceFidelityStrictEnabled } from "../src/js/config/flags.js";

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

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ── T01: source-fidelity module ──
section("T01 source-fidelity rules");
assert(SOURCE_FIDELITY_RULES.length > 200, "rules length > 200");
assert(/supreme authority/i.test(SOURCE_FIDELITY_RULES), "rules mention supreme authority");
const vocabStruct = buildSourceFirstRsvpStructure({ isVocabularyBlock: true });
assert(vocabStruct.includes("VOCABULARY"), "vocabulary structure");
const strictStruct = buildSourceFirstRsvpStructure({
  strictMode: true,
  extractedClaims: [{ type: "definition", text: "x", terms: ["x"] }],
});
assert(strictStruct.includes("STRICT MODE"), "strict structure");
const merged = mergeFidelityIntoSystemPrompt("BASE", { strictMode: true, extractedClaims: [{ type: "definition", text: "a" }] });
assert(merged.includes("BASE") && merged.includes("supreme authority"), "merge fidelity");

// ── T02: prompt smoke ──
section("T02 block generation prompts");
const blockPrompt = buildBlockGenerationSystemPrompt({
  language: "English",
  n_test: 1,
  n_socratic: 1,
  blockTitle: "Ethics types",
  blockIndex: 1,
});
assert(blockPrompt.includes("supreme authority"), "block prompt has fidelity");
assert(!blockPrompt.includes("smart 16-year-old"), "removed generic teen explain");
const splitPrompt = buildSplitBlocksPrompt(5, "English");
assert(!splitPrompt.includes("not for mirroring"), "split prompt no anti-mirror");
assert(splitPrompt.includes("supreme authority"), "split has fidelity");

// ── T03: inventory + questions prompts ──
section("T03 inventory and assessment prompts");
const invPrompt = buildConceptInventoryPrompt("Spanish");
assert(invPrompt.includes("source_phrase"), "inventory requires source_phrase");
const parsedInv = parseConceptInventoryFromModelResponse(
  JSON.stringify({
    concepts: [
      {
        id: "c1",
        order: 1,
        title: "Amoralism",
        scope_one_line: "Course sense",
        source_phrase: "Amoralism denies",
        anchor_type: "cited",
      },
    ],
  }),
);
assert(parsedInv?.[0]?.source_phrase === "Amoralism denies", "parser accepts source_phrase");
const qPrompt = buildQuestionsOnlySystemPrompt({ language: "English", n_test: 1, n_socratic: 0 });
assert(qPrompt.includes("supreme authority"), "questions-only has fidelity");
const assessPrompt = buildPrePackingAssessmentSystemPrompt({
  language: "English",
  n_test: 1,
  n_socratic: 0,
  conceptInventory: [{ id: "c1", title: "T" }],
  edges: [],
  materialExcerpt: "text",
});
assert(assessPrompt.includes("supreme authority"), "prepack assessment has fidelity");

// ── T05/T07: chunk alignment ──
section("T05/T07 chunk alignment");
const material = [
  "Chapter 1. General introduction to the ethics course.",
  "Chapter 2. Classical utilitarianism defines the good as utility.",
  "Chapter 3. The professor's amoralism denies universal moral obligations.",
  "Chapter 3 continues with the author's examples of technical amoralism.",
].join(" ");

const blocks = [
  { id: 1, title: "Overview", summary: "Map", signature: ["ethics"] },
  { id: 2, title: "Course amoralism", summary: "Def", signature: ["amoralism"], concept_ids: ["c3"] },
];
const inventory = [
  { id: "c3", title: "Amoralism", source_phrase: "professor's amoralism denies" },
];

const aligned = assignAlignedChunks(material, blocks, inventory, {});
const overview = aligned.find((b) => b.id === 1);
const amoral = aligned.find((b) => b.id === 2);
assert(overview?.anchor_quality === "strong", "overview strong anchor");
assert(
  String(amoral?.chunk || "").toLowerCase().includes("chapter 3"),
  "reordered block gets chapter 3 chunk",
);
assert(amoral?.anchor_quality === "strong" || amoral?.anchor_quality === "weak", "amoral anchor not fallback");

const zeroMatch = assignAlignedChunks(material, [{ id: 1, title: "ZZZQXQ", summary: "x", signature: ["zzzxqx"] }], [], {});
assert(zeroMatch[0].anchor_quality === "proportional_fallback", "zero match fallback");

const hierarchy = {
  tree: [
    { title: "Cap 1", level: 1, startOffset: 0, endOffset: 60, children: [] },
    { title: "Cap 2", level: 1, startOffset: 60, endOffset: 130, children: [] },
    { title: "Cap 3", level: 1, startOffset: 130, endOffset: material.length, children: [] },
  ],
};
const hierAligned = assignAlignedChunks(material, blocks, inventory, { docHierarchy: hierarchy });
const hierAmoral = hierAligned.find((b) => b.id === 2);
assert(String(hierAmoral?.chunk || "").includes("Chapter 3"), "hierarchy snap keeps chapter 3");

// ── T08: fidelity validation ──
section("T08 fidelity validation");
const terms = extractKeyTermsFromBlockMeta({
  blockTitle: "Technical amoralism",
  signature: ["amoralism"],
  concepts: [{ term: "amoralism" }],
});
assert(terms.includes("amoralism"), "extract key terms");

const poisoned = validateBlockFidelity({
  blockTitle: "Amoralism",
  signature: ["amoralism"],
  chunk: "The text discusses utilitarianism only.",
  explanation: "Universal Kantian amoralism is the central thesis.",
  concepts: [{ term: "amoralism" }],
});
assert(poisoned.ok === false, "poisoned block fails");

const okParaphrase = validateBlockFidelity({
  blockTitle: "Utilitarianism",
  signature: ["utilitarianism"],
  chunk: "Classical utilitarianism defines the good as maximum utility.",
  explanation: "Utilitarianism defines the good as maximum utility or benefit.",
});
assert(okParaphrase.ok === true, "paraphrase passes");

const weakLenient = validateBlockFidelity({
  blockTitle: "Amoralism",
  signature: ["amoralism"],
  chunk: "text without term",
  explanation: "another topic",
  anchor_quality: "weak",
});
assert(weakLenient.ok === true, "weak anchor lenient for one term");

const retryPath = validateBlockFidelity({
  blockTitle: "Amoralism and deontology",
  signature: ["amoralism", "deontology"],
  chunk: "only amoralism appears here",
  explanation: "pure Kantian deontology",
});
assert(retryPath.action === "retry", "retry action on unsupported");

const warnPath = validateBlockFidelity({
  blockTitle: "Amoralism and deontology",
  signature: ["amoralism", "deontology"],
  chunk: "only amoralism",
  explanation: "pure deontology",
  isRetry: true,
});
assert(warnPath.action === "warn", "warn after retry");

const chunkHit = validateBlockFidelity({
  blockTitle: "Utility",
  signature: ["utility"],
  chunk: "Utility is central.",
  explanation: "Utility organizes the argument.",
});
assert(chunkHit.ok === true, "term in chunk passes");

// ── T09: banner message logic ──
section("T09 fidelity banner");
function resolveBannerMessage(block = {}, indexEntry = {}) {
  const anchor = String(indexEntry.anchor_quality || block.anchor_quality || "").trim();
  const fidelity = String(block.fidelity_status || "").trim();
  if (anchor === "weak") return "Weak anchor to the document — compare with your PDF.";
  if (anchor === "proportional_fallback") {
    return "This block uses an approximate slice of the file; check the source.";
  }
  if (fidelity === "warn") {
    return "Reduced fidelity: some content may not reflect the source.";
  }
  return "";
}
assert(
  resolveBannerMessage({ fidelity_status: "warn" }, { anchor_quality: "strong" }).includes("Reduced fidelity"),
  "banner warn message",
);
assert(
  resolveBannerMessage({}, { anchor_quality: "weak" }).includes("Weak anchor"),
  "banner weak message",
);
assert(resolveBannerMessage({}, { anchor_quality: "strong" }) === "", "banner hidden on strong");

// ── T11: strict flag ──
section("T11 strict flag");
assert(typeof isSourceFidelityStrictEnabled() === "boolean", "strict flag callable");

// ── T12: guide excerpt ──
section("T12 guide document excerpt");
const excerpt = resolveGuideDocumentExcerpt(
  "what is amoralism",
  material,
  { studiedBlockCount: 1 },
);
assert(excerpt.toLowerCase().includes("amoralism"), "excerpt finds term");

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
window.guideContext = {
  sessionContext: "Block 1: Test\nBlock 1 source chunk:\nThe professor's amoralism.",
  currentBlockIndex: 0,
};
const guidePrompt = buildGuidePrompt("what is amoralism", 0);
assert(guidePrompt.includes("supreme authority"), "guide has fidelity rules");
assert(
  guidePrompt.includes("source chunk") || guidePrompt.includes("amoralism"),
  "guide prompt includes chunk context",
);

console.log(`\n── Summary ──\nPassed: ${passed}\nFailed: ${failed}`);
if (failed > 0) process.exit(1);
