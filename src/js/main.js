import { LS_ACTIVE_SESSION_KEY, LS_BLOCK_INDEX_KEY } from "./config.js?v=20260525_1";
import {
  clearSessionConceptStorage,
  updateDictionaryButtonVisibility,
} from "./dictionary.js?v=20260526_1";
import { exportSessionMarkdown } from "./export.js?v=20260525_1";
import { cancelRsvpTimer, setRsvpOverlayActive } from "./rsvp.js?v=20260526_2";
import { initGuideChat, sendGuideMessage } from "./guide-chat.js?v=20260525_1";
import { getStoredKey, loadActiveSession, saveGeminiKey, getStoredGeminiKey, state } from "./session.js?v=20260527_1";
import { initLanguageUi, els, showScreen, toggleSidebar } from "./ui.js?v=20260525_1";
import { wireReviewHandlers } from "./review.js?v=20260525_1";
import { wireStudyHandlers } from "./study.js?v=20260527_1";

export const isOfflineMode = () => window.offlineMode === true;

function clearActiveSessionStorage() {
  try {
    localStorage.removeItem(LS_ACTIVE_SESSION_KEY);
  } catch {
    // ignore
  }
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
  if (els.connectionQuestionsToggleBtn) {
    els.connectionQuestionsToggleBtn.setAttribute("aria-pressed", "true");
    if (els.connectionQuestionsToggleSubtitle) els.connectionQuestionsToggleSubtitle.hidden = true;
  }

  if (els.fileInput) els.fileInput.value = "";
  if (els.blocksFilterInput) els.blocksFilterInput.value = "";
  if (els.blocksListEditor) els.blocksListEditor.innerHTML = "";
  if (els.blocksListOutput) els.blocksListOutput.value = "";
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
  showScreen(getStoredKey() ? "create" : "setup");
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
}

function bootstrap() {
  if (window.offlineMode !== true) window.offlineMode = false;
  if (!("offlinePack" in window)) window.offlinePack = null;
  initLanguageUi();
  wireStudyHandlers();
  wireReviewHandlers();
  initGuideChat();

  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");
  const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
  const sidebar = document.getElementById("guide-sidebar");

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener("click", toggleSidebar);
  }

  const installPwaBtn = document.getElementById("installPwaBtn");
  let installPromptEvent = null;
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  const showInstallFallbackIfNeeded = () => {
    if (!installPwaBtn) return;
    if (isStandalone) {
      installPwaBtn.hidden = true;
      return;
    }
    if (!installPromptEvent) {
      installPwaBtn.hidden = false;
      installPwaBtn.textContent = "Instalar app (menu del navegador)";
    }
  };

  if (installPwaBtn) installPwaBtn.hidden = isStandalone;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPromptEvent = e;
    if (installPwaBtn) {
      installPwaBtn.hidden = false;
      installPwaBtn.textContent = "Instalar app";
    }
    console.log("PWA install prompt available.");
  });
  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    if (installPwaBtn) installPwaBtn.hidden = true;
    console.log("PWA installed.");
  });
  if (installPwaBtn) {
    installPwaBtn.addEventListener("click", async () => {
      if (!installPromptEvent) {
        console.info(
          "Install prompt not available yet. In Chrome open menu > Install app or Add to Home screen.",
        );
        return;
      }
      installPromptEvent.prompt();
      try {
        await installPromptEvent.userChoice;
      } catch {
        // ignore
      }
    });
  }
  setTimeout(showInstallFallbackIfNeeded, 3000);

  if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener("click", () => {
      sidebar.classList.add("collapsed");
    });
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

  els.changeKeyLink.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen("setup");
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
    showScreen("create");
  });

  if (els.geminiApiKeyInput) {
    const gk = getStoredGeminiKey();
    if (gk) els.geminiApiKeyInput.value = gk;
  }

  const hasStoredSession = !!localStorage.getItem(LS_ACTIVE_SESSION_KEY)?.trim();
  if (hasStoredSession) {
    state.activeSession = loadActiveSession();
    if (state.activeSession) {
      const n = Math.max(1, Number(state.activeSession?.n_blocks) || 1);
      els.sessionReadyMeta.textContent = `Session ready. Blocks: ${n}`;
      showScreen("ready");
    } else if (getStoredKey()) {
      showScreen("create");
    } else {
      showScreen("setup");
    }
  } else if (getStoredKey()) {
    showScreen("create");
  } else {
    showScreen("setup");
  }
}

bootstrap();

