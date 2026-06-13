# Contract: misconception-detection

**Modules**: `src/js/vault/misconceptions.js`, `session-close.js`, `prompt-injection.js`, `api.js`  
**FR**: FR-301–FR-304

## Observation capture (session-close)

Extend `collectObservations` to set:
- `wrongAnswer` from MCQ selected option text
- `taskKind` per research R4

## Detection

```javascript
detectMisconceptionsForEntry(entry) → Misconception | null
```

Rules:
- Filter negative obs last 30 days
- Group by `wrongAnswer` or `wrongAnswerPattern`
- If largest group size ≥ 3 → call `api.detectMisconceptionPattern(entry, group)` OR rule-based description
- Append misconception if confidence ≥ 0.6

## Resolution

```javascript
markMisconceptionResolved(entryId, misconceptionId) → void
```

Auto-resolve when 3 consecutive positive obs after detection (optional v1).

## Prompt injection

`buildVaultContextBlock` appends for entries with active misconceptions:

```text
Known misconception for "{title}": {description}. Design explanation to contrast correct vs incorrect understanding.
```

## Session-close hook

After `applyObservations`, run `detectMisconceptionsForEntry` per touched entry (max 1 LLM call/session).
