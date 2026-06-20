# Feature Specification: RSVP Shared Consumption Hardening

**Feature Branch**: `20260620-rsvp-shared-consumption`

**Created**: 2026-06-20

**Status**: Draft

**Input**: After document preparation (Tier 1), RSVP create must consume `shared` artifacts instantly — block recommendation pre-filled, optional pre-packing assessment toggle visible, and Generate must not re-run concept inventory. LLM work on Generate is assessment MC questions only (when opted in); packing uses cached inventory. Per-block lazy generation unchanged.

**Extends**: `20260618-document-preparation-frontload` (`contracts/mode-consumption.md`), `20260620-session-prep-gate`.

## Clarifications

### Session 2026-06-20

- Q: Re-inventory when study notes change? → A: **No** when Tier 1 complete; `shared.conceptInventory` is source of truth.
- Q: Legacy sessions without prep? → A: **Keep** existing LLM inventory fallback.
- Q: Assessment default? → A: **Checked** (opt-out via checkbox).
- Q: Questions mode? → A: **Same** shared-inventory reuse rules as RSVP when bootstrapped.

## User Scenarios & Testing

### User Story 1 - Instant block count on RSVP open (Priority: P1)

Student opens RSVP for a Tier-1-prepared document. Blocks field and rationale appear within 1s with no “indexing concepts” spinner.

**Acceptance Scenarios**:

1. **Given** `isTier1PreparationComplete`, **When** RSVP bootstrap create opens, **Then** `blocksInput` shows `shared.blockRecommendation.nBlocks` without LLM calls.
2. **Given** prepared doc, **When** `maybeAutoRecommendBlockCount` runs, **Then** it never calls `runConceptInventoryWithFallback`.

---

### User Story 2 - Assessment opt-in visible (Priority: P1)

Student sees “Pre-study knowledge check” checkbox on RSVP create (online, flag on) and can uncheck before Generate.

**Acceptance Scenarios**:

1. **Given** bootstrapped RSVP create, **When** screen renders, **Then** `#rsvpAssessmentOption` is visible.
2. **Given** checkbox unchecked, **When** user taps Generate blocks, **Then** flow skips assessment and packs from shared inventory.

---

### User Story 3 - Generate without re-inventory (Priority: P1)

Student taps Generate blocks. System uses `shared.conceptInventory` and graph; only assessment question LLM runs when assessment is on.

**Acceptance Scenarios**:

1. **Given** Tier 1 complete, **When** Generate with assessment on, **Then** no `runConceptInventoryWithFallback` or `twoPhaseConceptSplit` inventory pass.
2. **Given** Tier 1 complete and assessment off, **When** Generate, **Then** `packInventoryToBlocks` runs on shared inventory only.
3. **Given** study notes edited after prep, **When** Generate, **Then** inventory still comes from shared (notes may affect pack prompts only).

---

### User Story 4 - Legacy fallback preserved (Priority: P2)

Sessions without Tier 1 artifacts still work via existing inventory LLM path.

**Acceptance Scenarios**:

1. **Given** doc without `conceptInventory`, **When** Generate, **Then** legacy inventory/split path runs.

### Edge Cases

- Partial prep with inventory but missing block rec → show inventory-based default N, no re-inventory.
- Offline mode → assessment hidden; pack from shared if available.
- Fingerprint cache miss with prepared doc → still use shared inventory.

## Functional Requirements

- **FR-001**: When `isTier1PreparationComplete(doc)`, RSVP MUST treat `doc.shared.conceptInventory` as authoritative for pack and assessment.
- **FR-002**: Block recommendation UI MUST populate from `shared.blockRecommendation` without LLM when Tier 1 complete.
- **FR-003**: `#rsvpAssessmentOption` MUST be visible on bootstrapped RSVP create (online, assessment flag on).
- **FR-004**: Generate submit MUST NOT call concept-inventory LLM when FR-001 applies.
- **FR-005**: Assessment-on Generate MUST only add pre-packing assessment question LLM (existing holistic/simple paths).
- **FR-006**: Per-block study generation behavior MUST remain unchanged.
- **FR-007**: Legacy non-prepared sessions MUST retain inventory LLM fallback.

## Success Criteria

- **SC-001**: Prepared doc → RSVP open shows block N in &lt;1s (no inventory progress messages).
- **SC-002**: Prepared doc → Generate with assessment off completes pack without inventory LLM.
- **SC-003**: Integration tests assert no inventory LLM mock calls on prepared bootstrap path.

## Assumptions

- DPP Tier 1 gate and `shared` schema from front-load spec are in place.
- `isPrePackingAssessmentEnabled()` remains true in production flags.

## Out of Scope

- Changing holistic assessment algorithm or question counts.
- Tier 2 prep prefetch of assessment items.
- Per-block lazy generation pipeline.
