# Contract: debug-ui

**Module**: `src/js/vault/debug-ui.js`  
**Markup**: `index.html` (settings section)  
**Styles**: `src/css/main.css`

## Entry point

Settings screen → button **Knowledge Vault** → expand modal or inline panel.

## List view

| Column | Source |
|--------|--------|
| Concept | canonicalTitle |
| Topic | topic |
| Mastery | bar + % from getCurrentMastery |
| Last seen | relative time from lastSeen |
| Sources | sources.length |

- Topic filter dropdown (all unique topics in vault)
- Header: `Knowledge Vault — N concepts`

## Detail view (row click)

- aliases, prerequisites (resolved titles), last 10 observations

## Actions

- **Clear vault**: confirm dialog → `clearVault()` → refresh UI
- **Export JSON**: download `pith-knowledge-vault-{date}.json`

## Out of scope A+

- Manual edit mastery / merge / delete single entry
- Graph visualization

## Accessibility

- Table keyboard navigable; confirm dialog focus trap
