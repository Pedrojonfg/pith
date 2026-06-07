/**
 * Fails if study.js imports files that are not tracked in git.
 * Run: node cursor-tests/_import-graph-check.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tracked = new Set(
  execSync("git ls-files", { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .map((p) => normalize(p.replace(/\\/g, "/"))),
);

const importRe = /from\s+["'](\.[^"']+)["']/g;
const visited = new Set();
const missing = [];

const rootNorm = normalize(root.replace(/\\/g, "/"));

function resolveImport(fromFile, spec) {
  const base = spec.split("?")[0];
  const dir = dirname(fromFile);
  let abs = join(root, dir, base);
  if (!abs.endsWith(".js")) abs += ".js";
  return normalize(abs.replace(/\\/g, "/"));
}

function toRel(absPath) {
  return absPath.startsWith(rootNorm + "/") ? absPath.slice(rootNorm.length + 1) : absPath;
}

function walk(relFile) {
  const norm = normalize(relFile.replace(/\\/g, "/"));
  if (visited.has(norm)) return;
  visited.add(norm);
  const abs = join(root, norm);
  if (!existsSync(abs)) {
    missing.push({ file: norm, reason: "file missing on disk" });
    return;
  }
  if (!tracked.has(norm)) {
    missing.push({ file: norm, reason: "not tracked in git" });
  }
  const src = readFileSync(abs, "utf8");
  let m;
  const re = /from\s+["'](\.[^"']+)["']/g;
  while ((m = re.exec(src)) !== null) {
    walk(toRel(resolveImport(norm, m[1])));
  }
}

walk("src/js/main.js");

if (missing.length) {
  console.error("IMPORT GRAPH GAPS (cause blank screen on deploy/PWA):");
  for (const item of missing) console.error(`  - ${item.file}: ${item.reason}`);
  process.exit(1);
}
console.log(`Import graph OK — ${visited.size} modules, all tracked`);
