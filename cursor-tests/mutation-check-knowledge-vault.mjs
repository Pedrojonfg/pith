/**
 * Lightweight mutation check — vault modules (validate skill PASO 4).
 * Run: node cursor-tests/mutation-check-knowledge-vault.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

const TARGETS = [
  {
    file: "src/js/vault/mastery-model.js",
    original: "export const LAMBDA = 0.05;",
    mutant: "export const LAMBDA = 0;",
    label: "mastery: LAMBDA disabled (no decay)",
  },
  {
    file: "src/js/vault/mastery-model.js",
    original: "export const PRESUMED_KNOWN_THRESHOLD = 0.7;",
    mutant: "export const PRESUMED_KNOWN_THRESHOLD = 0;",
    label: "mastery: presumed threshold zeroed",
  },
  {
    file: "src/js/vault/vault-store.js",
    original: "topic.includes(dt) || dt.includes(topic)",
    mutant: "topic.includes(dt) && dt.includes(topic)",
    label: "vault-store: topic match requires both directions",
  },
  {
    file: "src/js/vault/normalization.js",
    original: 'const action = String(row?.action || "new").trim().toLowerCase();',
    mutant: 'const action = "new";',
    label: "normalization: ignore merge/alias actions",
  },
  {
    file: "src/js/vault/prerequisites.js",
    original: "if (!dependent.prerequisites.includes(preId)) dependent.prerequisites.push(preId);",
    mutant: "// if (!dependent.prerequisites.includes(preId)) dependent.prerequisites.push(preId);",
    label: "prerequisites: skip forward edge",
  },
  {
    file: "src/js/mode-bootstrap.js",
    original: "if (nBlocks > 0 && blocks.length > 0) return true;",
    mutant: "if (nBlocks > 0 && blocks.length > 0) return false;",
    label: "mode-bootstrap: block index resume disabled",
  },
];

function runSuite() {
  const r = spawnSync(
    process.execPath,
    ["--import", "./cursor-tests/register.mjs", "cursor-tests/20260618_knowledge-vault-a-plus.mjs"],
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

console.log("\nMutation check — Knowledge Vault");
for (const r of results) {
  console.log(`  [${r.status}] ${r.label}`);
}
console.log(`\nKilled: ${killed}/${total} (${pct}%) — threshold 70%`);

if (pct < 70) {
  console.error("Mutation check below 70% — add tests for SURVIVED mutants.");
  process.exit(1);
}
