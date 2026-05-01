import { LS_ACTIVE_SESSION_KEY, LS_BLOCK_INDEX_KEY } from "./config.js";
import { updateDictionaryButtonVisibility } from "./dictionary.js";
import { exportSessionMarkdown } from "./export.js";
import { cancelRsvpTimer, setRsvpOverlayActive } from "./rsvp.js";
import { getStoredKey, loadActiveSession, state } from "./session.js";
import { initLanguageUi, els, showScreen } from "./ui.js";
import { wireReviewHandlers } from "./review.js";
import { wireStudyHandlers } from "./study.js";

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

