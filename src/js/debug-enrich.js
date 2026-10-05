/** Instrumentation gated by ?debugEnrich=1 or localStorage pith_debug_enrich=true */

const LS_KEY = "pith_debug_enrich";

export function isDebugEnrich() {
  try {
    if (typeof location !== "undefined") {
      const q = new URLSearchParams(location.search);
      if (q.get("debugEnrich") === "1") return true;
    }
    return localStorage.getItem(LS_KEY) === "true";
  } catch {
    return false;
  }
}

export function deLog(...args) {
  if (isDebugEnrich()) console.debug(...args);
}

export function deInfo(...args) {
  if (isDebugEnrich()) console.info(...args);
}

export function deWarn(...args) {
  if (isDebugEnrich()) console.warn(...args);
}

export function deError(...args) {
  if (isDebugEnrich()) console.error(...args);
}
