# Contract: Document Preparation Pipeline Orchestrator

**Module**: `src/js/document-preparation.js`

## Exports

### `computePreparationFingerprint(doc)`

Returns stable string from `rawMarkdown`, `uploadMeta.studyNotes` (if any), pipeline levers snapshot.

### `runDocumentPreparationPipeline(doc, options)`

**Options**:
- `llmModel?: string`
- `language?: string`
- `onProgress?: (msg: { phaseId, wave, label, status }) => void`
- `signal?: AbortSignal`
- `stopAfterTier?: 0 | 1 | 2` — default 2; ingest-only uses 1
- `resume?: boolean` — default true (skip completed phases)

**Returns**: `{ doc, status, phaseResults, errors }`

**Behavior**:
- Idempotent per phase when fingerprint + outputHash match
- Parallel waves per Pipeline Contract in spec.md
- Does NOT call packInventoryToBlocks, assessment, or ensureBlockGenerated
- Persists after each phase via `saveDocumentSession`

### `retryFailedPreparationPhases(doc, options)`

Re-runs phases with `status: failed` and downstream dependents only.

## Phase IDs

| ID | Tier | Legacy module |
|----|------|---------------|
| T0.1 | 0 | normalization |
| T0.2 | 0 | flow-recommendation/analyzer |
| T1.1 | 1 | buildDocumentHierarchy |
| T1.2 | 1 | runConceptInventoryWithFallback |
| T1.3 | 1 | generateEpistemicGraph |
| T1.4 | 1 | computeBlockCountRecommendation |
| T1.5 | 1 | computeAndPersistModeRecommendation |
| T1.6 | 1 | vault gray ingest |
| T2.1 | 2 | runClozePipelinePhases |
| T2.2 | 2 | generateRecallQuestions |
| T2.3 | 2 | slow phase0 full doc |
