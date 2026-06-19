import { LS_ACTIVE_SESSION_KEY, LS_BLOCK_INDEX_KEY, LS_SESSIONS_BY_MODE_KEY } from "./config.js?v=20260527_1";
import { getSourceFidelityStrictPreference } from "./config/flags.js";
import { detectAndMigrateV1 } from "./session-migration.js?v=20260609_1";
import { migrateStorageKeysFromMyLearning } from "./storage-rebrand-migration.js?v=20260619_5";
import {
  clearSessionConceptStorage,
  updateDictionaryButtonVisibility,
} from "./dictionary.js?v=20260526_1";
import { exportSessionMarkdown } from "./export.js?v=20260525_1";
import { cancelRsvpTimer, setRsvpOverlayActive } from "./rsvp.js?v=20260526_2";
import { finishPacedRead } from "./paced-reader.js?v=20260610_1";
import {
  clearGuideChatStorage,
  initGuideChat,
  sendGuideMessage,
} from "./guide-chat.js?v=20260526_1";
import {
  getStoredKey,
  loadActiveSession,
  migrateLegacyActiveSession,
  saveGeminiKey,
  getStoredGeminiKey,
  state,
} from "./session.js?v=20260611_2";
import {
  closeSettingsScreen,
  closeBlockReadSidebar,
  initLanguageUi,
  initLlmModelUi,
  initSourceFidelityStrictUi,
  els,
  openSettingsScreen,
  showScreen,
  toggleBlockReadSidebar,
  toggleSidebar,
} from "./ui.js?v=20260618_1";
import { wireReviewHandlers } from "./review.js?v=20260525_1";
import { clearActiveDocumentPointer } from "./session-store.js?v=20260609_1";
import { enterCreateSessionStartScreen, enterModeSelectScreen, enterAppHome, openVaultGraphScreen, wireStudyHandlers, syncVaultUploadResumeBanner } from "./study.js?v=20260618_1";
import { wireVaultDebugUi } from "./vault/debug-ui.js";
import {
  readStashedInstallPrompt,
  showInstallHelpToast,
} from "./pwa-install.js";
import { dismissSplash } from "./splash.js?v=20260619_1";

function clearActiveSessionStorage() {
  try {
    localStorage.removeItem(LS_ACTIVE_SESSION_KEY);
    localStorage.removeItem(LS_SESSIONS_BY_MODE_KEY);
  } catch {
    // ignore
  }
  clearActiveDocumentPointer();
}

function clearBlockIndexStorage() {
  try {
    localStorage.removeItem(LS_BLOCK_INDEX_KEY);
  } catch {
    // ignore
  }
}

function resetToNewSession() {
  cancelRsvpTimer();
  setRsvpOverlayActive(false);
  finishPacedRead({ skipCallback: true });
  window.offlineMode = false;
  window.offlinePack = null;

  state.studyMode = null;
  state.originalMaterialText = "";
  state.lastNBlocks = 0;
  state.lastBlockIndex = null;
  state.activeSession = null;
  state.activeBlockIndex = 0;
  state.activeQuestionIndex = 0;
  state.includeConnectionQuestions = true;

  if (els.fileInput) els.fileInput.value = "";
  if (els.blocksFilterInput) els.blocksFilterInput.value = "";
  if (els.blocksListEditor) els.blocksListEditor.innerHTML = "";
  if (els.generateBlocksError) {
    els.generateBlocksError.hidden = true;
    els.generateBlocksError.textContent = "";
  }
  if (els.confirmBlocksError) {
    els.confirmBlocksError.hidden = true;
    els.confirmBlocksError.textContent = "";
  }

  clearActiveSessionStorage();
  clearBlockIndexStorage();
  clearSessionConceptStorage();
  clearGuideChatStorage({ removeAllStored: true });
  if (getStoredKey()) enterAppHome();
  else showScreen("settings");
  updateDictionaryButtonVisibility();
}

function startNewSessionFlow() {
  const stored = loadActiveSession();
  if (stored && typeof stored === "object") {
    state.activeSession = stored;
  }
  if (state.activeSession) {
    try {
      exportSessionMarkdown();
    } catch {
      // ignore export errors; still reset
    }
  }
  resetToNewSession();
  if (getStoredKey()) {
    enterCreateSessionStartScreen();
  }
}

async function bootstrap() {
  migrateStorageKeysFromMyLearning();
  await detectAndMigrateV1();
  migrateLegacyActiveSession();
  if (window.offlineMode !== true) window.offlineMode = false;
  if (!("offlinePack" in window)) window.offlinePack = null;
  initLanguageUi();
  initLlmModelUi();
  state.sourceFidelityStrict = getSourceFidelityStrictPreference();
  initSourceFidelityStrictUi();
  wireStudyHandlers();
  wireReviewHandlers();
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

  els.newSessionBtn.addEventListener("click", () => {
    startNewSessionFlow();
  });

  els.apiKeyForm.addEventListener("submit", (e) => {
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
    els.apiKeyStatus.textContent = geminiRaw ? "DeepSeek and Gemini saved." : "DeepSeek saved.";
    enterAppHome();
  });

  if (els.geminiApiKeyInput) {
    const gk = getStoredGeminiKey();
    if (gk) els.geminiApiKeyInput.value = gk;
  }

  const hasStoredSession = !!localStorage.getItem(LS_SESSIONS_BY_MODE_KEY)?.trim() ||
    !!localStorage.getItem(LS_ACTIVE_SESSION_KEY)?.trim();
  if (hasStoredSession) {
    migrateLegacyActiveSession();
  }

  try {
    if (getStoredKey()) {
      syncVaultUploadResumeBanner();
      enterAppHome();
    } else {
      showScreen("settings");
    }
  } catch (err) {
    console.error("Failed to open initial screen:", err);
    showScreen("settings");
  } finally {
    dismissSplash(false);
  }
}

bootstrap();

