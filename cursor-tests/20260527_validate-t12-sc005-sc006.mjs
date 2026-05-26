/**
 * Validate T12 — SC-005/006 suite presence + quickstart pass criteria
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260527_validate-t12-sc005-sc006.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

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

async function fileExists(rel) {
  try {
    await access(join(root, rel));
    return true;
  } catch {
    return false;
  }
}

assert(await fileExists("cursor-tests/20260527_t03-prefetch-write-through.mjs"), "T03 SC-005 test file exists");
assert(await fileExists("cursor-tests/20260527_t04-export-concepts-union.mjs"), "T04 SC-006 test file exists");

const quickstart = await readFile(
  join(root, "specs/20260527-zero-latency-blocks/quickstart.md"),
  "utf8",
);
assert(quickstart.includes("SC-005") && quickstart.includes("✓"), "quickstart marks SC-005 passed");
assert(quickstart.includes("SC-006") && quickstart.includes("✓"), "quickstart marks SC-006 passed");
assert(
  quickstart.includes("20260527_t03") && quickstart.includes("20260527_t04"),
  "quickstart references T03/T04 automated probes",
);

const t03 = await readFile(join(root, "cursor-tests/20260527_t03-prefetch-write-through.mjs"), "utf8");
assert(t03.includes("applyPrefetchReadySideEffects"), "T03 covers direct side effects");
assert(t03.includes("triggerPrefetch"), "T03 covers triggerPrefetch integration");
assert(t03.includes("collectExportConcepts"), "T03 probes SC-005 export growth");

const t04 = await readFile(join(root, "cursor-tests/20260527_t04-export-concepts-union.mjs"), "utf8");
assert(t04.includes("collectExportConcepts"), "T04 covers concept union");
assert(t04.includes("buildMarkdown"), "T04 covers mid-session markdown export");

console.log(`\nValidate T12 SC-005/006: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
