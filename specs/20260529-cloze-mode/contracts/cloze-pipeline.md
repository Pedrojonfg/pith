# Contract: Cloze Generation Pipeline

**Feature**: `20260529-cloze-mode` | **FR**: FR-002a, FR-003, FR-004–007, FR-011

## Trigger

- Upload + normalización → `pipelineStatus: 'normalized'`.
- Botón **Generar ítems** → inicia fases 0–4.
- Sin IA automática en upload.

## Phases (sequential)

| Phase | Skip condition | Persist on success |
|-------|----------------|-------------------|
| 0 | Continuar sesión con `epistemicGraph` + `items` ready | `cloze.epistemicGraph` |
| 1 | — | `cloze.analysis` |
| 2 | — | ítems base en memoria |
| 3 | — | ítems + `options` |
| 4 | — | `cloze.items` + `pipelineStatus: 'ready'` |

## UI progress

- Label: `Generando ítems — Fase N/5: [nombre]`.
- Disable botón durante `generating` / `phase*`.
- On `failed`: mensaje + botón **Reintentar**.

## Output rules

- NODE items: solo nodos `importance ≥ 3`.
- EDGE items: aristas con `aptitude_score` ≥ umbral prompt.
- Post-QA: servir solo `qa_status === 'valid'`.
- Target balance: EASY 30%, MEDIUM 50%, HARD 20% (best effort).

## Distractors (v1)

- Primary: L1 nodes from `epistemicGraph`.
- Fallback: L3 synthetic when L1 insufficient.
- L2 vault: not implemented v1.

## Chunking

- Text ≤15k chars: full text per call.
- Text >50k: chunk by headings in phases 1–2 only.

## Module boundary

- `src/js/cloze/pipeline.js` — LLM calls + normalization to `ClozeItem[]`.
- `study.js` — orchestration, UI, persistence via `storeActiveSession`.
