# Contract: Dev Wipe

**Module**: `src/js/dev/wipe-user-data.js`  
**Docs**: `scripts/dev-wipe-user-data.md`

## Usage (browser, localhost, signed in)

```javascript
const { wipeUserDevData } = await import("./src/js/dev/wipe-user-data.js");
await wipeUserDevData({ confirm: true });
```

## Behavior

1. Resolve user from `supabase.auth.getUser()`.
2. Delete user rows from `document_sessions` (+ optional aux tables).
3. Delete storage objects under `markdown_files/{userId}/`.
4. Remove matching `localStorage` keys (preserves `sb-*` auth tokens).
5. Optional page reload.

## Safety

- Requires `{ confirm: true }`.
- Blocked outside localhost unless `forceOnNonLocalhost: true`.
- Does NOT delete `document_preparation_cache` (shared global DPP cache).
- Does NOT sign the user out.

## Options

See `scripts/dev-wipe-user-data.md`.
