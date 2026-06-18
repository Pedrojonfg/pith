# Spec: UI Dead Weight Removal & Screen Integrity
**Date:** 2026-06-18  
**Folder:** `specs/20260618-ui-dead-weight-removal/spec.md`  
**Supersedes:** Nothing. Additive constraint layer over all prior specs.  
**Status:** Implementation-ready.

---

## 0. Problem statement

The audit (2026-06-18) found 31 screens with the following systemic failures:

1. **Ghost references** — 14+ JS element IDs wired with event listeners that have no matching HTML element. Handlers silently fail on `?.` fallback or throw.
2. **Zombie elements** — HTML elements with no JS reference anywhere (e.g. `#screenBetweenBlocks`, `#loadOfflinePackBtn`, `#offlinePackInput`).
3. **Broken buttons** — Elements that exist in HTML and appear to the user but have no handler (`#loadOfflinePackBtn`, `#betweenBlocksSkipBtn`, `#betweenBlocksSendBtn`, `#betweenBlocksInput`).
4. **Misleading Save buttons** — `#saveSessionBtn`, `#saveSessionInlineBtn`, and `#btnDownloadSessionMd` all export a `.md` file while session data is already auto-persisted to `session-store.js` throughout the study flow. The label "Save session" implies persistence that has already happened. Users cannot tell whether their data is safe.
5. **Redundant actions** — Multiple Upload entry points (3 separate file inputs for the same action), two Review buttons with different behaviors and no visible distinction, two persistence health banners on different screens.
6. **Config pollution** — API keys, language selector, and LLM model selector appear inline in study flow screens. These are set once and forgotten.
7. **Floating chrome** — `#btnDownloadSessionMd` floats over every screen regardless of context; `#newSessionBtn` (+) appears even mid-study; `#changeKeyLink` is always visible.
8. **Screen `screenBetweenBlocks`** — unreachable dead HTML with broken internal handlers.
9. **`screenFullPackGenerating`** — uses inline `style="max-width:760px; margin:0 auto"`, violating the design system.

---

## 1. Guiding rules (non-negotiable)

These rules govern every change in this spec and all future UI work.

**R1 — No handler, no element.** If an interactive element (`button`, `input`, `select`, `a`) has no wired event listener that does something observable, it must not exist in the HTML. Delete it.

**R2 — No element, no handler.** If JS wires a handler to an ID that does not exist in the HTML, delete the handler. Do not use `?.` to silently swallow the miss — that hides bugs.

**R3 — Save means save.** A button labeled "Save", "Save session", or any variant thereof must write data to the persistence layer. If the data is already auto-persisted, the button must not exist. File export is "Download" or "Export", never "Save".

**R4 — One upload entry point per screen.** A screen may have at most one file input for the same logical action. Duplicates across screens are acceptable only if each screen serves a distinct flow step. Three file inputs for "upload study material" on three different screens is not acceptable — consolidate to one canonical entry point.

**R5 — One action, one button.** If two buttons on the same screen navigate to the same destination or trigger the same handler, delete the redundant one. "Cancel" and "← Back" pointing to the same screen: keep the one matching the screen's navigation pattern and delete the other.

**R6 — Settings stay in Settings.** The following are Settings-only: API keys (DeepSeek, Gemini), global language preference, LLM model selector, and any other preference that applies across all sessions rather than to a specific document or study flow. Remove them from all study-flow screens.

**R7 — Global chrome is contextual.** `#newSessionBtn` (+), `#btnDownloadSessionMd`, `#changeKeyLink`, and the guide sidebar toggle must be hidden during active study (`body.study-active`, `body.slow-reader-active`, `body.recall-active`). `syncFloatingChrome()` in `ui.js` already partially implements this — complete it for all chrome elements. The `+` button must never be visible on any screen except `screenAppHome`, `screenDocLibrary`, and `screenModeSelect`.

**R8 — No orphan screens.** Every screen reachable from `index.html` must have at least one `showScreen(...)` call in the JS codebase. Screens with zero callers are deleted from the HTML.

