/**
 * T03 — lazy html_min → markdown session migration
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260608_t03-migrate-html-min.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LS_SESSIONS_BY_MODE_KEY } from "../src/js/config.js";
import { resetStorage } from "./setup-dom.mjs";
import {
  htmlMinToMarkdown,
  migrateLegacyHtmlMinSession,
} from "../src/js/normalization/migrate-html-min.js";
import { parseHeadings } from "../src/js/slow/headings.js";
import {
  loadSessionForMode,
  loadSessionsByMode,
  storeSessionForMode,
} from "../src/js/session.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "legacy-html-min-session.json",
);

function testHtmlMinToMarkdownHappyPath() {
  const html = "<h1>Title</h1><p>Body one.</p><p>Body two.</p>";
  const md = htmlMinToMarkdown(html);
  assert.match(md, /^# Title/m);
  assert.match(md, /Body one\./);
  assert.match(md, /Body two\./);
  assert.ok(!md.includes("<"), "no HTML tags remain");
}

function testHtmlMinToMarkdownBulletsAndBr() {
  const html = "<p>Intro<br>line two</p><li>Alpha</li><li>Beta</li>";
  const md = htmlMinToMarkdown(html);
  assert.match(md, /Intro/);
  assert.match(md, /line two/);
  assert.match(md, /^- Alpha/m);
  assert.match(md, /^- Beta/m);
}

function testHtmlMinToMarkdownEdgeEmpty() {
  assert.equal(htmlMinToMarkdown(""), "");
  assert.equal(htmlMinToMarkdown("   "), "");
}

function testHtmlMinToMarkdownFailurePlainText() {
  const md = htmlMinToMarkdown("No tags here.");
  assert.equal(md, "No tags here.");
}

function testFixtureMigrationAndHeadings() {
  const raw = fs.readFileSync(fixturePath, "utf8");
  const session = JSON.parse(raw);
  assert.equal(session.slow.normalizedFormat, "html_min");

  const migrated = migrateLegacyHtmlMinSession(session);
  assert.equal(migrated.slow.normalizedFormat, "markdown");
  assert.equal(migrated.slow._migratedFromHtmlMin, true);
  assert.match(migrated.slow.normalizedTextFull, /^# Introduction/m);
  assert.match(migrated.slow.normalizedTextFull, /## Methods/);

  const headings = parseHeadings(migrated.slow.normalizedTextFull, "markdown");
  assert.equal(headings.length, 2);
  assert.equal(headings[0].label, "Introduction");
  assert.equal(headings[1].label, "Methods");
}

function testMigrationIdempotent() {
  const session = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  migrateLegacyHtmlMinSession(session);
  const first = session.slow.normalizedTextFull;
  migrateLegacyHtmlMinSession(session);
  assert.equal(session.slow.normalizedTextFull, first);
  assert.equal(session.slow.normalizedFormat, "markdown");
}

function testNonHtmlMinUnchanged() {
  const session = {
    studyMode: "slow",
    slow: { normalizedTextFull: "# Already md", normalizedFormat: "markdown" },
  };
  const out = migrateLegacyHtmlMinSession(session);
  assert.equal(out.slow.normalizedFormat, "markdown");
  assert.equal(out.slow._migratedFromHtmlMin, undefined);
}

function testClozeSlotMigration() {
  const session = {
    studyMode: "cloze",
    cloze: {
      normalizedText: "<h2>Cloze Title</h2><p>Item body.</p>",
      normalizedFormat: "html_min",
    },
  };
  migrateLegacyHtmlMinSession(session);
  assert.equal(session.cloze.normalizedFormat, "markdown");
  assert.match(session.cloze.normalizedText, /^## Cloze Title/m);
  const headings = parseHeadings(session.cloze.normalizedText, "markdown");
  assert.equal(headings.length, 1);
  assert.equal(headings[0].label, "Cloze Title");
}

function testSessionJsLoadHook() {
  resetStorage();
  const legacy = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  storeSessionForMode("slow", legacy);
  localStorage.setItem(
    LS_SESSIONS_BY_MODE_KEY,
    JSON.stringify({ rsvp: null, slow: legacy, cloze: null, questions: null }),
  );

  const loaded = loadSessionForMode("slow");
  assert.equal(loaded.slow.normalizedFormat, "markdown");
  assert.equal(loaded.slow._migratedFromHtmlMin, true);
  const headings = parseHeadings(loaded.slow.normalizedTextFull, "markdown");
  assert.ok(headings.length >= 2, "loadSessionForMode returns migrated headings");

  const all = loadSessionsByMode();
  assert.equal(all.slow.slow.normalizedFormat, "markdown");
}

testHtmlMinToMarkdownHappyPath();
testHtmlMinToMarkdownBulletsAndBr();
testHtmlMinToMarkdownEdgeEmpty();
testHtmlMinToMarkdownFailurePlainText();
testFixtureMigrationAndHeadings();
testMigrationIdempotent();
testNonHtmlMinUnchanged();
testClozeSlotMigration();
testSessionJsLoadHook();

console.log("20260608_t03-migrate-html-min: all tests passed");
