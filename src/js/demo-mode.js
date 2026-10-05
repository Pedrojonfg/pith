/**
 * No-login demo: pre-prepared document, no LLM spend.
 * Open with ?demo=1 or #demo
 */

import { createSession, saveActiveSession, setActiveSession } from "./session-store.js";
import { computeCanonicalId } from "./session-types.js";

export const DEMO_DOC_ID = "pith-demo-gettysburg";

export function isDemoMode() {
  try {
    if (typeof location === "undefined") return false;
    const q = new URLSearchParams(location.search);
    if (q.get("demo") === "1") return true;
    return location.hash === "#demo";
  } catch {
    return false;
  }
}

export function isDemoModeActive() {
  return globalThis.__PITH_DEMO === true;
}

function demoConcepts() {
  const items = [
    { label: "National founding", definition: "The nation conceived in liberty at America's birth." },
    { label: "Civil war test", definition: "Whether a nation dedicated to equality can endure." },
    { label: "Unfinished work", definition: "The living must advance the cause the dead fought for." },
  ];
  return items.map((c) => ({
    id: computeCanonicalId(c.label),
    label: c.label,
    definition: c.definition,
    scope_one_line: c.definition,
  }));
}

/**
 * @returns {Promise<void>}
 */
export async function bootDemoSession() {
  globalThis.__PITH_DEMO = true;
  const res = await fetch(new URL("../demo/demo-document.md", import.meta.url));
  const markdown = await res.text();
  const session = await createSession(markdown, { docId: DEMO_DOC_ID });
  const now = Date.now();
  session.shared.preparation = {
    status: "ready",
    fingerprint: "demo",
    startedAt: now - 60_000,
    completedAt: now,
    currentPhase: null,
    currentWave: 0,
    waves: [],
    phaseResults: {},
    errors: [],
  };
  session.shared.conceptInventory = demoConcepts();
  session.shared.blockRecommendation = {
    nBlocks: 2,
    reasoning: "Demo document — two short rhetorical sections.",
    confidence: 1,
  };
  session.shared.modeRecommendation = {
    recommendedMode: "read",
    steps: [{ mode: "read", timeMin: 5 }],
    reasoning: "Short historical prose suits read mode in the demo.",
  };
  session.shared.docHierarchy = {
    roots: [{ id: "h1", title: "The Gettysburg Address (demo)", level: 1, children: [] }],
  };
  session.shared.uploadMeta = {
    fileName: "demo-document.md",
    originalFormat: "md",
    uploadedAt: new Date(now).toISOString(),
  };
  session.updatedAt = now;
  await saveActiveSession(session);
  await setActiveSession(DEMO_DOC_ID);
}

export function ensureDemoBanner() {
  if (!isDemoModeActive()) return;
  let el = document.getElementById("demoModeBanner");
  if (el) return;
  el = document.createElement("div");
  el.id = "demoModeBanner";
  el.className = "demo-mode-banner";
  el.setAttribute("role", "status");
  el.textContent =
    "Demo — sample document, no account. AI features are off; sign in to use your own material.";
  document.body.prepend(el);
}