**R9 — Compress, don't overflow.** No element may use `overflow: auto` or `overflow-y: scroll` inside a card that is itself inside the viewport. If content is long, the screen scrolls as a whole or content is collapsed/paginated. Exception: `screenDocLibrary` list (doc list may be arbitrarily long — full-page scroll is correct there).

**R10 — No inline style on screen containers.** `style="max-width:...; margin:..."` on a `<div class="screen">` or its immediate card child is forbidden. Use CSS classes from the design system.

---

## 2. Dead code to delete unconditionally

Delete all of the following. No replacement. No migration. No feature flag.

### 2a. Screen: `screenBetweenBlocks` (entire element)

Remove from `index.html`. It is unreachable (`showScreen("between")` is never called). Its internal elements (`#betweenBlocksDictionaryOpenBtn`, `#betweenBlocksDictList`, `#betweenBlocksInput`, `#betweenBlocksSkipBtn`, `#betweenBlocksSendBtn`) are all broken. Delete any residual references to `"between"` in `study.js`.

### 2b. Ghost reference handlers (delete from JS, do not add HTML)

These IDs are wired in JS but absent from HTML. Delete the wiring code. Do not create the HTML elements.

| ID | File | Action |
|----|------|--------|
| `dictionaryBtn` | `ui.js`, `dictionary.js`, `study.js` | Delete handler registration; remove from els object |
| `continueSessionBtn` | `study.js` | Delete `?.addEventListener` block |
| `newSessionModeBtn` | `study.js` | Delete `?.addEventListener` block |
| `modeResumePanel` | `study.js` | Delete all references |
| `llmModelSelect` | `ui.js`, `study.js` | Delete inline handler; model selection moves to Settings screen (§4) |
| `nTestMinusBtn`, `nTestPlusBtn`, `nSocraticMinusBtn`, `nSocraticPlusBtn`, `nTestValue`, `nSocraticValue` | `ui.js`, `study.js` | Delete handler blocks; these controls are missing from HTML and unused |
| `questionsPreviewLabel` | `ui.js`, `study.js` | Delete update calls |
| `connectionQuestionsToggleBtn`, `connectionQuestionsToggleSubtitle` | `ui.js`, `study.js`, `main.js` | Delete handler blocks |
| `sourceFidelityStrictToggleBtn`, `sourceFidelityStrictHint` | `ui.js`, `study.js` | Delete handler blocks |
| `resumeSessionBtn`, `resumeMaterialInput`, `resumeMdInput`, `resumeSessionStatus`, `resumeSessionError` | `ui.js`, `study.js` | Delete entire resume-from-backup inline handler block |
| `import-index-btn`, `import-index-label`, `import-index-file`, `import-index-btn-confirm`, `import-index-label-confirm` | `ui.js`, `study.js` | Delete handler blocks |
| `fullPackPhase1`, `fullPackPhase2`, `fullPackPhase3`, `fullPackActionLabel`, `fullPackCtaSubtitle` | `ui.js` (`updateFullPackProgressUi`) | Delete null assignments and conditional update calls; simplify `updateFullPackProgressUi` to update only elements that exist |

### 2c. Broken elements in HTML (delete from index.html)

| Element | Screen | Reason |
|---------|--------|--------|
| `#loadOfflinePackBtn` | `screenPlaceholder` | No click handler wired; button is visible but inert |
| `#offlinePackInput` | `screenPlaceholder` | No change handler wired; hidden input referenced nowhere |
| `#blocksListOutput` | `screenBlocksList` | Hidden textarea used as internal sync target; if no user-visible role, move to a JS variable |

### 2d. Redundant "Save session" buttons

**Keep:** `#btnDownloadSessionMd` in global chrome — **rename to "Export" and hide except on `screenComplete` and `screenTest`/`screenSocratic` only** (see §3d).

**Delete:**
- `#saveSessionBtn` on `screenComplete` — auto-persist already occurred; the completion screen copy "Save your session when you are ready" is factually wrong and must be rewritten (see §3e).
- `#saveSessionInlineBtn` in `#studyProgress` — redundant with the renamed corner Export button.

---

## 3. Per-screen changes

Changes are listed only for screens that require modifications. Screens not listed are correct as-is (modulo global chrome rules in §1/R7).

