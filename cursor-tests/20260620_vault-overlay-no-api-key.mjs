/**
 * Knowledge Vault overlay — no API key UI on open
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260620_vault-overlay-no-api-key.mjs
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const mainSrc = readFileSync(join(root, "src/js/main.js"), "utf8");
const debugUiSrc = readFileSync(join(root, "src/js/vault/debug-ui.js"), "utf8");
const studySrc = readFileSync(join(root, "src/js/study.js"), "utf8");
const uiSrc = readFileSync(join(root, "src/js/ui.js"), "utf8");

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

function sectionContainsChild(sectionId, childId, dom) {
  const section = dom.window.document.getElementById(sectionId);
  const child = dom.window.document.getElementById(childId);
  return !!(section && child && section.contains(child));
}

// --- Static contracts (HTML + source) ---

// Happy: vault UI lives outside API setup screen
const domStatic = new JSDOM(html);
assert(
  !sectionContainsChild("screenApiSetup", "knowledgeVaultOverlay", domStatic),
  "happy: vault overlay is not nested in API setup screen",
);
assert(
  !sectionContainsChild("screenApiSetup", "knowledgeVaultPanel", domStatic),
  "happy: vault panel is not nested in API setup screen",
);
assert(html.includes('id="knowledgeVaultOverlay"'), "happy: global vault overlay exists");

// Happy: opening vault must not route through API setup screen
assert(
  mainSrc.includes("els.knowledgeVaultOverlay"),
  "contract: main.js passes overlay element to wireVaultDebugUi",
);
assert(
  !mainSrc.includes("wireVaultDebugUi(\n    els.knowledgeVaultPanel,\n    els.knowledgeVaultLink,\n    null,"),
  "contract: main.js does not omit overlay wiring",
);
assert(!debugUiSrc.includes('showScreen("setup")'), "happy: debug-ui never navigates to API setup");
assert(!debugUiSrc.includes("onOpen"), "happy: debug-ui removed onOpen navigation hook");

// Contract: graph back navigation uses current screen, not setup
assert(studySrc.includes("getCurrentScreenId"), "contract: study.js imports current screen id");
assert(
  studySrc.includes('materialGraphBackScreen = getCurrentScreenId() || "modeSelect"'),
  "contract: vault graph returns to active screen",
);
assert(uiSrc.includes("export function getCurrentScreenId"), "contract: ui.js exports getCurrentScreenId");

// Failure: legacy anti-pattern must stay gone
assert(
  !html.includes('id="knowledgeVaultPanel"') || !sectionContainsChild("screenApiSetup", "knowledgeVaultPanel", domStatic),
  "failure: vault panel must not live under API setup",
);

// --- Runtime: open vault from mode select with stored key ---

/** @returns {Promise<{ ui: object, vault: object, doc: Document }>} */
async function bootVaultUi() {
  const dom = new JSDOM(html, { url: "http://127.0.0.1:3456/" });
  const { window } = dom;
  Object.assign(globalThis, {
    window,
    document: window.document,
    localStorage: window.localStorage,
    HTMLElement: window.HTMLElement,
    MutationObserver: window.MutationObserver,
    CustomEvent: window.CustomEvent,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    fetch: async () => ({ ok: false, status: 404 }),
  });
  window.offlineMode = false;
  window.localStorage.setItem("ds_api_key", "sk-test-vault");
  const ui = await import(pathToFileURL(join(root, "src/js/ui.js")).href + "?vault-no-api=1");
  const vault = await import(pathToFileURL(join(root, "src/js/vault/debug-ui.js")).href + "?vault-no-api=1");
  return { ui, vault, doc: window.document };
}

async function testOpenVaultDoesNotShowApiSetup() {
  const { ui, vault, doc } = await bootVaultUi();
  ui.showScreen("modeSelect");

  const setup = doc.getElementById("screenApiSetup");
  const overlay = doc.getElementById("knowledgeVaultOverlay");
  const trigger = doc.getElementById("knowledgeVaultLink");
  const panel = doc.getElementById("knowledgeVaultPanel");
  const closeBtn = doc.getElementById("knowledgeVaultCloseBtn");
  const apiForm = doc.getElementById("apiKeyForm");

  vault.wireVaultDebugUi(panel, trigger, overlay, closeBtn, null);
  trigger?.click();

  assert(setup?.getAttribute("aria-hidden") === "true", "happy: API setup stays hidden after vault open");
  assert(overlay?.hidden === false, "happy: vault overlay becomes visible");
  assert(doc.body.classList.contains("vault-overlay-open"), "happy: body marks vault overlay open");
  assert(apiForm?.offsetParent === null || setup?.getAttribute("aria-hidden") === "true",
    "happy: API key form not on visible screen");

  const panelBody = doc.getElementById("knowledgeVaultPanelBody");
  const panelText = (panelBody?.textContent || "").toLowerCase();
  assert(!panelText.includes("api key"), "happy: rendered vault panel has no API key copy");
  assert(!panelText.includes("deepseek"), "happy: rendered vault panel has no provider key prompt");
  assert(panelText.includes("knowledge vault"), "happy: vault panel renders vault content");
}

async function testOpenVaultFromSetupHidesApiFormBehindOverlay() {
  const { ui, vault, doc } = await bootVaultUi();
  ui.showScreen("setup");

  const setup = doc.getElementById("screenApiSetup");
  const overlay = doc.getElementById("knowledgeVaultOverlay");
  const trigger = doc.getElementById("knowledgeVaultLink");
  const panel = doc.getElementById("knowledgeVaultPanel");
  const closeBtn = doc.getElementById("knowledgeVaultCloseBtn");

  vault.wireVaultDebugUi(panel, trigger, overlay, closeBtn, null);
  trigger?.click();

  assert(overlay?.hidden === false, "edge: vault opens even if setup was active");
  assert(doc.body.classList.contains("vault-overlay-open"), "edge: body class set on setup screen");
  const css = readFileSync(join(root, "src/css/main.css"), "utf8");
  assert(
    css.includes("body.vault-overlay-open #screenApiSetup"),
    "edge: CSS hides API setup while vault overlay is open",
  );
  const panelBody = doc.getElementById("knowledgeVaultPanelBody");
  const panelText = (panelBody?.textContent || "").toLowerCase();
  assert(!panelText.includes("api key"), "edge: vault content has no API key prompt on setup screen");
}

async function testCloseVaultRestoresBodyClass() {
  const { ui, vault, doc } = await bootVaultUi();
  ui.showScreen("modeSelect");

  const overlay = doc.getElementById("knowledgeVaultOverlay");
  const trigger = doc.getElementById("knowledgeVaultLink");
  const panel = doc.getElementById("knowledgeVaultPanel");
  const closeBtn = doc.getElementById("knowledgeVaultCloseBtn");

  vault.wireVaultDebugUi(panel, trigger, overlay, closeBtn, null);
  trigger?.click();
  closeBtn?.click();

  assert(overlay?.hidden === true, "failure: overlay closes on Close");
  assert(!doc.body.classList.contains("vault-overlay-open"), "failure: body class cleared on close");
}

await testOpenVaultDoesNotShowApiSetup();
await testOpenVaultFromSetupHidesApiFormBehindOverlay();
await testCloseVaultRestoresBodyClass();

console.log(`\nVault overlay no API key: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
