# Contract: Assessment UI (Pre-Packing)

**Feature**: `20260611-rsvp-assessment-reposition`  
**Modules**: `index.html`, `src/css/main.css`, `src/js/study.js`, `src/js/ui.js`

## Screens

### `screenPrePackingAssessment`

Shown after concept inventory + graph, when `ASSESSMENT_BEFORE_PACKING` and user did not skip.

| Element ID | Purpose |
|------------|---------|
| `prePackingAssessmentScreen` | container |
| `prePackingAssessmentSkip` | skip → pack without profile |
| `prePackingAssessmentProgress` | question N/M |
| `prePackingAssessmentQuestion` | stem |
| `prePackingAssessmentOptions` | MCQ radio group |
| `prePackingAssessmentNext` | advance |
| `prePackingAssessmentGraph` | decorative mini-graph (reuse material graph mount) |

**Rules**:
- Always show "I don't know" option (UI constant, not from LLM)
- Skip sets `assessment_skipped: true`, `knowledge_profile: null`

### `screenPrePackingResults`

Informative; does not block parallel packing.

| Element ID | Purpose |
|------------|---------|
| `prePackingResultsScreen` | container |
| `prePackingResultsSummary` | mastered / partial / none counts |
| `prePackingResultsDiff` | `hasta N → M` when `ASSESSMENT_SHOW_DIFF` |
| `prePackingResultsAccept` | confirm packed blocks |
| `prePackingResultsIgnore` | re-pack without profile |
| `prePackingResultsDetail` | expandable concept list |

**Rules**:
- Hide entire screen if zero mastered concepts (edge case §8)
- Accept waits on `packingPromise` if still pending (spinner)
- Ignore triggers `packInventoryToBlocks(..., { knowledgeProfile: null })` + `packing_ignored_profile: true`

## Flow wiring (`study.js`)

Replace direct `packInventoryToBlocks` after generate with:

```text
runConceptInventory (or cache)
→ build/show graph
→ if !ASSESSMENT_BEFORE_PACKING: pack → blocks editor (legacy short-circuit)
→ prefetch assessment items (background)
→ show assessment screen OR skip path
→ on submit: evaluate → persist profile → start parallel pack → results
→ accept → existing blocks confirmation / editor
```

## CSS namespace

`.pre-packing-assessment-*`, `.pre-packing-results-*` in `main.css`

## Non-goals v1

- No timed questions (unlike legacy assessment runner)
- No open-text answers in UI
