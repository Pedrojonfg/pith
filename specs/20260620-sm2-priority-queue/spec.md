# Feature Specification: SM-2 Priority Queue

**Feature Branch**: `20260620-sm2-priority-queue`

**Created**: 2026-06-13

**Status**: Draft

**Input**: Spaced-repetition review system based on SM-2 where time orders items in a priority queue instead of blocking early review. Core algorithm, unified review-item model, ingestion from existing study modes, and minimal Review UI (badge on mode select + functional review screen). Visual redesign, BKT, FSRS, cross-device sync, and prerequisite-graph review are out of scope.

**Prerequisites**: Unified session (`20260609-unified-session`) with `shared.smItems`; Knowledge Vault A+ (`20260618-knowledge-vault-a-plus`) and Post A+ vault-driven review bridge (`20260619-knowledge-vault-post-a-plus` T13) for decaying concepts entering the pool.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Always have something to review, ordered by urgency (Priority: P1)

As a learner using multiple study modes on the same document, I want a single review queue ordered by when each item is due so I always know what to study next — urgent items first, but I can keep going if I want more practice.

**Why this priority**: Delivers the core product value: a non-blocking SM-2 queue that unifies retention across modes.

**Independent Test**: Seed items with different due dates; open Review; items appear sorted soonest-first; items not yet "due" still appear later in the queue; completing an on-time review advances the interval.

**Acceptance Scenarios**:

1. **Given** review items with mixed due dates, **When** the user opens Review, **Then** items are ordered by scheduled due time (most urgent first).
2. **Given** an item whose scheduled due date is in the future, **When** the user reaches it in the queue and answers, **Then** the attempt is recorded but the spaced interval does not advance (early review).
3. **Given** an item whose scheduled due date has passed or is within the on-time window, **When** the user answers with quality ≥ 3, **Then** the interval grows per SM-2 rules.
4. **Given** an on-time review with quality &lt; 3, **When** the user submits, **Then** repetitions reset and interval returns to the minimum.

---

### User Story 2 — Study modes feed the same review pool (Priority: P1)

As a learner answering questions in RSVP, Questions, Cloze, or creating Slow Mode flashcards, I want my performance to automatically create or update review items so I do not manually manage separate decks per mode.

**Why this priority**: Without ingestion, the queue stays empty; this is the data pipeline for Story 1.

**Independent Test**: Complete a block in RSVP with varied answer quality; verify a review item is created/updated in the shared pool; repeat for Cloze answer and Slow flashcard creation.

**Acceptance Scenarios**:

1. **Given** a completed RSVP/Questions block answer, **When** quality is mapped from outcome (correct first try, after hesitation, with hint, wrong, skip), **Then** a review item is created or updated for that block.
2. **Given** a Cloze study answer, **When** the user finishes an item, **Then** a parallel review item is created or updated without breaking Cloze's own flow.
3. **Given** a Slow Mode flashcard is created, **When** saved, **Then** a corresponding review item appears in the shared pool.
4. **Given** an item already exists for the same source, **When** a new answer is recorded, **Then** the existing item is updated (no duplicate for same source).

---

### User Story 3 — See review urgency at a glance (Priority: P2)

As a learner on the mode-select screen, I want a Review entry with a count of items due now so I can jump into retention work without hunting through menus.

**Why this priority**: Minimal UI that makes the queue discoverable; depends on P1 algorithm.

**Independent Test**: With N items due now, mode select shows Review button with badge N; with zero due, badge hidden.

**Acceptance Scenarios**:

1. **Given** at least one item with scheduled due ≤ now, **When** mode select renders, **Then** Review shows a badge with the due-now count.
2. **Given** no items due now, **When** mode select renders, **Then** the badge is hidden (Review still accessible).
3. **Given** the user taps Review, **When** the review screen opens, **Then** the priority queue from Story 1 is used.

---

### User Story 4 — Understand early vs on-time review (Priority: P2)

As a learner who reviews ahead of schedule, I want clear feedback that my early practice is logged but will not shorten the official interval yet, so I understand why an item may reappear sooner than expected.

**Why this priority**: Prevents confusion from the non-blocking design; low effort, high clarity.

**Independent Test**: Review an item before its on-time window; UI shows early-review indicator; after submit, interval unchanged but observation recorded.

**Acceptance Scenarios**:

