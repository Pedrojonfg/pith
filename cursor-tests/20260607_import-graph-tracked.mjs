/**
 * Fails if main.js import chain references files not tracked in git.
 * Run: node cursor-tests/20260607_import-graph-tracked.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = new Set(
  execSync("git ls-files", { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, "/")),
);

const visited = new Set();
const gaps = [];

function walk(rel) {
  const file = rel.replace(/\\/g, "/");
  if (visited.has(file)) return;
  visited.add(file);
  const abs = join(root, file);
  if (!existsSync(abs)) {
    gaps.push({ file, reason: "missing on disk" });
    return;
  }
  if (!tracked.has(file)) {
    gaps.push({ file, reason: "not tracked in git" });
  }
  const src = readFileSync(abs, "utf8");
  const dir = dirname(file);
  for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const spec = m[1].split("?")[0];
    const next = join(dir, spec).replace(/\\/g, "/");
    walk(next.endsWith(".js") ? next : `${next}.js`);
  }
}

walk("src/js/main.js");

const mustHave = ["src/js/slow/sidebar.js", "src/js/offline.js"];
for (const f of mustHave) {
  if (!tracked.has(f)) gaps.push({ file: f, reason: "required boot module not tracked" });
}

if (gaps.length) {
  console.error("IMPORT GRAPH GAPS:");
  for (const g of gaps) console.error(`  ${g.file}: ${g.reason}`);
  process.exit(1);
}
console.log(`Import graph tracked OK (${visited.size} modules)`);
