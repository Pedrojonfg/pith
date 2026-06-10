/**
 * Floating chrome visibility — red book (RSVP only) + blue guide (not slow/main)
 * Run: node cursor-tests/20260609_floating-chrome-visibility.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

let passed = 0;
let failed = 0;

function ok(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

function assertEq(actual, expected, msg) {
  ok(actual === expected, `${msg} (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`);
}

/** @returns {Promise<{ ui: object, doc: Document, body: HTMLElement }>} */
async function bootUi() {
  const dom = new JSDOM(html, { url: "http://127.0.0.1:3456/" });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    HTMLElement: window.HTMLElement,
    MutationObserver: window.MutationObserver,
    CustomEvent: window.CustomEvent,
    fetch: async () => ({ ok: false, status: 404 }),
  });
  window.offlineMode = false;
  window.localStorage.setItem("ds_api_key", "sk-test");
  const ui = await import(pathToFileURL(join(root, "src/js/ui.js")).href + "?fcv=1");
  return { ui, doc: window.document, body: window.document.body };
}

function btnState(doc) {
  const guide = doc.getElementById("sidebar-toggle-btn");
  const book = doc.getElementById("block-read-toggle-btn");
  return {
    guideHidden: guide?.hidden ?? true,
    bookHidden: book?.hidden ?? true,
  };
}

// --- Static contracts (HTML + source) ---

function testHtmlDefaults() {
  ok(html.includes('id="sidebar-toggle-btn"'), "HTML: guide toggle exists");
  ok(
    /<button[^>]*id="sidebar-toggle-btn"[^>]*\bhidden\b/i.test(html) ||
      html.includes('id="sidebar-toggle-btn"') && html.includes("hidden"),
    "HTML: guide toggle starts hidden",
  );
  ok(html.includes('id="block-read-toggle-btn"'), "HTML: block-read toggle exists");
  ok(html.includes('id="block-read-toggle-btn"') && html.includes("hidden"), "HTML: block-read starts hidden");
}

function testUiSourceContracts() {
  const uiSrc = readFileSync(join(root, "src/js/ui.js"), "utf8");
  ok(uiSrc.includes("syncFloatingChrome"), "ui.js: syncFloatingChrome exists");
  ok(uiSrc.includes("registerChromeStudyModeResolver"), "ui.js: mode resolver registered");
  ok(uiSrc.includes("SCREENS_WITH_GUIDE_TOGGLE"), "ui.js: guide screen allowlist");
  ok(uiSrc.includes('studyMode === "rsvp"'), "ui.js: block-read gated on rsvp");
  ok(uiSrc.includes('studyMode === "slow"'), "ui.js: guide suppressed in slow");
  ok(!readFileSync(join(root, "src/js/guide-chat.js"), "utf8").includes("toggleBtn.style.display"), "guide-chat: no display override on toggle");
  ok(
    readFileSync(join(root, "src/js/study.js"), "utf8").includes("registerChromeStudyModeResolver"),
    "study.js: registers chrome mode resolver",
  );
}

// --- Runtime visibility matrix ---

async function testMainScreensHideBoth() {
  const { ui, doc } = await bootUi();
  const mainScreens = [
    "setup",
    "modeSelect",
    "create",
    "blocks",
    "ready",
    "complete",
    "slowScope",
    "slowPhase0",
    "slowPhase3",
    "slowGraph",
    "assessment",
    "reviewConfig",
  ];
  for (const mode of ["rsvp", "questions", "cloze", "slow"]) {
    ui.registerChromeStudyModeResolver(() => mode);
    for (const screen of mainScreens) {
      ui.showScreen(screen);
      const { guideHidden, bookHidden } = btnState(doc);
      assertEq(guideHidden, true, `main ${screen} (${mode}): guide hidden`);
      assertEq(bookHidden, true, `main ${screen} (${mode}): book hidden`);
    }
  }
}

async function testRsvpStudyShowsGuideAndBookOnQuestions() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "rsvp");
  ui.showScreen("test");
  ui.setBlockReadSidebarAvailable(true);
  const duringTest = btnState(doc);
  assertEq(duringTest.guideHidden, false, "RSVP test: guide visible");
  assertEq(duringTest.bookHidden, false, "RSVP test: book visible when wanted");

  ui.showScreen("socratic");
  const duringSoc = btnState(doc);
  assertEq(duringSoc.guideHidden, false, "RSVP socratic: guide visible");
  assertEq(duringSoc.bookHidden, false, "RSVP socratic: book visible when wanted");
}

