# Quickstart: Block Split Deduplication

**Feature**: `20260526-block-split-dedup`  
**Prereqs**: API key configured; material ≥ 2000 words with repeated topics (e.g. vector calculus notes).

## 1. Happy path — two-phase split

1. Open `index.html`, upload PDF/HTML with clear sections.
2. Set N=15, add study notes optional, generate blocks.
3. **Expect status sequence**: “Inventariando conceptos…” → “Empaquetando…” → “Comprobando duplicados…”
4. Block 1 title contains `Overview` or `Mapa del curso`.
5. Scan block list: no two blocks with same primary theorem name in title.
6. Confirm blocks → session proceeds as today.

## 2. Fewer blocks than N (SC-003)

1. Use short material (~1500 words), N=20.
2. After generate, summary shows: `Pediste 20; el material sustentó M bloques` with M < 20.
3. Editor shows M rows, not 20 padded entries.

## 3. Deterministic dedup (SC-004)

1. If split summary shows dedup merges, expand details — reason `signature_overlap` or `title_duplicate`.
2. Dev: run `cursor-tests/20260526_t01-deterministic-dedup.mjs` (after T07).

## 4. Fallback

1. Simulate: temporarily break phase-1 parser (dev flag) OR disconnect network mid-phase-1.
2. **Expect**: fallback message + monophasic split still lists blocks (no hard crash).

## 5. Regression

1. Import JSON block index (`indexWasImported`) — no two-phase split, no dedup merge.
2. Confirm blocks → generate block JSON — unchanged from pre-feature.

## Pass criteria

| ID | Check |
|----|-------|
| SC-001 | Subjective: less repeated formulas across blocks vs old build on same PDF |
| SC-002 | Block 1 is overview in ≥1 test run |
| SC-003 | M vs N message when M < N |
| SC-004 | Dedup test script green |
