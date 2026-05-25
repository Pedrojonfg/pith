# Quickstart: Assessment-Informed Block Content

## Prerequisites

- API key in localStorage (setup screen).
- Material uploaded; blocks confirmed.
- Online mode (not offline pack) for gap synthesis.

## Happy path

1. Open `index.html`, complete block split, confirm blocks.
2. Take initial assessment (e.g. 20 questions, penalise on).
3. On results overlay:
   - Wait for “Gaps ready” (≤30s) or accept after timeout message.
   - Optionally expand **Review gaps** and edit labels.
4. Click **Accept suggestions** → **Start generating**.
5. Study block 1:
   - **Strong** block: RSVP recap is shorter (~150–220 words).
   - **Weak** block with listed gaps: thorough explanation; questions mention gap topics.

## Regression: skip assessment

1. Confirm blocks → **Start studying without assessment**.
2. Verify explanations still use thorough 400–600w prompt and default question counts.

## Inspect session state (DevTools)

```js
JSON.parse(localStorage.getItem('active_session'))._meta.assessment
JSON.parse(localStorage.getItem('active_session')).blocks[0]._config
```

Expect `explanation_profile`, `gap_focus`, `gaps_by_block` after accept.

## Export check

Close tab or **Save session** → open `.md` → section **Initial Assessment** includes gap summary.

## Failure injection

- Throttle network: accept after 30s → session still starts; `synthesis_status: timeout`.
- Revoke API key before assessment: skip path only.
