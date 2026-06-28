/** PWA service worker update UX — detect new versions and let users refresh safely. */

export const SW_VERSION = "20260705_05";

export function getServiceWorkerUrl() {
  return `/sw.js?v=${SW_VERSION}`;
}

/** True when a new worker finished installing while an older one still controls the page. */
export function shouldNotifyUpdate(workerState, hasController) {
  return workerState === "installed" && hasController === true;
}

/** First install should activate immediately; updates should wait for user action. */
export function shouldSkipWaitingOnInstall(hasActiveWorker) {
  return hasActiveWorker !== true;
}

export function showUpdateToast(document, window, registration) {
  if (document.getElementById("sw-update-toast")) return null;

  const toast = document.createElement("div");
  toast.id = "sw-update-toast";
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "16px";
  toast.style.transform = "translateX(-50%)";
  toast.style.zIndex = "4000";
  toast.style.display = "flex";
  toast.style.gap = "8px";
  toast.style.alignItems = "center";
  toast.style.padding = "10px 12px";
  toast.style.borderRadius = "4px";
  toast.style.border = "1px solid rgba(255,255,255,0.1)";
  toast.style.background = "#181c24";

  const label = document.createElement("span");
  label.textContent = "A new version is available.";
  toast.appendChild(label);

  const updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.textContent = "Update now";
  updateBtn.style.padding = "8px 10px";
  updateBtn.addEventListener("click", () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
    window.location.reload();
  });

  toast.appendChild(updateBtn);
  document.body.appendChild(toast);
  return toast;
}

const UPDATE_POLL_MS = 5 * 60 * 1000;

export async function initServiceWorkerUpdate({
  navigator: nav = globalThis.navigator,
  window: win = globalThis.window,
  document: doc = globalThis.document,
  pollIntervalMs = UPDATE_POLL_MS,
} = {}) {
  if (!nav?.serviceWorker) {
    return { registered: false, reason: "unsupported" };
  }

  const reloadFromUpdate = () => {
    win.location.reload();
  };

  const notifyIfWaiting = (registration) => {
    if (registration.waiting) {
      showUpdateToast(doc, win, registration);
    }
  };

  try {
    const registration = await nav.serviceWorker.register(getServiceWorkerUrl(), {
      scope: "/",
      updateViaCache: "none",
    });

    notifyIfWaiting(registration);

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (shouldNotifyUpdate(installingWorker.state, Boolean(nav.serviceWorker.controller))) {
          showUpdateToast(doc, win, registration);
        }
      });
    });

    nav.serviceWorker.addEventListener("controllerchange", () => {
      if (!win.__swRefreshing) {
        win.__swRefreshing = true;
        reloadFromUpdate();
      }
    });

    const checkForUpdate = () => registration.update().catch(() => undefined);
    win.setTimeout(checkForUpdate, 1500);
    const pollId = win.setInterval(checkForUpdate, pollIntervalMs);

    const onVisible = () => {
      if (doc.visibilityState === "visible") checkForUpdate();
    };
    if (typeof doc.addEventListener === "function") {
      doc.addEventListener("visibilitychange", onVisible);
    }

    return {
      registered: true,
      registration,
      stopPolling: () => {
        win.clearInterval(pollId);
        doc.removeEventListener?.("visibilitychange", onVisible);
      },
    };
  } catch (error) {
    console.error("SW failed:", error);
    return { registered: false, reason: "register-failed", error };
  }
}
