/**
 * Lightweight mutation check — pure logic from RSVP assessment reposition.
 * Simulates stryker-style mutants by exercising mutated clones; real suite must kill equivalents.
 */
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

const TARGETS = [
  {
    file: "src/js/config/flags.js",
    original: "ASSESSMENT_BEFORE_PACKING: true",
    mutant: "ASSESSMENT_BEFORE_PACKING: false",
    label: "flags: BEFORE_PACKING true→false",
  },
  {
    file: "src/js/session.js",
    original: `    delete meta.knowledge_profile;
    meta.packing_ignored_profile = false;`,
    mutant: `    // delete meta.knowledge_profile; MUTANT
    meta.packing_ignored_profile = false;`,
    label: "session: setAssessmentSkipped no longer clears profile",
  },
  {
    file: "src/js/session.js",
    original: "if (idx.length > requested_n)",
    mutant: "if (idx.length >= 0)",
    label: "session: validatePackInvariants always errors",
  },
  {
    file: "src/js/api.js",
    original: 'profileItem.mastery = "none";',
    mutant: 'profileItem.mastery = "full";',
    label: "api: dont-know → full instead of none",
  },
  {
    file: "src/js/api.js",
    original: "if (options.length < 2)",
    mutant: "if (options.length < 0)",
    label: "api: options min length check disabled",
  },
  {
    file: "src/js/api.js",
    original: 'if (type !== "mcq")',
    mutant: 'if (type === "mcq")',
    label: "api: mcq type guard inverted",
  },
];

function runSuite() {
  const r = spawnSync(
    process.execPath,
    ["--import", "./cursor-tests/register.mjs", "cursor-tests/20260611_rsvp-assessment-reposition.mjs"],
    { cwd: root, encoding: "utf8" },
  );
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}` };
}

async function applyMutation(target) {
  const path = join(root, target.file);
  const text = await readFile(path, "utf8");
  if (!text.includes(target.original)) {
    throw new Error(`Original snippet not found in ${target.file}: ${target.original}`);
  }
  await writeFile(path, text.replace(target.original, target.mutant), "utf8");
}

async function restore(target, originalText) {
  await writeFile(join(root, target.file), originalText, "utf8");
}

const results = [];
let killed = 0;
let survived = 0;
let errors = 0;

console.log("Mutation check — RSVP assessment reposition (pure logic)\n");

for (const target of TARGETS) {
  const path = join(root, target.file);
  const originalText = await readFile(path, "utf8");
  try {
    await applyMutation(target);
    const { ok, out } = runSuite();
    if (ok) {
      survived += 1;
      results.push({ ...target, status: "SURVIVED" });
      console.log(`SURVIVED  ${target.label}`);
    } else {
      killed += 1;
      results.push({ ...target, status: "KILLED" });
      console.log(`KILLED    ${target.label}`);
    }
    if (!ok && !out.includes("Failed:")) {
      console.log(out.slice(-400));
    }
  } catch (err) {
    errors += 1;
    results.push({ ...target, status: "ERROR", error: String(err.message || err) });
    console.log(`ERROR     ${target.label}: ${err.message}`);
  } finally {
    await restore(target, originalText);
  }
}

const total = killed + survived;
const score = total ? Math.round((killed / total) * 100) : 0;
console.log(`\n${"=".repeat(48)}`);
console.log(`Mutantes: ${total}  Killed: ${killed}  Survived: ${survived}  Errors: ${errors}`);
console.log(`Score: ${score}% (umbral 70%)`);

if (survived > 0) {
  console.log("\nSupervivientes — añadir tests:");
  for (const r of results.filter((x) => x.status === "SURVIVED")) {
    console.log(`  - ${r.label}`);
  }
  process.exit(1);
}

if (score < 70) process.exit(1);
