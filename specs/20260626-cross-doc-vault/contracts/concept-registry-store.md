# Contract: concept-registry-store

**Module**: `src/js/concept-registry/registry-store.js`

## Exports

```javascript
export const REGISTRY_STORAGE_KEY = 'mylearning_concept_registry';
export const REGISTRY_SCHEMA_VERSION = 1;

export function loadRegistry(): ConceptRegistry;
export function saveRegistry(registry: ConceptRegistry): void;
export function getConceptById(id: string): Concept | null;
export function getConceptBySlug(slug: string): Concept | null;
export function findConceptCandidates(name: string, description?: string): Concept[];
export function upsertConcept(concept: Concept): Concept;
export function addSourceDocId(conceptId: string, docId: string): void;
export function upsertFacetSchedule(conceptId: string, schedule: ConceptFacetSchedule): void;
export function appendContentBlock(conceptId: string, block: ConceptContentBlock): void;
export function supersedeContentBlock(conceptId: string, oldBlockId: string, newBlockId: string): void;
export function appendObservation(obs: VaultObservation): void;
export function getAllConcepts(): Concept[];
export function getDueFacetSchedules(asOf?: Date): Array<{ concept: Concept; schedule: ConceptFacetSchedule }>;
```

## Invariants

- No concept with `maturity: 'gray'` in registry.
- `slug` unique among active concepts.
- `saveRegistry` atomic via localStorage single key.
- `getDueFacetSchedules` returns items where `dueDate <= asOf`.