1. **Given** an item outside its on-time window, **When** displayed in Review, **Then** a subtle "early review" indicator is shown.
2. **Given** an early review submission, **When** saved, **Then** an observation is appended with early flag and days-early metadata.
3. **Given** an on-time submission, **When** saved, **Then** SM-2 fields (interval, ease, repetitions, scheduled due) update normally.

---

### Edge Cases

- Empty review pool: Review screen shows helpful empty state, not an error.
- Legacy `smItems` shapes from Cloze pipeline or vault decay bridge: normalized on read without data loss.
- Duplicate source IDs across modes: upsert by stable source key, not duplicate rows.
- First review of a new item: always treated as on-time.
- Ease factor floor: never drops below 1.3 after updates.
- User switches documents mid-review: session-scoped items stay with their document.
- Quality mapping edge cases (skip / no answer): recorded as low quality without crashing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a unified review-item collection per document session in the shared layer.
- **FR-002**: System MUST schedule items using SM-2 interval and ease-factor rules when review is on-time.
- **FR-003**: System MUST treat time as ordering only: items MAY be reviewed before scheduled due without blocking the user.
- **FR-004**: System MUST NOT advance SM-2 interval, repetitions, or ease factor on early review; it MUST still record the observation.
- **FR-005**: System MUST define on-time as review within the last 30% of the current interval (configurable constant, not user-facing in v1).
- **FR-006**: System MUST sort the review queue by scheduled due ascending.
- **FR-007**: System MUST expose counts of items due now and due within 24 hours for UI badges.
- **FR-008**: System MUST ingest review updates from RSVP and Questions block answers with quality mapped from answer outcome.
- **FR-009**: System MUST ingest review updates from Cloze study answers.
- **FR-010**: System MUST create review items when Slow Mode flashcards are created.
- **FR-011**: System MUST upsert by stable source identity (`sourceType` + `sourceId`) to avoid duplicates.
- **FR-012**: Review screen MUST present title and content preview per item and accept four self-ratings mapped to SM-2 quality (5/4/3/1).
- **FR-013**: System MUST persist full observation history per item (timestamp, quality, early flag, interval at time, days early).
- **FR-014**: System MUST normalize legacy review-item shapes on load to the canonical model.
- **FR-015**: Vault-driven decay items already in the pool MUST continue to work after schema normalization (no lost items on mode switch).

### Key Entities

- **SmItem**: A reviewable unit linked to a source (RSVP block, Cloze item, Slow flashcard, or vault concept) with SM-2 state, scheduling timestamps, and observation history.
- **SmObservation**: One review attempt — quality score, whether it was early, and scheduling context at attempt time.
- **Review queue**: Ordered view of SmItems for presentation; not a separate store.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open Review and complete at least 10 items in sequence without errors when items exist across two or more source modes.
- **SC-002**: 100% of on-time reviews with quality ≥ 3 increase interval per SM-2 rules in automated tests.
- **SC-003**: 100% of early reviews leave interval unchanged while appending an observation in automated tests.
- **SC-004**: Mode-select badge reflects due-now count within one render cycle of opening the screen.
- **SC-005**: After studying one RSVP block, at least one review item appears in shared storage without manual import.
- **SC-006**: Legacy Cloze and vault-decay items survive normalization and remain reviewable (regression test pass).

## Assumptions

- Unified session `shared.smItems` remains the persistence location; no backend migration in this feature.
- Existing `upsertSmItem` in session store is extended, not replaced.
- Post A+ `syncVaultToReviewPool` continues to populate items; this feature formalizes SM-2 behavior and Review UI consumption.
- Quality mapping from MCQ/Cloze outcomes uses documented heuristics; fine-grained confidence signals are out of scope.
- Review UI reuses existing `screenReview` shell with minimal additions (badge, early chip, quality buttons).
- English UI strings per project rules.
- BKT, FSRS, user-configurable threshold, review analytics dashboard, and visual redesign are deferred.

## Out of Scope

- Review screen visual redesign beyond badge and early-review chip
- Mastery history / statistics views
- BKT and Bayesian models (needs ≥15 observations per concept)
- User-configurable threshold ratio
- FSRS / SuperMemo 18
- Cross-device sync (Supabase)
- Prerequisite-graph-driven review ordering (GKV Block 5)
