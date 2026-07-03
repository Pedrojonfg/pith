# Data Model: Shared Pre-Mode Assessment

## shared.knowledgeProfile

| Field | Type | Notes |
|-------|------|-------|
| computedAt | number | ms epoch |
| source | `"assessment"` \| null | null when skipped / never run |
| perConcept | Record | canonicalId → { mastery, confidence } |
| packProfile | object? | RSVP pack bridge (byConceptId/items) |

## shared.assessmentGate

| Field | Type | Notes |
|-------|------|-------|
| resolvedAt | number | ms epoch when gate closed |
| outcome | `"accepted"` \| `"skipped"` | |

## Migration

- `_meta.knowledge_profile` → `shared.knowledgeProfile` on session load via `migrateKnowledgeProfileToShared`
