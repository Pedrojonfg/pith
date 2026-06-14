/**
 * Study Projects T06 — renderBreadcrumb + renderProjectPicker
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260623_t06-breadcrumb.mjs
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const mainCss = readFileSync(join(root, "src/css/main.css"), "utf8");
const uiSrc = readFileSync(join(root, "src/js/ui.js"), "utf8");

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

/** @returns {Promise<{ ui: object, doc: Document }>} */
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
  const ui = await import(pathToFileURL(join(root, "src/js/ui.js")).href + "?realui=1&t06=1");
  return { ui, doc: window.document };
}

function makeStore(projects) {
  return { schemaVersion: 1, projects };
}

// --- Static contracts ---

ok(uiSrc.includes("export function renderBreadcrumb"), "ui.js exports renderBreadcrumb");
ok(uiSrc.includes("export function renderProjectPicker"), "ui.js exports renderProjectPicker");
ok(mainCss.includes(".study-breadcrumb"), "CSS: breadcrumb styles");
ok(mainCss.includes(".project-picker"), "CSS: project picker styles");
ok(mainCss.includes("--project-picker-indent"), "CSS: picker indentation variable");

// --- Happy path: breadcrumb ---

async function testBreadcrumbSingleSegment() {
  const { ui } = await bootUi();
  const nav = ui.renderBreadcrumb([{ label: "Library" }]);
  ok(nav.tagName === "NAV", "breadcrumb: returns nav element");
  ok(nav.classList.contains("study-breadcrumb"), "breadcrumb: has class");
  ok(nav.textContent.includes("Library"), "breadcrumb: shows Library label");
  ok(nav.querySelector(".study-breadcrumb-current"), "breadcrumb: single segment is current");
}

async function testBreadcrumbFourClickableSegments() {
  const { ui } = await bootUi();
  const clicks = [];
  const nav = ui.renderBreadcrumb([
    { label: "Library", onClick: () => clicks.push("library") },
    { label: "Algebra", onClick: () => clicks.push("algebra") },
    { label: "Unit 3", onClick: () => clicks.push("unit3") },
    { label: "Chapter 1" },
  ]);

  ok(nav.querySelectorAll(".study-breadcrumb-sep").length === 3, "breadcrumb: three separators for 4 segments");
  const links = nav.querySelectorAll(".study-breadcrumb-link");
  ok(links.length === 3, "breadcrumb: three clickable segments");
  ok(nav.querySelector(".study-breadcrumb-current")?.textContent === "Chapter 1", "breadcrumb: last is current");

  links[0].click();
  links[1].click();
  links[2].click();
  ok(clicks.join(",") === "library,algebra,unit3", "breadcrumb: onClick handlers fire");
}

async function testBreadcrumbEmptySegmentsFiltered() {
  const { ui } = await bootUi();
  const nav = ui.renderBreadcrumb([{ label: "" }, null, { label: "Review" }]);
  ok(nav.textContent.trim() === "Review", "breadcrumb: empty segments filtered");
}

// --- Happy path: project picker ---

async function testProjectPickerFlatTreeIndentation() {
  const { ui } = await bootUi();
  const now = Date.now();
  const store = makeStore([
    { id: "misc", name: "Misc", parentId: null, createdAt: now, updatedAt: now },
    { id: "p1", name: "Algebra", parentId: null, createdAt: now, updatedAt: now },
    { id: "p2", name: "Unit 3", parentId: "p1", createdAt: now, updatedAt: now },
    { id: "p3", name: "Linear", parentId: "p2", color: "#3b82f6", createdAt: now, updatedAt: now },
  ]);

  const picker = ui.renderProjectPicker(store, { selectedId: "p2" });
  ok(picker.classList.contains("project-picker"), "picker: root class");
  const options = picker.querySelectorAll(".project-picker-option");
  ok(options.length === 4, "picker: four flat rows");

  const labels = [...options].map((el) => el.querySelector(".project-picker-label")?.textContent);
  ok(labels.includes("Misc") && labels.includes("Linear"), "picker: shows project names");

  const unit3 = picker.querySelector('[data-project-id="p2"]');
  ok(unit3?.classList.contains("project-picker-option--selected"), "picker: selected row marked");
  ok(unit3?.style.getPropertyValue("--project-picker-indent") === "14px", "picker: child indent 14px");

  const linear = picker.querySelector('[data-project-id="p3"]');
  ok(linear?.style.getPropertyValue("--project-picker-indent") === "28px", "picker: grandchild indent 28px");
  ok(linear?.querySelector(".project-picker-swatch"), "picker: optional color swatch");
}

async function testProjectPickerOnSelect() {
  const { ui } = await bootUi();
  const now = Date.now();
  const store = makeStore([
    { id: "misc", name: "Misc", parentId: null, createdAt: now, updatedAt: now },
    { id: "p1", name: "History", parentId: null, createdAt: now, updatedAt: now },
  ]);

  let picked = null;
  const picker = ui.renderProjectPicker(store, {
    selectedId: "misc",
    onSelect: (id) => {
      picked = id;
    },
  });
  picker.querySelector('[data-project-id="p1"]')?.click();
  ok(picked === "p1", "picker: onSelect receives project id");
}

// --- Edge cases ---

async function testProjectPickerEmptyStoreDefaultsMisc() {
  const { ui } = await bootUi();
  const picker = ui.renderProjectPicker({ schemaVersion: 1, projects: [] });
  const options = picker.querySelectorAll(".project-picker-option");
  ok(options.length === 1, "picker: empty store shows Misc fallback");
  ok(options[0]?.dataset.projectId === "misc", "picker: fallback id is misc");
  ok(options[0]?.classList.contains("project-picker-option--selected"), "picker: defaults selected to misc");
}

async function testBreadcrumbNonArrayInput() {
  const { ui } = await bootUi();
  const nav = ui.renderBreadcrumb(null);
  ok(nav.tagName === "NAV", "breadcrumb: null input still returns nav");
  ok(nav.textContent.trim() === "", "breadcrumb: null input renders empty");
}

// --- Failure / contract: session-types ---

async function testMiscProjectIdExport() {
  const types = await import(pathToFileURL(join(root, "src/js/session-types.js")).href);
  ok(types.MISC_PROJECT_ID === "misc", "session-types: MISC_PROJECT_ID is misc");
}

await testMiscProjectIdExport();
await testBreadcrumbSingleSegment();
await testBreadcrumbFourClickableSegments();
await testBreadcrumbEmptySegmentsFiltered();
await testBreadcrumbNonArrayInput();
await testProjectPickerFlatTreeIndentation();
await testProjectPickerOnSelect();
await testProjectPickerEmptyStoreDefaultsMisc();

console.log(`\n20260623_t06-breadcrumb: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
