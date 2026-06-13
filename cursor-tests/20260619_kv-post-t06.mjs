/**
 * Post A+ T06 — misconception prompt injection
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t06.mjs
 */
import { buildConceptPackPrompt } from "../src/js/api.js";
import {
  buildBlockVaultHint,
  buildMisconceptionPromptLines,
  buildVaultContextBlock,
} from "../src/js/vault/prompt-injection.js";
import { clearVault, saveVault } from "../src/js/vault/vault-store.js";

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

function seedEntry(overrides = {}) {
  return {
    id: "e1",
    canonicalTitle: "Photosynthesis",
    aliases: [],
    topic: "biology",
    masteryBase: 0.85,
    masteryLastUpdated: Date.now(),
    lastSeen: Date.now(),
    sources: [{ docId: "d", conceptId: "photo-1", addedAt: Date.now() }],
    prerequisites: [],
    dependents: [],
    observations: [],
    misconceptions: [],
    ...overrides,
  };
}

clearVault();

// happy: active misconception appears in pack context block
const activeMisc = "Learner treats respiration as the same process";
saveVault({
  schemaVersion: 2,
  lastUpdated: Date.now(),
  entries: [
    seedEntry({
      misconceptions: [
        {
          id: "m1",
          description: activeMisc,
          confidence: 0.8,
          resolved: false,
          detectedAt: Date.now(),
        },
      ],
    }),
  ],
});
const vaultEntries = [
  {
    canonicalTitle: "Photosynthesis",
    masteryBase: 0.85,
    misconceptions: [
      { description: activeMisc, resolved: false },
    ],
    dependents: [],
  },
];
const packBlock = buildVaultContextBlock(vaultEntries);
assert(packBlock.includes("Known misconception for \"Photosynthesis\""), "happy: pack block has misconception header");
assert(packBlock.includes(activeMisc), "happy: pack block includes misconception description");
assert(
  packBlock.includes("contrast correct vs incorrect understanding"),
  "happy: pack block includes contrast instruction",
);

// happy: misconception-only entry still emits context (no mastery buckets)
const miscOnly = buildVaultContextBlock([
  {
    canonicalTitle: "Mitosis",
    masteryBase: 0.1,
    dependents: [],
    misconceptions: [{ description: "Confuses mitosis with meiosis", resolved: false }],
  },
]);
assert(miscOnly.includes("Known misconception for \"Mitosis\""), "happy: misconception-only entry still emits block");

// edge: resolved misconception omitted
const resolvedOnly = buildVaultContextBlock([
  seedEntry({
    misconceptions: [{ description: "Old mistake", resolved: true }],
  }),
]);
assert(!resolvedOnly.includes("Old mistake"), "edge: resolved misconception omitted from pack block");

// failure: empty description skipped
const noDesc = buildMisconceptionPromptLines([
  { canonicalTitle: "X", misconceptions: [{ description: "  ", resolved: false }] },
]);
assert(noDesc.length === 0, "failure: blank misconception description skipped");

// contract: buildBlockVaultHint includes misconception for block concepts
const blockHint = buildBlockVaultHint(
  ["photo-1"],
  [
    seedEntry({
      misconceptions: [{ description: activeMisc, resolved: false }],
    }),
  ],
);
assert(blockHint.includes(activeMisc), "contract: block hint includes active misconception");
assert(
  blockHint.includes("contrast correct vs incorrect understanding"),
  "contract: block hint includes contrast instruction",
);

// contract: api pack path appends vault context with misconception
const packPrompt = buildConceptPackPrompt(4, "English", "[]", {
  vaultContextBlock: packBlock,
});
assert(packPrompt.includes(activeMisc), "contract: buildConceptPackPrompt forwards misconception context");

console.log(`\nT06 results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
