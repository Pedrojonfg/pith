import { LS_ACTIVE_SESSION_KEY, LS_SESSIONS_BY_MODE_KEY } from "./config.js?v=20260527_1";
import { getSourceFidelityStrictPreference } from "./config/flags.js";
import { detectAndMigrateV1 } from "./session-migration.js?v=20260609_1";
import { migrateStorageKeysFromMyLearning } from "./storage-rebrand-migration.js?v=20260619_5";
import {
  initGuideChat,
  sendGuideMessage,
} from "./guide-chat.js?v=20260526_1";
import {
  getStoredKey,
  migrateLegacyActiveSession,
  saveGeminiKey,
  getStoredGeminiKey,
  state,
} from "./session.js?v=20260611_2";
import { getGoogleBooksApiKey, saveGoogleBooksApiKey } from "./book-lookup.js";
import {
  closeSettingsScreen,
  closeBlockReadSidebar,
  initLanguageUi,
  initMnemonicSettingsUi,
  initSourceFidelityStrictUi,
  els,
  openSettingsScreen,
  showScreen,
  toggleBlockReadSidebar,
  toggleSidebar,
} from "./ui.js?v=20260618_1";
import { wireReviewHandlers } from "./review.js?v=20260525_1";
import { enterAppHome, openVaultGraphScreen, wireStudyHandlers, syncVaultUploadResumeBanner } from "./study.js?v=20260618_1";
import { wireVaultDebugUi } from "./vault/debug-ui.js";
import {
  readStashedInstallPrompt,
  showInstallHelpToast,
} from "./pwa-install.js";
import { dismissSplash } from "./splash.js?v=20260619_1";
import {
  getSupabaseAuthSession,
  migrateLocalStorageToSupabase,
  signInWithGoogle,
  signOut,
} from "./auth.js";
import { supabase } from "./supabase-client.js";

let appBooted = false;

async function openInitialScreen() {
  try {
    if (getStoredKey()) {
      await syncVaultUploadResumeBanner();
      await enterAppHome();
    } else {
      showScreen("settings");
    }
  } catch (err) {
    console.error("Failed to open initial screen:", err);
    showScreen("settings");
  }
}

async function continueAppBoot() {
  if (appBooted) return;
  appBooted = true;
  await migrateLocalStorageToSupabase();

  const hasStoredSession = !!localStorage.getItem(LS_SESSIONS_BY_MODE_KEY)?.trim() ||
    !!localStorage.getItem(LS_ACTIVE_SESSION_KEY)?.trim();
  if (hasStoredSession) {
    await migrateLegacyActiveSession();
  }

  await openInitialScreen();
  dismissSplash(false);
}

function wireAuthUi() {
  els.btnSignInGoogle?.addEventListener("click", async () => {
    if (els.authStatus) {
      els.authStatus.hidden = false;
      els.authStatus.textContent = "Redirecting to Google…";
    }
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("[auth] sign-in failed", err);
      if (els.authStatus) {
        els.authStatus.textContent = "Sign-in failed. Try again.";
      }
    }
  });

  els.btnSignOut?.addEventListener("click", async () => {
    try {
      await signOut();
      appBooted = false;
      showScreen("auth");
    } catch (err) {
      console.error("[auth] sign-out failed", err);
    }
  });

  supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
      await continueAppBoot();
    }
    if (event === "SIGNED_OUT") {
      appBooted = false;
      showScreen("auth");
    }
  });
}

