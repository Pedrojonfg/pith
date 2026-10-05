#!/usr/bin/env node
/**
 * Fail if deploy version markers disagree.
 * - SW_VERSION (src/js/sw-update.js) must equal ?v= on sw-update.js and main.js in index.html
 * - CACHE_NAME (sw.js) must be present (separate pith-vN scheme; bump in the same deploy)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustMatch(label, re, text) {
  const m = text.match(re);
  if (!m) {
    console.error(`check-sw-version: missing ${label}`);
    process.exit(1);
  }
  return m[1];
}

const swUpdate = read("src/js/sw-update.js");
const indexHtml = read("index.html");
const swJs = read("sw.js");

const swVersion = mustMatch(
  "SW_VERSION",
  /export\s+const\s+SW_VERSION\s*=\s*["']([^"']+)["']/,
  swUpdate,
);
const cacheName = mustMatch(
  "CACHE_NAME",
  /const\s+CACHE_NAME\s*=\s*["']([^"']+)["']/,
  swJs,
);
const swUpdateV = mustMatch(
  "index.html sw-update.js?v=",
  /sw-update\.js\?v=([^"'\s]+)/,
  indexHtml,
);
const mainV = mustMatch(
  "index.html main.js?v=",
  /main\.js\?v=([^"'\s]+)/,
  indexHtml,
);

const errors = [];
if (swUpdateV !== swVersion) {
  errors.push(`sw-update.js?v=${swUpdateV} !== SW_VERSION=${swVersion}`);
}
if (mainV !== swVersion) {
  errors.push(`main.js?v=${mainV} !== SW_VERSION=${swVersion}`);
}
if (!/^pith-v\d+$/.test(cacheName)) {
  errors.push(`CACHE_NAME=${cacheName} must match pith-vN`);
}

if (errors.length) {
  for (const e of errors) console.error(`check-sw-version: ${e}`);
  process.exit(1);
}

console.log(
  `check-sw-version: ok SW_VERSION=${swVersion} CACHE_NAME=${cacheName}`,
);
