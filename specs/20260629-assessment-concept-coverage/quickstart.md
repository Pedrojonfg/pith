# Quickstart: Concept-Coverage Assessment

1. Enable holistic assessment (`HOLISTIC_ASSESSMENT_ENABLED: true` in flags).
2. Upload a document with 70+ concepts; run pre-packing assessment.
3. Confirm generation completes without "question count mismatch" error.
4. Complete quiz; inspect session `_meta.knowledge_profile.byConceptId`.
5. Verify packing proceeds; mastered concepts deprioritized in blocks.

## Regression

```bash
node cursor-tests/20260629_assessment-concept-coverage.mjs
```
