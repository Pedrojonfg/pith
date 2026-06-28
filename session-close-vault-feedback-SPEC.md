# Spec: Retrieval Hub — Session Close Moment with Vault Feedback

**Date:** 2026-06-28  
**Status:** Ready for implementation  
**Priority:** Medium ([C])  
**Supersedes:** Nothing  
**Related specs:** `20260622-exposure-retrieval-hub`, `20260618-knowledge-vault-a-plus`, `20260626-cross-doc-vault`

---

## Context

`screenRetrievalHub` currently acts as a navigation hub after a study session ends — it offers buttons to continue with Questions, Cloze, or Recall. It is a functional screen but a cold one: it doesn't tell the user anything about what just happened or what they've built.

The idea behind this spec is to turn the hub into a **session closing moment**: a brief, warm summary of what the vault gained during this session. Not a gamification dashboard — Pith defaults to Focus Mode — but a quiet confirmation of progress: "you added 3 concepts to your vault today."

This is motivationally important because the vault is the core long-term value proposition. Making it visible at the moment of closure connects the short-term effort (study session) to the long-term payoff (knowledge that persists and compounds).

---

## Goal

At the top of `screenRetrievalHub`, before the mode selection buttons, show a compact summary of vault changes that occurred during the current session. This summary must be computed from real data — concepts actually promoted or reinforced — and must feel like a closing statement, not a score.

---

## What "vault changes during this session" means

Every time the user studies a concept and gets it right (in any mode), the concept is either:
- **Added** to the vault for the first time ("promoted"), or
- **Reinforced** — already in the vault, SM-2 interval updated.

The session close summary groups these into two numbers:
- N concepts **added** this session
- M concepts **reinforced** this session

And optionally (if N > 0) shows the names of the added concepts as a short list.

---

## Data sourcing

### Step 1 — Cursor must inspect the following before implementing

Since the app has migrated to Supabase, the vault and session data may now live in Supabase tables rather than (or in addition to) localStorage. Before writing any code, Cursor must:

1. **Inspect `vault-store.js`** — determine whether vault entries are read/written to Supabase, localStorage, or both. Identify the function used to query vault entries (e.g. `getVaultEntry()`, `getAllVaultEntries()`, or a Supabase query).

2. **Inspect `session-store.js`** — determine the current session identifier (docId, sessionId, or equivalent) and how the currently active session is referenced at the time `screenRetrievalHub` is shown.

3. **Inspect `vault-store.js` event/history fields** — determine whether individual vault events carry a `sessionId` or timestamp that can be used to filter "events from this session". Candidates:
   - `entry.history[].sessionId`
   - `entry.history[].ts` (timestamp, filterable against session start time)
   - A top-level `entry.addedInSession` flag set during promotion
   - None of the above (see fallback below)

4. **Inspect the promotion call sites** — find where concepts are promoted to the vault during study (likely in `cloze/study.js`, `recall-study.js`, `rsvp.js`, `slow/phase3.js`, or `sm2-ingest.js`). Confirm what data is passed to the vault write at promotion time.

### Step 2 — Determine the session boundary

The session close summary needs to know "what happened in this session". There are two approaches; Cursor must pick whichever matches the actual data:

**Option A — Session ID tagging:** If vault events carry a `sessionId` that matches the current `docId` or session identifier, filter vault entries by that ID.

**Option B — Timestamp window:** If no session ID exists on vault events, use a timestamp window. The session start time should be available in the session object (e.g. `session.createdAt` or a `studyStartedAt` field). Filter vault events where `event.ts >= sessionStartTime`.

**Option C — In-memory accumulation:** If neither A nor B is viable (e.g. vault events have no timestamp or session tag), maintain a small in-memory array during the session that accumulates promoted/reinforced concept IDs. This array lives in `window` or a module-level variable, is reset on session start, and is read when `screenRetrievalHub` renders. This is the least desirable option but is acceptable as a fallback.

Cursor must document which option it used in a brief inline comment at the implementation site.

---

## Rules

