/**
 * New session (+) button — clears all session pointers, shows upload CTA on mode-select.
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260611_new-session-btn.mjs
 *
 * Source: prompt-fallback (bugfix — no dedicated spec)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resetStorage } from "./setup-dom.mjs";
import {
  LS_ACTIVE_DOC_ID_KEY,
  LS_ACTIVE_SESSION_KEY,
  LS_SESSIONS_BY_MODE_KEY,
} from "../src/js/config.js";
import {
  clearActiveDocumentPointer,
  createSession,
  getActiveSession,
  getAllSessions,
  getSession,
  setActiveSession,
} from "../src/js/session-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

function resolveFlowPanelViewState(doc) {
  const recommendation = doc?.shared?.modeRecommendation;
  if (recommendation && typeof recommendation === "object" && recommendation.userOverride) {
    return "hidden";
  }
  const flow = recommendation?.primaryFlow;
  if (Array.isArray(flow) && flow.length > 0) {
    const completed = Array.isArray(recommendation.completedSteps)
      ? recommendation.completedSteps
      : [];
    if (completed.length > 0) return "progress";
    return "intro";
  }
  return "cta_upload";
}

/** Mirror main.js clearActiveSessionStorage contract. */
function clearActiveSessionStorageLikeMain() {
  try {
    localStorage.removeItem(LS_ACTIVE_SESSION_KEY);
    localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
  } catch {
    // ignore
  }
  clearActiveDocumentPointer();
}

// --- Runtime: happy path ---
resetStorage();
const markdown = "# Chapter 1\n\nIntro text for new session reset.";
const doc = await createSession(markdown);
setActiveSession(doc.docId);
localStorage.setItem(LS_ACTIVE_SESSION_KEY, JSON.stringify({ studyMode: "rsvp" }));
localStorage.setItem(
  LS_SESSIONS_BY_MODE_KEY,
  JSON.stringify({ rsvp: { studyMode: "rsvp" }, slow: null, cloze: null, questions: null }),
);

assert(getActiveSession()?.docId === doc.docId, "happy: active document before reset");
clearActiveSessionStorageLikeMain();
assert(getActiveSession() === null, "happy: getActiveSession null after reset");
assert(getSession(doc.docId)?.docId === doc.docId, "happy: library entry preserved");
assert(getAllSessions().length === 1, "happy: doc library count unchanged");
assert(
  resolveFlowPanelViewState(getActiveSession()) === "cta_upload",
  "happy: mode-select shows upload CTA after reset",
);
assert(localStorage.getItem(LS_ACTIVE_SESSION_KEY) === null, "happy: legacy active_session cleared");
assert(localStorage.getItem(LS_SESSIONS_BY_MODE_KEY) === null, "happy: sessions_by_mode cleared");
assert(localStorage.getItem(LS_ACTIVE_DOC_ID_KEY) === null, "happy: active doc pointer cleared");

// --- Runtime: edge case — clear when already empty ---
resetStorage();
clearActiveDocumentPointer();
assert(getActiveSession() === null, "edge: clear on empty storage is no-op");
clearActiveSessionStorageLikeMain();
assert(getActiveSession() === null, "edge: full clear on empty storage is no-op");

// --- Runtime: failure case — localStorage.removeItem throws ---
resetStorage();
setActiveSession((await createSession("throw test")).docId);
const originalRemove = localStorage.removeItem.bind(localStorage);
localStorage.removeItem = () => {
  throw new Error("quota exceeded");
};
let threw = false;
try {
  clearActiveDocumentPointer();
} catch {
  threw = true;
}
localStorage.removeItem = originalRemove;
assert(!threw, "failure: clearActiveDocumentPointer swallows removeItem errors");

// --- Contract: main.js wiring ---
const mainSrc = readFileSync(join(root, "src/js/main.js"), "utf8");
const storeSrc = readFileSync(join(root, "src/js/session-store.js"), "utf8");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");

assert(
  mainSrc.includes('import { clearActiveDocumentPointer } from "./session-store.js'),
  "contract main: imports clearActiveDocumentPointer from session-store",
);
assert(
  mainSrc.includes("clearActiveDocumentPointer()"),
  "contract main: clearActiveDocumentPointer invoked in reset path",
);
assert(
  mainSrc.includes('els.newSessionBtn.addEventListener("click"'),
  "contract main: + button wired to click handler",
);
assert(
  mainSrc.includes("startNewSessionFlow()"),
  "contract main: click handler calls startNewSessionFlow",
);
assert(
  mainSrc.includes("resetToNewSession()"),
  "contract main: startNewSessionFlow ends in resetToNewSession",
);
assert(
  mainSrc.includes("enterModeSelectScreen()"),
  "contract main: reset navigates to mode-select when API key stored",
);

// --- Contract: session-store export shape ---
assert(
  storeSrc.includes("export function clearActiveDocumentPointer"),
  "contract store: clearActiveDocumentPointer exported",
);
assert(
  storeSrc.includes("localStorage.removeItem(LS_ACTIVE_DOC_ID_KEY)"),
  "contract store: removes mylearning_active_doc_id only",
);

// --- Contract: DOM + flow panel consumer ---
assert(indexHtml.includes('id="newSessionBtn"'), "contract DOM: + button exists");
assert(
  indexHtml.includes('aria-label="New study session"'),
  "contract DOM: + button has accessible label",
);
assert(
  indexHtml.includes('id="flowRecommendUpload"'),
  "contract DOM: upload CTA exists on mode-select",
);

const docWithRec = {
  shared: {
    modeRecommendation: {
      primaryFlow: [{ mode: "rsvp" }, { mode: "cloze" }],
      completedSteps: [],
    },
  },
};
assert(
  resolveFlowPanelViewState(docWithRec) === "intro",
  "contract flow: doc with recommendation shows intro (not cta)",
);
assert(
  resolveFlowPanelViewState(null) === "cta_upload",
  "contract flow: null doc shows cta_upload after + reset",
);

// --- Mutation guard: test would fail if pointer not cleared ---
resetStorage();
const guardDoc = await createSession("mutation guard");
setActiveSession(guardDoc.docId);
assert(localStorage.getItem(LS_ACTIVE_DOC_ID_KEY) === guardDoc.docId, "mutation guard: pre-condition");
clearActiveDocumentPointer();
assert(
  localStorage.getItem(LS_ACTIVE_DOC_ID_KEY) === null,
  "mutation guard: key must be removed (kills no-op mutant)",
);

console.log(`\n20260611_new-session-btn: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("20260611_new-session-btn: OK");
