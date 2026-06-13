/** Brief boot splash — brand veil during cold start; skips on repeat session visits. */

export const SPLASH_SESSION_KEY = "pith_splash_seen";
export const SPLASH_MIN_MS = 350;
export const SPLASH_MAX_MS = 900;

let shownAt = 0;
let dismissTimer = null;
let maxTimer = null;

/**
 * @param {{ sessionStorage?: Storage | null, matchMedia?: (q: string) => MediaQueryList }} env
 */
export function shouldShowSplash(env = {}) {
  const storage = env.sessionStorage ?? globalThis.sessionStorage;
  const mql = env.matchMedia ?? globalThis.matchMedia?.bind(globalThis);
  try {
    if (storage?.getItem(SPLASH_SESSION_KEY) === "1") return false;
  } catch {
    // ignore
  }
  try {
    if (mql?.("(prefers-reduced-motion: reduce)")?.matches) return false;
  } catch {
    // ignore
  }
  return true;
}

function finishDismiss(el) {
  if (maxTimer) {
    clearTimeout(maxTimer);
    maxTimer = null;
  }
  if (dismissTimer) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  el.classList.add("app-splash--out");
  const remove = () => el.remove();
  el.addEventListener("transitionend", remove, { once: true });
  setTimeout(remove, 450);
  try {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * @param {boolean} [immediate]
 */
export function dismissSplash(immediate = false) {
  const el = document.getElementById("app-splash");
  if (!el || el.classList.contains("app-splash--out")) return;

  if (immediate) {
    finishDismiss(el);
    return;
  }

  const elapsed = shownAt > 0 ? Date.now() - shownAt : SPLASH_MIN_MS;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => finishDismiss(el), remaining);
}

export function initSplash() {
  const el = document.getElementById("app-splash");
  if (!el) return;

  if (!shouldShowSplash()) {
    el.remove();
    return;
  }

  shownAt = Date.now();
  el.hidden = false;
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "presentation");
  el.setAttribute("aria-label", "Pith");

  const skip = () => dismissSplash(true);
  el.addEventListener("click", skip);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      skip();
    }
  });

  maxTimer = setTimeout(() => dismissSplash(false), SPLASH_MAX_MS);
}
