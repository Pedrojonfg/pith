/**
 * Post A+ T03 — document import without session ("Already know").
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t03-document-import.mjs
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resetStorage } from "./setup-dom.mjs";
import {
  DOCUMENT_IMPORT_DEFAULT_MASTERY,
  applyImportDefaultMastery,
  importFromDocument,
} from "../src/js/vault/import.js";
import { loadVault } from "../src/js/vault/vault-store.js";

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

const [html, studySrc, importSrc] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/js/study.js"), "utf8"),
  readFile(join(root, "src/js/vault/import.js"), "utf8"),
]);

// --- Happy path: UI contract ---

assert(
  html.includes('id="alreadyKnowMaterial"'),
  "happy: index.html exposes alreadyKnowMaterial checkbox",
);
assert(
  html.includes("Already know this material"),
  "happy: checkbox label matches spec",
);
assert(
  studySrc.includes("alreadyKnowMaterial?.checked"),
  "happy: study.js branches on already-know checkbox",
);
assert(
  studySrc.includes("importFromDocument"),
  "happy: study.js calls importFromDocument",
);
assert(
  importSrc.includes("export async function importFromDocument"),
  "happy: import.js exports importFromDocument",
);

// --- Happy path: default mastery ---

assert(
  DOCUMENT_IMPORT_DEFAULT_MASTERY === 0.8,
  "happy: document import default mastery is 0.8",
);

resetStorage();
const vault = loadVault();
vault.entries = [
  {
    id: "e1",
    canonicalTitle: "Loops",
    aliases: [],
    topic: "python",
    masteryBase: 0.2,
    masteryDeclarativeBase: 0.2,
    masteryProceduralBase: 0.2,
    masteryLastUpdated: 1,
    masteryDeclarativeLastUpdated: 1,
    masteryProceduralLastUpdated: 1,
    lastSeen: 1,
    sources: [],
    prerequisites: [],
    dependents: [],
    observations: [],
  },
];
applyImportDefaultMastery(vault, { c1: "e1" }, 0.8);
assert(vault.entries[0].masteryBase === 0.8, "happy: applyImportDefaultMastery sets 0.8 floor");

// --- Edge: mastery never lowered ---

vault.entries[0].masteryBase = 0.95;
applyImportDefaultMastery(vault, { c1: "e1" }, 0.8);
assert(vault.entries[0].masteryBase === 0.95, "edge: applyImportDefaultMastery preserves higher mastery");

// --- Failure: empty document ---

resetStorage();
const emptyResult = await importFromDocument({ name: "empty.md" }, { cleanedText: "   " });
assert(emptyResult.added === 0, "failure: empty doc adds nothing");
assert(emptyResult.merged === 0, "failure: empty doc merges nothing");
assert(
  emptyResult.errors.some((e) => /empty/i.test(e)),
  "failure: empty doc reports error",
);

// --- Contract: no session create in import module ---

assert(
  !importSrc.includes("createSession(") && !importSrc.includes("ensureDocumentSessionForUpload"),
  "contract: import.js does not create study sessions",
);

console.log(`\nkv-post-t03: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
