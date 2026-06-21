# Data Model: Pedagogical Principles Layer

## ConceptInventoryEntry (extends shared.conceptInventory[])

| Field | Type | Notes |
|-------|------|-------|
| questionClass | `'factual' \| 'conceptual' \| null` | Set at DPP; null = unclassified |
| comprehensionConfirmed | `boolean` | Default false; factual bypasses gate |
| noveltyScore | `number \| null` | Existing (embedding layer) |

## SmItem (extends shared.smItems[])

| Field | Type | Notes |
|-------|------|-------|
| reviewProvenance | `'document' \| 'gap_fill' \| 'mnemonic' \| 'vault_curation'` | Default `document` |
| sourceType | existing | Unchanged (rsvp_block, etc.) |
| lastMissAt | `number \| null` | Optional; for WhyThisCard |

## ConceptSpan (runtime, not persisted)

| Field | Type |
|-------|------|
| conceptId | string |
| start | number |
| end | number |
| noveltyScore | number \| null |
| familiar | boolean |

## Config (PEDAGOGICAL_FLAGS)

See `src/js/config/flags.js` — all thresholds from spec §10.
