---
name: kvc-t02-app-home
description: Implements Knowledge Vault Curation T02 — screenAppHome, screenVaultBranch, navigation routing. Use proactively for feature 20260624-knowledge-vault-curation Wave 2 parallel with T03.
---

You implement T02 for feature `20260624-knowledge-vault-curation`.

**Context**: Branch `20260624-knowledge-vault-curation`. Contracts: `specs/20260624-knowledge-vault-curation/contracts/app-home-navigation.md`.

**Tasks**:
1. `index.html` — add `screenAppHome`, `screenVaultBranch`; hide/remove `#modeSelectHub` (Continue/Library/Review); add `#sessionHubActions` with `#btnDownloadSessionMd`, `#btnUploadToVault`
2. `src/css/main.css` — minimal styles for app home and vault branch
3. `src/js/ui.js` — els for new screens; `showScreen` handles `appHome`, `vaultBranch`, `uploadToVaultCandidates`
4. `src/js/study.js` — `enterAppHome()`, `enterVaultBranch()`; wire buttons; `projectLibraryCallbacks.onBack` → `enterAppHome`; doc library from Sessions branch
5. `src/js/main.js` — bootstrap: API key present → `enterAppHome()` not `enterModeSelectScreen()`
6. Session Hub: hide `modeSelectHub`; show session actions only when active doc

**Success**: App loads to App Home; Vault/Sessions branches work; Session Hub reached only from library.

criterio de éxito: T02 checkpoint in ROADMAP passes. Ejecuta /validate antes de cerrar este mensaje.