### R1 — Summary panel location and structure

The summary panel appears at the top of `screenRetrievalHub`, above the mode buttons. It is always visible when the hub renders after a completed session. It must not appear if the hub is accessed without a preceding session (edge case — guard against null/empty data gracefully by showing nothing rather than crashing).

### R2 — Content when N added > 0

```
┌─────────────────────────────────────────┐
│  New in your vault                      │
│                                         │
│  ● Concept name one                     │
│  ● Concept name two                     │
│  ● Concept name three                   │
│                                         │
│  + 4 concepts reinforced                │
└─────────────────────────────────────────┘
```

- Header: **"New in your vault"** (if N > 0) or **"What you learned this session"** (if N = 0 but M > 0, i.e. only reinforcements)
- Added concept names: bulleted list, max 5 names shown. If more than 5 were added, show "● Concept one … and 3 more" as the last entry.
- Reinforced count: shown as a secondary line below, muted text ("+ M concepts reinforced"). If M = 0, omit this line.
- All UI text in English (interface language). Concept names are rendered as stored — they reflect the document language.

### R3 — Content when nothing changed (N = 0 and M = 0)

If the session produced no vault changes (e.g. the user exited early, or all questions were incorrect), show a brief encouraging message instead of the concept list:

```
┌─────────────────────────────────────────┐
│  Keep going — concepts will land in     │
│  your vault as you study.               │
└─────────────────────────────────────────┘
```

Copy: **"Keep going — concepts will land in your vault as you study."**  
Tone: neutral encouragement, not a consolation prize. No emoji, no exclamation marks.

### R4 — Tone and design

- No confetti, no animation, no celebration. Focus Mode defaults apply.
- Panel background: slightly elevated surface — use existing card/panel CSS variable if one exists, or a subtle 1px border with `--color-surface` or equivalent. Do not invent new design tokens.
- Font sizes: header at body size (not a heading), list items at small/muted size.
- DM Sans throughout.
- The panel must compress gracefully on narrow viewports — no horizontal overflow.

### R5 — Data is read-only

This spec does not change how or when concepts are promoted or reinforced. It only reads existing vault data. Do not add any new write operations.

### R6 — Supabase compatibility

If vault data is now in Supabase (confirmed in Step 1 above), the query to fetch session vault changes must go through the existing vault-store abstraction layer — do not write raw Supabase queries inline in the UI code. If `vault-store.js` doesn't expose a suitable read function, add one there.

### R7 — No blocking render

The hub must render immediately (mode buttons visible) even if the vault summary is still loading. If vault data requires an async fetch (Supabase), show a brief skeleton or simply nothing in the panel slot until data resolves, then insert the panel. Do not block the entire screen on the vault fetch.

---

## Non-goals

- No streak counter, XP, or gamification elements.
- No breakdown by mode ("you added 2 via Cloze, 1 via Recall").
- No historical comparison ("more than last session").
- No click-through to individual concept details from this panel.
- No changes to the mode selection buttons below.

---

## Files likely touched

| File | Change |
|------|--------|
| `index.html` | Add summary panel markup inside `screenRetrievalHub` |
| `study.js` (or retrieval hub entry function) | Wire vault summary computation on hub render |
| `vault-store.js` | Possibly add a `getSessionVaultChanges(sessionId, since)` read function |
| `src/css/main.css` or hub CSS | Panel styles |

---

## Design decisions (resolved)

- **Panel title:** "New in your vault" (added) / "What you learned this session" (reinforced only) — avoids "today" since sessions don't map cleanly to calendar days.
- **Language:** English throughout (interface language). Concept names render in the document language as stored.
- **Reinforced concepts:** shown as a secondary count line below the added list, not as individual names.
- **Empty state:** encouraging neutral message ("Keep going…"), not silence and not a score.

---

## SW / cache bump checklist

- [ ] `?v=` bumped on every modified JS file imported in `index.html`
- [ ] `SW_VERSION` bumped in `sw-update.js`
- [ ] `CACHE_NAME` bumped in `sw.js`
