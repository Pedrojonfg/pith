# Contract: Assessment Runner UI (Questions Screens)

**Feature**: `20260612-rsvp-assessment-questions-parity`  
**Modules**: `src/js/study.js`, `index.html`, `src/css/main.css`

## Runner mode

When `prePackingFlow.runnerMode === 'assessment'`:

| Concern | Study block mode | Assessment runner |
|---------|------------------|-------------------|
| Block source | `session.blocks[i]` | `prePackingFlow.assessmentBlock` |
| Progress | block N/M | "Knowledge check · Q i/total" |
| After test answer | show feedback → next Q or socratic | same UX, store in `assessmentResponses` |
| After last Q | next block / finish | `finishPrePackingAssessment()` |
| `recordResponse` | writes session | **skip** — use assessmentResponses only |
| Skip | N/A | visible → `handlePrePackingSkip()` |

## Functions to add/modify

```js
function isPrePackingAssessmentRunner() // prePackingFlow?.runnerMode === 'assessment'
function getAssessmentQuestionContext() // like getActiveQuestionContext but for assessment block
function enterPrePackingAssessmentRunner() // replaces enterPrePackingAssessmentScreen happy path
function handleAssessmentTestAnswer({ chosen, correct, feedback })
function handleAssessmentSocraticSubmit(answerText)
function renderAssessmentChrome() // skip button, progress label
```

## Guards in existing functions

- `getActiveQuestionContext`: if assessment runner, delegate to `getAssessmentQuestionContext`
- `renderTestQuestion`: no change if context correct
- `handleTestAnswer`: at top, if `isPrePackingAssessmentRunner()` → `handleAssessmentTestAnswer` and return

## Screens

- **Use**: `screenTest`, `screenSocratic`
- **Do not use** (happy path): `screenPrePackingAssessment`

## Skip affordance

- Add `#assessmentRunnerSkip` in test/socratic screen header OR reuse floating chrome
- Must be visible during entire assessment

## CSS

- `.assessment-runner-chrome` — optional skip + label overlay
- Do not duplicate `.test-*` / `.socratic-*` styles
