#!/usr/bin/env node
/**
 * One-shot: gate // [debug-enrich] console.* behind debug-enrich.js helpers.
 * ponytail: stdlib + single pass; delete after run if desired.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "js");

const LEVEL_MAP = {
  debug: "deLog",
  info: "deInfo",
  warn: "deWarn",
  error: "deError",
};

function relImport(fromFile, target = "debug-enrich.js") {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, path.join(ROOT, target)).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel.replace(/\.js$/, "") + ".js";
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

function migrateFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  if (!src.includes("[debug-enrich]")) return { changed: false };

  const used = new Set();
  const lines = src.split("\n");
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.includes("// [debug-enrich]")) {
      out.push(line);
      continue;
    }
    const next = lines[i + 1] ?? "";
    let m =
      next.match(/^(\s*)if \(isDebugEnrich\(\)\) console\.(debug|info|warn|error)\((.*)$/) ||
      next.match(/^(\s*)console\.(debug|info|warn|error)\((.*)$/);
    if (!m) {
      out.push(line);
      continue;
    }
    i += 1;
    const indent = m[1];
    const level = m[2];
    const rest = m[3];
    const fn = LEVEL_MAP[level];
    used.add(fn);
    out.push(`${indent}${fn}(${rest}`);
  }

  let nextSrc = out.join("\n");
  nextSrc = migrateInlineDebugEnrich(nextSrc, used);
  if (used.size === 0) return { changed: false };

  const importPath = relImport(filePath);
  const importLine = `import { ${[...used].sort().join(", ")} } from "${importPath}";`;

  if (/from\s*["'][^"']*debug-enrich\.js["']/.test(nextSrc)) {
    nextSrc = mergeDebugEnrichImport(nextSrc, used, importPath);
  } else {
    const im = nextSrc.match(/^import .+;\n/m);
    if (im) {
      const idx = nextSrc.indexOf(im[0]) + im[0].length;
      nextSrc = nextSrc.slice(0, idx) + importLine + "\n" + nextSrc.slice(idx);
    } else {
      nextSrc = importLine + "\n" + nextSrc;
    }
  }

  nextSrc = dropUnusedIsDebugEnrichImport(nextSrc);

  if (nextSrc !== src) {
    fs.writeFileSync(filePath, nextSrc);
    return { changed: true, used: [...used] };
  }
  return { changed: false };
}

function migrateInlineDebugEnrich(src, used) {
  if (!src.includes("[debug-enrich]")) return src;
  const lines = src.split("\n").map((line) => {
    if (!line.includes("[debug-enrich]")) return line;
    if (!/console\.(debug|info|warn|error)\(/.test(line)) return line;
    let next = line
      .replace(/console\.debug\(/g, () => {
        used.add("deLog");
        return "deLog(";
      })
      .replace(/console\.info\(/g, () => {
        used.add("deInfo");
        return "deInfo(";
      })
      .replace(/console\.warn\(/g, () => {
        used.add("deWarn");
        return "deWarn(";
      })
      .replace(/console\.error\(/g, () => {
        used.add("deError");
        return "deError(";
      });
    next = next.replace(/\s*\/\/ \[debug-enrich\]/g, "");
    return next;
  });
  return lines.join("\n");
}

function mergeDebugEnrichImport(src, used, importPath) {
  const re = new RegExp(
    `import\\s*\\{([^}]+)\\}\\s*from\\s*["']${importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'];`,
  );
  const m = src.match(re);
  if (!m) return src;
  const names = new Set(
    m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const u of used) names.add(u);
  const sorted = [...names].sort();
  const replacement = `import { ${sorted.join(", ")} } from "${importPath}";`;
  return src.replace(re, replacement);
}

function dropUnusedIsDebugEnrichImport(src) {
  if (/\bisDebugEnrich\s*\(/.test(src.replace(/import[^;]+debug-enrich[^;]+;/, ""))) {
    return src;
  }
  return src.replace(
    /import\s*\{\s*isDebugEnrich\s*\}\s*from\s*["'][^"']*debug-enrich\.js["'];\n?/,
    "",
  );
}

let changed = 0;
for (const f of walk(ROOT)) {
  const r = migrateFile(f);
  if (r.changed) {
    changed += 1;
    console.log("updated", path.relative(ROOT, f), r.used?.join(", ") ?? "");
  }
}
console.log("files changed:", changed);
