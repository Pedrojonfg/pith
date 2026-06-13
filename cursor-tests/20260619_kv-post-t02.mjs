/**
 * Post A+ T02 — external text import
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t02.mjs
 */
import { resetStorage } from "./setup-dom.mjs";
import {
  DEFAULT_TEXT_IMPORT_MASTERY,
  applyImportMappings,
  importFromText,
} from "../src/js/vault/import.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
  saveVault,
} from "../src/js/vault/vault-store.js";

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

resetStorage();
clearVault();

// failure: empty text
(async () => {
  const empty = await importFromText("   ");
  assert(empty.added === 0 && empty.merged === 0, "failure: empty text rejected");
  assert(empty.errors.includes("Text is empty."), "failure: empty text error message");

  // happy: new concepts with default mastery 0.7
  const extractFn = async () => [
    { title: "Variables", topic: "python" },
    { title: "Loops", topic: "python" },
    { title: "Functions", topic: "python" },
  ];
  const normalizeFn = async ({ newConcepts }) =>
    newConcepts.map((c) => ({
      conceptId: c.id,
      action: "new",
      vaultEntryId: null,
    }));

  const result = await importFromText("I know Python basics: variables, loops, functions", {
    extractFn,
    normalizeFn,
  });
  assert(result.added === 3 && result.merged === 0, "happy: three concepts added");
  assert(result.errors.length === 0, "happy: no import errors");

  const vault = loadVault();
  assert(vault.entries.length === 3, "happy: vault has three entries");
  assert(
    vault.entries.every((e) => Math.abs(e.masteryBase - DEFAULT_TEXT_IMPORT_MASTERY) < 0.001),
    "happy: default mastery 0.7 on new entries",
  );
  assert(
    vault.importHistory.length === 1 && vault.importHistory[0].type === "text",
    "happy: ImportRecord appended",
  );
  assert(vault.importHistory[0].conceptsAdded === 3, "happy: ImportRecord counts added");

  // happy: merge overlap
  clearVault();
  const existing = addManualEntry({
    canonicalTitle: "Variables",
    topic: "python",
    masteryBase: 0.4,
  });
  const mergeExtract = async () => [{ title: "Python variables", topic: "python" }];
  const mergeNormalize = async ({ newConcepts }) => [
    {
      conceptId: newConcepts[0].id,
      action: "merge",
      vaultEntryId: existing.id,
    },
  ];
  const merged = await importFromText("I know python variables", {
    extractFn: mergeExtract,
    normalizeFn: mergeNormalize,
  });
  assert(merged.added === 0 && merged.merged === 1, "happy: overlap merges");
  const afterMerge = loadVault();
  assert(afterMerge.entries.length === 1, "happy: single entry after merge");
  assert(
    afterMerge.entries[0].masteryBase >= DEFAULT_TEXT_IMPORT_MASTERY,
    "happy: merge raises mastery to import default",
  );

  // edge: applyImportMappings alias path
  clearVault();
  const survivor = addManualEntry({ canonicalTitle: "Chain rule", topic: "calculus", masteryBase: 0.3 });
  const vaultAlias = loadVault();
  const aliasId = "alias-concept-id";
  const conceptsById = new Map([
    [aliasId, { id: aliasId, title: "Differentiation chain rule", topic: "calculus" }],
  ]);
  applyImportMappings(
    vaultAlias,
    [{ conceptId: aliasId, action: "alias", vaultEntryId: survivor.id }],
    conceptsById,
    0.7,
  );
  saveVault(vaultAlias);
  const aliasVault = loadVault();
  const aliasEntry = aliasVault.entries.find((e) => e.id === survivor.id);
  assert(
    aliasEntry?.aliases?.includes("Differentiation chain rule"),
    "edge: alias adds alternate title",
  );

  // failure: extract throws
  clearVault();
  const failExtract = async () => {
    throw new Error("LLM unavailable");
  };
  const failResult = await importFromText("some text", { extractFn: failExtract });
  assert(failResult.added === 0, "failure: extract error adds nothing");
  assert(failResult.errors.some((e) => e.includes("LLM unavailable")), "failure: extract error surfaced");
  assert(loadVault().importHistory.length === 1, "failure: ImportRecord still appended on extract error");

  console.log(`\nPost A+ T02: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
