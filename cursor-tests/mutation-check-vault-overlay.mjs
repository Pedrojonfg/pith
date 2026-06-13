/**
 * Lightweight mutation check — vault overlay no API key UX
 * Run: node cursor-tests/mutation-check-vault-overlay.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

const TARGETS = [
  {
    file: "src/js/vault/debug-ui.js",
    original: 'document.body.classList.toggle("vault-overlay-open", open);',
    mutant: "// document.body.classList.toggle(\"vault-overlay-open\", open);",
    label: "debug-ui: skip body overlay class",
  },
  {
    file: "src/js/main.js",
    original: "els.knowledgeVaultOverlay,",
    mutant: "null,",
    label: "main.js: wire vault without overlay element",
  },
  {
    file: "src/js/study.js",
    original: 'materialGraphBackScreen = getCurrentScreenId() || "modeSelect";',
    mutant: 'materialGraphBackScreen = "setup";',
    label: "study.js: vault graph back to API setup",
  },
];

function runSuite() {
  const r = spawnSync(
    process.execPath,
    ["--import", "./cursor-tests/register.mjs", "cursor-tests/20260620_vault-overlay-no-api-key.mjs"],
    { cwd: root, encoding: "utf8" },
  );
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}` };
}

async function applyMutation(target) {
  const path = join(root, target.file);
  const text = await readFile(path, "utf8");
  if (!text.includes(target.original)) {
    throw new Error(`Original snippet not found in ${target.file}`);
  }
  await writeFile(path, text.replace(target.original, target.mutant), "utf8");
  return text;
}

const results = [];
let killed = 0;
let survived = 0;

const baseline = runSuite();
if (!baseline.ok) {
  console.error("Baseline suite must pass before mutation check.\n", baseline.out);
  process.exit(1);
}

for (const target of TARGETS) {
  const originalText = await readFile(join(root, target.file), "utf8");
  try {
    await applyMutation(target);
    const after = runSuite();
    if (after.ok) {
      survived += 1;
      results.push({ label: target.label, status: "SURVIVED" });
    } else {
      killed += 1;
      results.push({ label: target.label, status: "KILLED" });
    }
  } finally {
    await writeFile(join(root, target.file), originalText, "utf8");
  }
}

const total = killed + survived;
const pct = total ? Math.round((killed / total) * 100) : 0;

console.log("\nMutation check — vault overlay no API key");
for (const r of results) {
  console.log(`  [${r.status}] ${r.label}`);
}
console.log(`\nKilled: ${killed}/${total} (${pct}%) — threshold 70%`);

if (pct < 70) {
  console.error("Mutation check below 70% — add tests for SURVIVED mutants.");
  process.exit(1);
}