async function testQuestionsModeGuideOnlyNoBook() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "questions");
  ui.showScreen("test");
  ui.setBlockReadSidebarAvailable(true);
  const st = btnState(doc);
  assertEq(st.guideHidden, false, "questions test: guide visible");
  assertEq(st.bookHidden, true, "questions test: book hidden even when block-read wanted");
}

async function testClozeStudyShowsGuideNotBook() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "cloze");
  ui.showScreen("clozeStudy");
  ui.setBlockReadSidebarAvailable(true);
  const st = btnState(doc);
  assertEq(st.guideHidden, false, "cloze study: guide visible");
  assertEq(st.bookHidden, true, "cloze study: book hidden");
}

async function testSlowStudyHidesGuideOnStudyScreens() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "slow");
  const slowStudyScreens = ["test", "socratic", "between", "review", "clozeStudy"];
  for (const screen of slowStudyScreens) {
    ui.showScreen(screen);
    ui.setBlockReadSidebarAvailable(true);
    const st = btnState(doc);
    assertEq(st.guideHidden, true, `slow ${screen}: guide hidden`);
    assertEq(st.bookHidden, true, `slow ${screen}: book hidden`);
  }
  ui.showScreen("slowReader");
  const reader = btnState(doc);
  assertEq(reader.guideHidden, true, "slowReader: guide hidden");
  assertEq(reader.bookHidden, true, "slowReader: book hidden");
}

async function testRsvpOverlaySuppressesGuide() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "rsvp");
  ui.showScreen("test");
  ui.hideSidebar();
  const suppressed = btnState(doc);
  assertEq(suppressed.guideHidden, true, "RSVP overlay: guide hidden while suppressed");
  ui.showSidebar();
  const restored = btnState(doc);
  assertEq(restored.guideHidden, false, "RSVP overlay end: guide restored on test screen");
}

async function testAssessmentActiveHidesGuide() {
  const { ui, doc, body } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "rsvp");
  ui.showScreen("test");
  body.classList.add("assessment-active");
  ui.hideSidebar();
  const st = btnState(doc);
  assertEq(st.guideHidden, true, "assessment-active: guide hidden");
  body.classList.remove("assessment-active");
  ui.showSidebar();
  const after = btnState(doc);
  assertEq(after.guideHidden, false, "after assessment: guide visible again on test");
}

async function testBlockReadOnlyWhenWanted() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "rsvp");
  ui.showScreen("test");
  ui.setBlockReadSidebarAvailable(false);
  assertEq(btnState(doc).bookHidden, true, "RSVP test without want: book hidden");
  ui.setBlockReadSidebarAvailable(true);
  assertEq(btnState(doc).bookHidden, false, "RSVP test with want: book visible");
}

async function testBetweenBlocksRsvpGuideNoBook() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "rsvp");
  ui.showScreen("between");
  ui.setBlockReadSidebarAvailable(false);
  const st = btnState(doc);
  assertEq(st.guideHidden, false, "RSVP between: guide visible");
  assertEq(st.bookHidden, true, "RSVP between: book hidden");
}

async function testReviewScreensShowGuide() {
  const { ui, doc } = await bootUi();
  ui.registerChromeStudyModeResolver(() => "questions");
  for (const screen of ["review", "reviewGenerating", "reviewSummary"]) {
    ui.showScreen(screen);
    assertEq(btnState(doc).guideHidden, false, `questions ${screen}: guide visible`);
  }
}

async function testBootstrapHidesFloatingChrome() {
  const dom = new JSDOM(html, { url: "http://127.0.0.1:3456/" });
  const { document: doc } = dom.window;
  assertEq(doc.getElementById("sidebar-toggle-btn")?.hidden, true, "bootstrap HTML: guide hidden");
  assertEq(doc.getElementById("block-read-toggle-btn")?.hidden, true, "bootstrap HTML: book hidden");
}

// --- Run ---

testHtmlDefaults();
testUiSourceContracts();
await testBootstrapHidesFloatingChrome();
await testMainScreensHideBoth();
await testRsvpStudyShowsGuideAndBookOnQuestions();
await testQuestionsModeGuideOnlyNoBook();
await testClozeStudyShowsGuideNotBook();
await testSlowStudyHidesGuideOnStudyScreens();
await testRsvpOverlaySuppressesGuide();
await testAssessmentActiveHidesGuide();
await testBlockReadOnlyWhenWanted();
await testBetweenBlocksRsvpGuideNoBook();
await testReviewScreensShowGuide();

console.log(`\n20260609_floating-chrome-visibility: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
