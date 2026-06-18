# Data Model: Holistic Pre-Packing Assessment Coverage

## HolisticAssessmentBudget

```ts
{
  n_test: number;           // 0..HOLISTIC_ASSESSMENT_MAX
  n_socratic: number;       // 0..5
  edgeTestQuota: number;    // subset of n_test
  rationale: string;      // UI tooltip / debug
}
```

## AssessmentCoverageBatch

```ts
{
  batchId: string;          // e.g. "sec-0"
  label: string;            // hierarchy section label
  conceptIds: string[];
  edgeIds: string[];        // serialized "from→to"
  n_test: number;
  n_socratic: number;
  materialText: string;     // full section chunk, not truncated head
}
```

## AssessmentCoveragePlan

```ts
{
  version: 1;
  batches: AssessmentCoverageBatch[];
  totals: { n_test: number; n_socratic: number };
  planHash: string;         // stable key for prefetch
}
```

## Assessment Question (extended)

Existing Questions-mode fields plus:

```ts
{
  edge?: { from: string; to: string };
  coverage_batch?: string;
}
```

## Session / flow (unchanged storage)

- `prePackingFlow.conceptInventory`, `.edges`, `.cleanedText`
- `prePackingFlow.coveragePlan` (new, ephemeral)
- `session._meta.knowledge_profile` — `coverage` field already exists; richer item list

## Flags (`config/flags.js`)

```ts
HOLISTIC_ASSESSMENT_ENABLED: boolean;
HOLISTIC_ASSESSMENT_MAX: 50;  // replaces ASSESSMENT_ITEMS_MAX for holistic path
```

## Config (`config.js`)

```ts
export const HOLISTIC_ASSESSMENT_MAX = 50;
export const HOLISTIC_ASSESSMENT_MIN = 8;
```
