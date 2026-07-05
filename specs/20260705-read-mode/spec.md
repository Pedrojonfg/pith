# Feature Specification: Read Mode

**Feature Branch**: `20260705-read-mode`  
**Created**: 2026-07-05  
**Status**: Draft  
**Input**: Textbook-style exposure mode reusing RSVP block pipeline with static text rendering and lazy inline visuals (document images + Mermaid diagrams).

## User Scenarios & Testing

### User Story 1 — Read blocks then answer questions (P1)

As a learner, I want to read full block explanations at my own pace (not RSVP flash), then answer the same MCQ/Socratic questions as RSVP, so I can study dense material comfortably.

**Independent Test**: Select Read on mode select, generate blocks, complete one block's read view → questions → next block.

### User Story 2 — Optional inline visuals (P2)

As a learner reading a process or hierarchy, I want diagrams or document figures inserted in context when helpful, without blocking question flow if generation is slow.

**Independent Test**: Block with `visualNeed` shows visual when ready; questions remain available immediately.

## Requirements

- **FR-001**: System MUST expose `read` as an exposure mode alongside RSVP.
- **FR-002**: `modes.read` slice MUST mirror questions/rsvp block shape with independent progress.
- **FR-003**: Block generation MUST add optional `visualNeed` without a second LLM call.
- **FR-004**: Visuals MUST resolve lazily during prefetch; question flow MUST NOT block on visuals.
- **FR-005**: Mermaid diagrams MUST use dark theme; anchor miss MUST append visual at end.

## Assumptions

- Image association uses `pith-image` tokens in block `chunk` text (provenance from chunk alignment).
- Zero image candidates with `visualNeed.type === "image"` falls back to diagram generation.

## Success Criteria

- End-to-end Read session completes with SM-2 and assessment signals equivalent to RSVP.
- Malformed Mermaid is marked `failed` without crashing the UI.
