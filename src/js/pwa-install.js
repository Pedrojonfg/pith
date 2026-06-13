/** PWA install prompt capture and fallback UX when beforeinstallprompt is unavailable. */

export function getInstallHelpMessage(nav = globalThis.navigator) {
  const ua = nav?.userAgent || "";
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (nav?.platform === "MacIntel" && nav?.maxTouchPoints > 1);
  if (isIos) {
    return "Tap Share, then Add to Home Screen to install Pith.";
  }
  if (/Edg\//.test(ua)) {
    return "Open the browser menu (⋯) and choose Apps → Install this site as an app.";
  }
  const isOpera = /OPR\//.test(ua);
  const isMobile = /Android|Mobile/i.test(ua);
  if (isOpera && !isMobile) {
    return "Opera on desktop cannot install PWAs. Open this page in Chrome or Edge and click Install (⊕ in the address bar) or the browser menu → Install app.";
  }
  if (isOpera && isMobile) {
    return "Tap the Opera menu (≡), then Add to Home screen to install Pith.";
  }
  if (/Firefox\//.test(ua)) {
    return "Firefox has limited PWA support. Use Chrome or Edge, or bookmark this page.";
  }
  return "Open the browser menu (⋮) and choose Install app or Install Pith.";
}

export function showInstallHelpToast(document, window, message = getInstallHelpMessage()) {
  const existing = document.getElementById("pwa-install-help-toast");
  if (existing) {
    existing.querySelector("[data-pwa-install-help-text]")?.replaceChildren(
      document.createTextNode(message),
    );
    return existing;
  }

  const toast = document.createElement("div");
  toast.id = "pwa-install-help-toast";
  toast.setAttribute("role", "status");
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "16px";
  toast.style.transform = "translateX(-50%)";
  toast.style.zIndex = "4000";
  toast.style.display = "flex";
  toast.style.gap = "8px";
  toast.style.alignItems = "center";
  toast.style.maxWidth = "min(420px, calc(100vw - 24px))";
  toast.style.padding = "10px 12px";
  toast.style.borderRadius = "12px";
  toast.style.border = "1px solid rgba(255,255,255,0.2)";
  toast.style.background = "rgba(15,15,15,0.95)";
  toast.style.backdropFilter = "blur(8px)";
  toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";

  const label = document.createElement("span");
  label.dataset.pwaInstallHelpText = "true";
  label.textContent = message;
  label.style.fontSize = "13px";
  label.style.lineHeight = "1.4";
  toast.appendChild(label);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "OK";
  closeBtn.style.padding = "8px 10px";
  closeBtn.style.flexShrink = "0";
  closeBtn.addEventListener("click", () => toast.remove());

  toast.appendChild(closeBtn);
  document.body.appendChild(toast);

  window.setTimeout(() => {
    if (toast.isConnected) toast.remove();
  }, 12000);

  return toast;
}

export function readStashedInstallPrompt(window) {
  const stashed = window?.__pithDeferredInstallPrompt;
  if (!stashed) return null;
  window.__pithDeferredInstallPrompt = null;
  return stashed;
}