async function bootstrap() {
  migrateStorageKeysFromMyLearning();
  await detectAndMigrateV1();
  if (window.offlineMode !== true) window.offlineMode = false;
  if (!("offlinePack" in window)) window.offlinePack = null;
  initLanguageUi();
  state.sourceFidelityStrict = getSourceFidelityStrictPreference();
  initSourceFidelityStrictUi();
  initMnemonicSettingsUi();
  wireStudyHandlers();
  wireReviewHandlers();
  wireAuthUi();
  wireVaultDebugUi(
    els.knowledgeVaultPanel,
    els.knowledgeVaultLink,
    els.knowledgeVaultOverlay,
    els.knowledgeVaultCloseBtn,
    () => openVaultGraphScreen(),
  );
  initGuideChat();

  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
  const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
  const sidebar = document.getElementById("guide-sidebar");

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", toggleSidebar);
  }

  const installPwaBtn = document.getElementById("installPwaBtn");
  let installPromptEvent = readStashedInstallPrompt(window);
  let installPromptUsed = false;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const syncInstallButton = () => {
    if (!installPwaBtn || isStandalone) return;
    if (installPromptEvent && !installPromptUsed) {
      installPwaBtn.hidden = false;
      installPwaBtn.textContent = "Install app";
      return;
    }
    installPwaBtn.hidden = false;
    installPwaBtn.textContent = "Install app";
  };

  const showInstallFallbackIfNeeded = () => {
    if (!installPwaBtn) return;
    if (isStandalone) {
      installPwaBtn.hidden = true;
      return;
    }
    syncInstallButton();
  };

  if (installPwaBtn) installPwaBtn.hidden = isStandalone;
  if (installPromptEvent) syncInstallButton();

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPromptEvent = e;
    installPromptUsed = false;
    syncInstallButton();
    console.log("PWA install prompt available.");
  });
  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    installPromptUsed = false;
    if (installPwaBtn) installPwaBtn.hidden = true;
    console.log("PWA installed.");
  });
  if (installPwaBtn) {
    installPwaBtn.addEventListener("click", async () => {
      if (!installPromptEvent || installPromptUsed) {
        showInstallHelpToast(document, window);
        return;
      }
      try {
        await installPromptEvent.prompt();
        installPromptUsed = true;
        const { outcome } = await installPromptEvent.userChoice;
        installPromptEvent = null;
        if (outcome === "dismissed") {
          showInstallHelpToast(document, window);
        }
      } catch {
        installPromptEvent = null;
        installPromptUsed = false;
        showInstallHelpToast(document, window);
      }
    });
  }
  setTimeout(showInstallFallbackIfNeeded, 3000);

  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener("click", () => {
      sidebar.classList.add("collapsed");
    });
  }

  const blockReadToggleBtn = document.getElementById("block-read-toggle-btn");
  const blockReadCloseBtn = document.getElementById("block-read-close-btn");
  if (blockReadToggleBtn) {
    blockReadToggleBtn.addEventListener("click", toggleBlockReadSidebar);
  }
  if (blockReadCloseBtn) {
    blockReadCloseBtn.addEventListener("click", closeBlockReadSidebar);
  }

  const guideSendBtn = document.getElementById("guide-send-btn");
  const guideInput = document.getElementById("guide-input");
  const sendGuide = () => {
    sendGuideMessage(String(guideInput?.value || ""), state.activeBlockIndex);
  };
  if (guideSendBtn) {
    guideSendBtn.addEventListener("click", sendGuide);
  }
  if (guideInput) {
    guideInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        sendGuide();
      }
    });
  }

  els.settingsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openSettingsScreen();
  });

  els.settingsBackBtn?.addEventListener("click", () => {
    closeSettingsScreen();
  });

  els.apiKeyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = els.apiKeyInput.value || "";
    const trimmed = raw.trim();
    if (!trimmed) {
      els.apiKeyStatus.textContent = "Please enter a DeepSeek key.";
      return;
    }
    localStorage.setItem("ds_api_key", trimmed);
    const geminiRaw = String(els.geminiApiKeyInput?.value || "").trim();
    if (geminiRaw) saveGeminiKey(geminiRaw);
    const googleBooksRaw = String(els.googleBooksApiKeyInput?.value || "").trim();
    saveGoogleBooksApiKey(googleBooksRaw);
    els.apiKeyStatus.textContent = geminiRaw
      ? "DeepSeek and Gemini (embeddings) saved."
      : googleBooksRaw
        ? "DeepSeek and Google Books saved."
        : "DeepSeek saved.";
    await enterAppHome();
  });

  if (els.geminiApiKeyInput) {
    const gk = getStoredGeminiKey();
    if (gk) els.geminiApiKeyInput.value = gk;
  }
  if (els.googleBooksApiKeyInput) {
    const gbk = getGoogleBooksApiKey();
    if (gbk) els.googleBooksApiKeyInput.value = gbk;
  }

  const authSession = await getSupabaseAuthSession();
  if (!authSession) {
    showScreen("auth");
    dismissSplash(false);
    return;
  }

  await continueAppBoot();
}

bootstrap();

