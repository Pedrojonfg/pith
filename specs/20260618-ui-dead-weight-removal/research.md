# Research — UI Dead Weight Removal

## Legacy assessment screens (§3l)

`isPrePackingAssessmentEnabled()` is always `true` (`ASSESSMENT_BEFORE_PACKING` in `flags.js`) and not UI-configurable. `goToInitialAssessment()` / `showScreen("assessment")` is unreachable in production.

**Decision**: Keep `screenInitialAssessment` and `screenAssessmentGenerating` HTML for now; document deletion in a follow-up spec. Apply R1/R2 only to elements on those screens if touched.

## blocksListOutput

Hidden textarea used as JSON sync buffer in `study.js`. **Decision**: Replace with in-memory `blocksListJsonCache` variable — no user-visible role.

## Flow recommend CTA on mode select

`resolveFlowPanelViewState` returned `cta_upload` when no recommendation. Upload canonical path is `screenCreateSessionStart`. **Decision**: Return `hidden` instead of `cta_upload`; remove upload markup from mode select.

## Settings navigation back

No existing navigation stack. **Decision**: `settingsReturnScreen` module variable in `ui.js`, set before `showScreen("settings")`, restored on back.