---

### 3a. `screenApiSetup` → relocate entirely to `screenSettings`

This screen currently appears at boot if no API key exists. After this spec:

- Create `screenSettings` (see §4).
- On first boot with no key: navigate directly to `screenSettings` with the API key section expanded and a contextual heading "Add your API key to get started".
- `#changeKeyLink` in global chrome: rename to settings icon (⚙), navigate to `screenSettings`. Remove the text link.
- The standalone `screenApiSetup` screen is **deleted**. Its form fields and submit logic move to `screenSettings` (§4).

---

### 3b. `screenModeSelect` — remove upload entry point and persistence health banner

**Delete from this screen:**
- `#flowRecommendBtn` and `#flowRecommendFileInput` — this is the third upload entry point for study material. Flow recommendation runs automatically when material is uploaded on `screenCreateSessionStart` (the canonical upload path). Remove the standalone "Recommend my study flow" button here.
- `#persistHealthRecoverBtnMode` and `#persistHealthDismissBtnMode` — duplicate of the banner already on `screenPlaceholder`. One canonical location for persistence health warnings: `screenPlaceholder` only.
- `#modeSelectLibraryBtn` — library is already reachable from `screenAppHome` (Sessions button). Removing it from mode select reduces clutter without losing access.
- `#modeSelectContinueBtn` — audit confirmed this is a "resume last mode / hub continue" button. Its function is indistinguishable from selecting a mode radio. If a session is in progress, the mode radio for that mode should be pre-selected. Delete the separate Continue button.

**Keep:**
- Mode radios (RSVP, Slow, Cloze, Questions, Recall).
- `#recommendationStartBtn` and `#modeSelectChooseManualBtn` / `#modeSelectUseRecommendedBtn` toggle.
- `#btnUploadToVault`.
- `#modeSelectBreadcrumb`.

**Add:**
- A back button (← ) navigating to `screenAppHome`. This screen currently has no back navigation, inconsistent with every other screen in the app.

---

### 3c. `screenPlaceholder` — remove language selector, keep one upload path

**Delete from this screen:**
- `#languageSelect` — global preference, moves to `screenSettings` (§4).
- `#persistHealthRecoverBtn` and `#persistHealthDismissBtn` — keep here, delete the duplicate on `screenModeSelect`.

**Keep everything else as-is.** This is already the canonical material upload screen.

---

### 3d. Global chrome — contextual visibility rules

Implement the following in `syncFloatingChrome()` (or equivalent in `ui.js`). These are exhaustive rules — if a condition is not listed, the element is hidden.

| Element | Visible on | Hidden on |
|---------|-----------|-----------|
| `#newSessionBtn` (+) | `screenAppHome`, `screenDocLibrary`, `screenModeSelect` | All other screens |
| `#btnDownloadSessionMd` (renamed to Export) | `screenComplete`, `screenTest`, `screenSocratic` | All other screens |
| `#changeKeyLink` (replaced by ⚙ settings icon) | All screens except `screenSlowReader` | `screenSlowReader` (already hidden by `body.slow-reader-active`) |
| Guide sidebar toggle | `screenTest`, `screenSocratic`, `screenSlowReader`, `screenRecall`, `screenClozeStudy` | All other screens |
| `#installPwaBtn` | `screenAppHome` only | All other screens |
| `#vaultUploadResumeBanner` | Already shown contextually — no change |  |

---

### 3e. `screenComplete` — rewrite misleading copy, remove broken action

**Delete:** `#saveSessionBtn` (R3 — data already persisted).

**Rewrite:** The line "Save your session when you are ready" → "Your session has been saved." (factually accurate; data is in session-store throughout study).

**Keep:** `#btnPracticeRetrieval`, `#reviewSessionBtn`, `#downloadOfflinePackBtn` (dynamic).

**Rename:** `#btnDownloadSessionMd` in corner chrome is the export path. Its tooltip/title should read "Export session as Markdown".

---

### 3f. `screenVaultBranch` — deduplicate Review

