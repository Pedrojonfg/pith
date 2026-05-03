import { LS_ACTIVE_SESSION_KEY, LS_BLOCK_INDEX_KEY } from "./config.js?v=20260503_3";
import { updateDictionaryButtonVisibility } from "./dictionary.js?v=20260503_3";
import { exportSessionMarkdown } from "./export.js?v=20260503_3";
import { cancelRsvpTimer, setRsvpOverlayActive } from "./rsvp.js?v=20260503_3";
import { initGuideChat, sendGuideMessage } from "./guide-chat.js?v=20260503_3";
import { getStoredKey, loadActiveSession, state } from "./session.js?v=20260503_3";
import { initLanguageUi, els, showScreen, toggleSidebar } from "./ui.js?v=20260503_3";
import { wireReviewHandlers } from "./review.js?v=20260503_3";
import { wireStudyHandlers } from "./study.js?v=20260503_6";

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

  state.sessionMode = "test";
  state.studyMode = null;
  state.originalMaterialText = "";
  state.lastNBlocks = 0;
  state.lastBlockIndex = null;
  state.activeSession = null;
  state.activeBlockIndex = 0;
  state.activeQuestionIndex = 0;

  if (els.fileInput) els.fileInput.value = "";
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
      els.apiKeyStatus.textContent = "Please enter a key.";
      return;
    }
    localStorage.setItem("ds_api_key", trimmed);
    els.apiKeyStatus.textContent = "Saved.";
    showScreen("create");
  });

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

