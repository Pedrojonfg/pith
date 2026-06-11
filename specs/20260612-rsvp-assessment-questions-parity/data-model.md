# Data Model: RSVP Assessment Questions Parity

**Feature**: `20260612-rsvp-assessment-questions-parity`

## Entidades

### AssessmentBlock (ephemeral)

Pseudo-bloque compatible con `normalizeBlockJson`:

```typescript
interface AssessmentBlock {
  id: 0;
  title: "Document knowledge check";
  explanation: "";  // vacío; no hay lectura previa
  questions: AssessmentQuestion[];
  _config: {
    n_test: number;
    n_socratic: number;
  };
}
```

### AssessmentQuestion (extends Questions question)

```typescript
interface AssessmentQuestion {
  type: "test" | "socratic";
  question: string;
  options?: { A: string; B: string; C: string; D: string };
  answer?: string;       // test only — letter A-D
  feedback?: string;     // test only
  concept_id: string;    // REQUIRED — maps to inventory
  edge?: { from: string; to: string };  // optional relational item
  item_id: string;       // stable id for responses
}
```

**Validation**:
- `concept_id` must exist in `concept_inventory`
- test: exactly 4 options, valid answer letter, non-empty feedback
- socratic: no options/answer
- count: `n_test` test + `n_socratic` socratic after normalize

### PrePackingFlowState (extended)

```typescript
interface PrePackingFlowState {
  // existing fields...
  runnerMode?: "assessment" | null;
  assessmentBlock?: AssessmentBlock;
  assessmentQuestionIndex?: number;
  assessmentResponses?: Array<{
    item_id: string;
    questionType: "test" | "socratic";
    userAnswer: string;
    correctAnswer?: string;
    concept_id: string;
  }>;
  // assessmentItems deprecated → use assessmentBlock.questions
}
```

### KnowledgeProfile (unchanged semantics)

Output of evaluation; items keyed by `concept_id`. Test auto-score and socratic LLM evaluation merge with **max mastery** rule:

| Source | none | partial | full |
|--------|------|---------|------|
| Priority | 0 | 1 | 2 |

When two items target same `concept_id`, keep highest priority; confidence = max of contributors.

## State transitions

```text
inventory ready
  → generate AssessmentBlock (prefetch)
  → runnerMode=assessment, show test screen
  → for each test: answer + feedback → store response → next
  → socratic phase if n_socratic > 0
  → evaluate (test local + socratic LLM)
  → knowledge_profile
  → results / pack (unchanged)
```

## Flags

```typescript
ASSESSMENT_USE_QUESTIONS_UI: true;      // default on
ASSESSMENT_LEGACY_MCQ_UI: false;        // rollback to screenPrePackingAssessment
// ASSESSMENT_ITEMS_MAX: deprecated as count driver
```
