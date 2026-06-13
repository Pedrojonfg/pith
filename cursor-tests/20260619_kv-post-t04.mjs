/**
 * Post A+ T04 — CSV/JSON structured import
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260619_kv-post-t04.mjs
 */
import { readFileSync } from "node:fs";
import { resetStorage } from "./setup-dom.mjs";
import {
  DEFAULT_STRUCT_IMPORT_MASTERY,
  importFromCsv,
  importFromJson,
  importStructuredRows,
  parseCsvText,
  parseJsonImportText,
} from "../src/js/vault/import.js";
import {
  addManualEntry,
  clearVault,
  loadVault,
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

function csvFile(name, content) {
  return { name, content };
}

resetStorage();
clearVault();

// happy: CSV three valid rows
(async () => {
  const csv = `canonicalTitle,topic,mastery,prerequisites
"Variables","python",0.75,""
"Loops","python",0.8,""
"Functions","python",0.7,""`;

  const parsed = parseCsvText(csv);
  assert(parsed.errors.length === 0, "happy: CSV parse has no errors");
  assert(parsed.rows.length === 3, "happy: CSV parse yields three rows");

  const result = importStructuredRows(parsed.rows);
  assert(result.added === 3 && result.merged === 0, "happy: three concepts added from CSV rows");
  assert(result.errors.length === 0, "happy: no row errors");

  const vault = loadVault();
  assert(vault.entries.length === 3, "happy: vault has three entries");
  assert(
    vault.entries.every((e) => e.masteryBase >= 0.7),
    "happy: per-row mastery applied",
  );

  // partial: bad middle row still imports valid rows
  clearVault();
  const partialCsv = `canonicalTitle,topic,mastery,prerequisites
"Alpha","math",0.7,""
"","math",0.5,""
"Gamma","math",0.8,""`;
  const partial = await importFromCsv(csvFile("partial.csv", partialCsv));
  assert(partial.added === 2 && partial.merged === 0, "partial: two valid rows imported");
  assert(
    partial.errors.some((e) => e.includes("Row 3") && e.includes("canonicalTitle")),
    "partial: invalid row reported",
  );
  assert(loadVault().entries.length === 2, "partial: vault retains successful rows");

  // happy: merge existing title+topic
  clearVault();
  addManualEntry({ canonicalTitle: "Chain rule", topic: "calculus", masteryBase: 0.4 });
  const mergeCsv = `canonicalTitle,topic,mastery,prerequisites
"Chain rule","calculus",0.85,""`;
  const merged = await importFromCsv(csvFile("merge.csv", mergeCsv));
  assert(merged.added === 0 && merged.merged === 1, "happy: duplicate row counts as merged");
  const mergedVault = loadVault();
  assert(mergedVault.entries.length === 1, "happy: still one entry after merge");
  assert(mergedVault.entries[0].masteryBase >= 0.85, "happy: merge raises mastery");

  // happy: JSON import
  clearVault();
  const json = JSON.stringify({
    entries: [
      { canonicalTitle: "Limits", topic: "calculus", masteryBase: 0.72, prerequisites: [] },
      { canonicalTitle: "Derivatives", topic: "calculus", masteryBase: 0.68, prerequisites: [] },
    ],
  });
  const jsonParsed = parseJsonImportText(json);
  assert(jsonParsed.rows.length === 2, "happy: JSON parse yields two rows");
  const jsonResult = await importFromJson(csvFile("concepts.json", json));
  assert(jsonResult.added === 2, "happy: JSON import adds entries");
  assert(
    loadVault().importHistory[0]?.type === "json",
    "happy: ImportRecord type json",
  );

  // edge: default mastery when column empty
  clearVault();
  const defaultCsv = `canonicalTitle,topic,mastery,prerequisites
"Topic default","physics",,""`;
  const defaultResult = importStructuredRows(parseCsvText(defaultCsv).rows);
  assert(defaultResult.added === 1, "edge: row without mastery still imports");
  const defaultEntry = loadVault().entries[0];
  assert(
    Math.abs(defaultEntry.masteryBase - DEFAULT_STRUCT_IMPORT_MASTERY) < 0.001,
    "edge: default mastery 0.7 when omitted",
  );

  // failure: invalid JSON
  clearVault();
  const badJson = await importFromJson(csvFile("bad.json", "{ not json"));
  assert(badJson.added === 0, "failure: invalid JSON adds nothing");
  assert(badJson.errors.some((e) => e.includes("Invalid JSON")), "failure: invalid JSON error surfaced");

  // failure: empty CSV
  clearVault();
  const emptyCsv = await importFromCsv(csvFile("empty.csv", "   "));
  assert(emptyCsv.added === 0, "failure: empty CSV adds nothing");
  assert(emptyCsv.errors.some((e) => e.includes("empty")), "failure: empty CSV error surfaced");
  assert(loadVault().importHistory[0]?.type === "csv", "failure: csv ImportRecord still appended");

  // contract: debug-ui file picker wiring
  const debugUiSrc = readFileSync(new URL("../src/js/vault/debug-ui.js", import.meta.url), "utf8");
  assert(debugUiSrc.includes("importFromCsv"), "contract: debug-ui imports CSV path");
  assert(debugUiSrc.includes("importFromJson"), "contract: debug-ui imports JSON path");
  assert(debugUiSrc.includes("vaultImportFile"), "contract: file input id present");
  assert(debugUiSrc.includes("vaultFileImportErrors"), "contract: partial error list in UI");

  const importSrc = readFileSync(new URL("../src/js/vault/import.js", import.meta.url), "utf8");
  assert(importSrc.includes("export async function importFromCsv"), "contract: importFromCsv exported");
  assert(importSrc.includes("export async function importFromJson"), "contract: importFromJson exported");
  assert(importSrc.includes("partial success") || importSrc.includes("parseErrors"), "contract: partial import path");

  console.log(`\nPost A+ T04: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
