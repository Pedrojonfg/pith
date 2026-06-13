/** Brief boot splash — brand veil during cold start; skips on repeat session visits. */

export const SPLASH_SESSION_KEY = "pith_splash_seen";
export const SPLASH_FADE_MS = 150;
export const SPLASH_GLOW_MS = 300;
export const SPLASH_CYCLE_MS = SPLASH_FADE_MS + SPLASH_GLOW_MS;
export const SPLASH_MAX_MS = 900;

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
  el.classList.remove("app-splash--active");
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

  finishDismiss(el);
}

export function initSplash() {
  const el = document.getElementById("app-splash");
  if (!el) return;

  if (!shouldShowSplash()) {
    el.remove();
    return;
  }

  el.hidden = false;
  el.classList.add("app-splash--active");
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