Two Review buttons exist with different behaviors and identical labels:
- `#btnVaultBranchReview` → opens `screenReviewConfig` (full config flow).
- `#btnVaultReview` on `screenDocLibrary` → `runVaultSm2ReviewSession()` (direct SM-2, no config).

**Fix:**
- `screenVaultBranch`: keep one button labeled "Review" → opens `screenReviewConfig` (the configured path is more appropriate here).
- `screenDocLibrary`: rename `#btnVaultReview` to "Quick review" to distinguish it from the configured review. The SM-2 badge stays.
- Delete `#vaultBranchReviewBadge` (redundant mirror of `#vaultReviewBadge`). One badge, one screen.

---

### 3g. `screenUploadToVaultCandidates` — deduplicate Cancel/Back

**Delete:** `#btnUploadVaultCancel` — same destination as `#uploadVaultBackBtn`. Keep only the Back button (top-left, consistent with every other screen).

---

### 3h. `screenRetrievalHub` — fix Back button position

Back button is at the bottom of the card. Move to top-left, consistent with all other screens.

---

### 3i. `screenFullPackGenerating` — remove inline style

Remove `style="max-width: 760px; margin: 0 auto"` from the card container. Apply the standard `.screen-card` class from the design system. (R10.)

---

### 3j. `screenPrePackingAssessment` / `screenTest` / `screenSocratic` — deduplicate Skip assessment

Three separate "Skip assessment" buttons exist across these screens, all calling `handlePrePackingSkip()`:
- `#prePackingAssessmentSkip` on `screenPrePackingAssessment`
- `#assessmentRunnerSkip` on `screenTest`
- `#assessmentRunnerSkipSocratic` on `screenSocratic`

**Keep:** `#prePackingAssessmentSkip` on `screenPrePackingAssessment` — this is where the assessment starts; skipping belongs here.

**Delete:** `#assessmentRunnerSkip` and `#assessmentRunnerSkipSocratic` — once an assessment is running, skipping mid-run is an edge case that does not need a persistent button. If abort-mid-run is needed, use the standard Back navigation, which already returns to the prior screen.

---

### 3k. `screenRecall` — deduplicate Concept peek

`#recallConceptPeekBtn` and `<details id="recallConceptPeek">` both toggle the same concept list. The `<details>` native toggle is sufficient. **Delete** `#recallConceptPeekBtn`.

---

### 3l. `screenInitialAssessment` — audit for reachability

Confirm whether `showScreen("assessment")` is reachable in the current codebase with pre-packing assessment enabled. If pre-packing supersedes this screen entirely, delete `screenInitialAssessment`, `screenAssessmentGenerating`, and all related handlers. If still reachable as a fallback path, keep as-is but apply R1/R2 strictly to its elements.

> **Action for Cursor:** Grep for all calls to `showScreen("assessment")` and `showScreen("assessmentGenerating")`. If the only caller path requires `config.flags.prePackingAssessment === false`, and that flag is no longer configurable from the UI, mark both screens for deletion in a follow-up spec.

---

## 4. New screen: `screenSettings`

Create a single settings screen housing all global configuration. It replaces `screenApiSetup`.

**Trigger:** ⚙ icon (replaces `#changeKeyLink`) from any screen.  
**Exit:** ← Back returns to whatever screen the user came from (push/pop navigation state).

### Sections

**API Keys**
- DeepSeek API key input (migrated from `screenApiSetup`)
- Gemini API key input (migrated from `screenApiSetup`)
- Save button — this is one of the two legitimate Save buttons in the app (the other is the export button). It writes to `localStorage`. Label: "Save keys".

**Study language**
- Language selector (migrated from `screenPlaceholder` `#languageSelect`)
- Saves to `localStorage` on change (no explicit Save button needed — immediate persist on select, same as current behavior).

**LLM model**
- Model selector (migrated ghost reference `llmModelSelect` — now needs an actual HTML element here)
- Saves to `localStorage` on change.

**Other preferences** (extend as needed in future specs; do not add anything here not currently in the codebase)

### Implementation notes

