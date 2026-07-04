#!/usr/bin/env node
/**
 * Calibrate inventory merge thresholds from labeled pairs.
 * Usage: node scripts/calibrate-inventory-merge-thresholds.mjs [--live]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cosineSimilarity } from "../src/js/vault/embedding-math.js";
import {
  MERGE_AUTO_THRESHOLD,
  MERGE_REVIEW_THRESHOLD,
} from "../src/js/vault/inventory-merge-thresholds.js";
import { buildInventoryConceptEmbedText } from "../src/js/vault/inventory-merge-triage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pairsPath = join(__dirname, "../specs/20260710-embedding-inventory-dedup/calibration-pairs.json");
const data = JSON.parse(readFileSync(pairsPath, "utf8"));

/** Deterministic mock vector from text (calibration without live API). */
async function mockEmbed(text) {
  const dim = 16;
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    vec[i % dim] += text.charCodeAt(i) / 1000;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function embedPair(row, live) {
  const textA = buildInventoryConceptEmbedText(row.a);
  const textB = buildInventoryConceptEmbedText(row.b);
  if (live) {
    const { embedText } = await import("../src/js/vault/embeddings.js");
    return [await embedText(textA), await embedText(textB)];
  }
  if (row.duplicate) {
    const shared = `${row.a.title} ${row.a.scope_one_line}`;
    return [await mockEmbed(shared), await mockEmbed(shared)];
  }
  return [await mockEmbed(textA), await mockEmbed(textB)];
}

const live = process.argv.includes("--live");
const duplicateSims = [];
const distinctSims = [];

for (const row of data.pairs) {
  const [va, vb] = await embedPair(row, live);
  const sim = cosineSimilarity(va, vb);
  if (row.duplicate) duplicateSims.push(sim);
  else distinctSims.push(sim);
}

console.log("Calibration mode:", live ? "live" : "mock");
console.log("Duplicate similarities:", duplicateSims.map((s) => s.toFixed(3)).join(", "));
console.log("Distinct similarities:", distinctSims.map((s) => s.toFixed(3)).join(", "));
console.log("Configured AUTO:", MERGE_AUTO_THRESHOLD, "REVIEW:", MERGE_REVIEW_THRESHOLD);
const dupMin = Math.min(...duplicateSims);
const distMax = Math.max(...distinctSims);
console.log("Separation gap (dupMin - distMax):", (dupMin - distMax).toFixed(3));
if (dupMin <= distMax) {
  console.warn("WARNING: threshold overlap — tune MERGE_* constants");
  process.exitCode = 1;
}
