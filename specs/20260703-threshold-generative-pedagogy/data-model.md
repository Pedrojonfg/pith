# Data Model: Threshold Concepts & Generative Pedagogy

## Concept inventory entry (extended)

```ts
{
  id: string;
  // ...existing fields...
  isThreshold?: boolean;       // default false
  thresholdScore?: number;     // 0–1 heuristic+LLM composite
  thresholdSource?: "heuristic" | "llm" | "both";
}
```

## Block index entry (optional runtime)

```ts
{
  id: number;
  concept_ids: string[];
  is_threshold_block?: boolean;  // derived: any concept_ids ∩ thresholdIds
}
```

## Block `_config` (RSVP)

```ts
{
  explanation_profile: "thorough" | "brief_deep" | "relational_compressed" | "threshold_expanded";
  rsvp_wpm_cap?: number;  // default 250 for threshold_expanded
  n_test: number;
  n_socratic: number;
}
```

## Flags (`PEDAGOGICAL_FLAGS`)

| Key | Default | Purpose |
|-----|---------|---------|
| `THRESHOLD_CONCEPTS_ENABLED` | `true` | Master switch |
| `THRESHOLD_TARGET_FRACTION` | `0.12` | Tag top fraction |
| `THRESHOLD_LLM_CONFIRM_ENABLED` | `true` | Batched LLM confirm |
| `THRESHOLD_RSVP_WPM_CAP` | `250` | Max WPM for threshold blocks |

## Comprehension gate extension

- Threshold + conceptual: Recall `partial` does NOT confirm; requires `adequate` | `strong` or Socratic quality ≥ 4.