- On first boot with no DeepSeek key: show `screenSettings` directly with a banner "Add your DeepSeek API key to start using Pith." Do not create a separate onboarding screen.
- `enterAppHome()` in `main.js` currently gates on key presence. Change the gate: if no key, `showScreen("settings")` instead of `showScreen("setup")`. After saving a valid key, call `enterAppHome()`.
- `screenApiSetup` HTML is deleted after this migration is complete.

---

## 5. Naming audit — apply to all screens

Rename the following labels app-wide (HTML, any dynamic render in JS):

| Current | Replacement | Reason |
|---------|-------------|--------|
| "Save session" | "Export session" | R3 — it exports a file, not a save |
| "Save" (API key form) | "Save keys" | Specific to what is being saved |
| ⊞ + button tooltip | "New session" | Already its JS name; make tooltip match |
| "Quick knowledge check" checkbox | "Pre-study knowledge check" | More accurate to what it is |
| "Summary so far" button | keep as-is | Accurate and useful |

---

## 6. MCQ feedback box (image reference)

The screenshot shows an MCQ feedback box (teal background explanation panel) that does not fit the card layout — the box bleeds to the edges of the card and appears to be inside an answer option container rather than below the options.

**Fix:** The feedback panel must render as a separate block below the options list, with `margin-top: var(--space-md)`, `border-radius: var(--radius-sm)`, and `padding: var(--space-sm) var(--space-md)`. It must not inherit the `.option` or `.option-row` grid layout. Apply `background: var(--color-teal-subtle)` and `color: var(--color-text-primary)` from the design system. Do not use inline background color.

If the feedback div is currently a child of an `.option` or `.answer-row` element, move it to be a sibling of the options container, not a child.

---

## 7. Implementation order

Execute in this order to avoid breaking the app mid-work:

1. **Delete dead screen** `screenBetweenBlocks` and its JS references. (Safest — nothing calls it.)
2. **Delete ghost reference handlers** (§2b). Run the app and confirm no console errors on page load.
3. **Delete broken HTML elements** `#loadOfflinePackBtn`, `#offlinePackInput`, `#blocksListOutput` (§2c).
4. **Create `screenSettings`** with API keys + language + model selector (§4). Wire ⚙ icon. Delete `screenApiSetup`.
5. **Remove `#languageSelect` from `screenPlaceholder`** and `#flowRecommendBtn` + `#flowRecommendFileInput` from `screenModeSelect`.
6. **Implement `syncFloatingChrome()` contextual visibility rules** (§3d) in full.
7. **Delete `#saveSessionBtn`** from `screenComplete`; rewrite completion copy (§3e).
8. **Rename `#btnDownloadSessionMd`** and `#saveSessionInlineBtn` (§2d + §3d).
9. **Apply remaining per-screen changes** (§3f–§3l) in any order.
10. **Fix MCQ feedback box layout** (§6).
11. **Bump `SW_VERSION`** in `sw.js`. Hard-reload to verify no stale service worker.

---

## 8. Verification checklist

After implementation, each of the following must be true. Cursor should check these explicitly.

- [ ] `showScreen("between")` does not appear anywhere in the codebase.
- [ ] `screenBetweenBlocks` does not appear in `index.html`.
- [ ] All IDs listed in §2b have zero occurrences in `src/js/` (confirmed by grep).
- [ ] `#loadOfflinePackBtn` and `#offlinePackInput` have zero occurrences in `index.html` and `src/js/`.
- [ ] No button with text "Save session" exists anywhere in `index.html` or in JS that generates HTML.
- [ ] `#languageSelect` exists only inside `screenSettings`, nowhere else.
- [ ] `#changeKeyLink` does not exist; a settings icon navigates to `screenSettings`.
- [ ] `screenApiSetup` does not exist in `index.html`.
- [ ] `syncFloatingChrome()` explicitly hides `#newSessionBtn` on every screen except the three listed in §3d.
- [ ] `screenFullPackGenerating`'s card container has no inline `style` attribute.
- [ ] The MCQ feedback panel is a sibling of the options list, not a child of an option row.
- [ ] `SW_VERSION` has been bumped.
- [ ] App loads in incognito with no console errors on page load.
- [ ] App loads in incognito with no console errors after completing one RSVP block.
