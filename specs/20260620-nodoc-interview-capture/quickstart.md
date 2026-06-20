# Quickstart: No-Document Interview Capture

## Manual QA

1. Open app → Library → Create session.
2. Click **I don't have a file for this**.
3. Confirm first question appears instantly (disable network — still works).
4. Enter session title, answer opener, submit.
5. Wait for follow-up (generating screen); answer again.
6. Click **Finish interview** → synthesis generating screen.
7. Land on mode select — **RSVP** and **Slow Mode** absent; **Cloze** and **Recall** present.
8. Open Cloze or Recall — session behaves like upload-origin with synthesized text.

## Edge cases

- Try finish after 1 answer → blocked with message.
- Let follow-ups reach cap (flag=4) → auto-synthesis.
- Simulate LLM failure (bad key) on follow-up → categorized error + retry.

## Regression

- Create upload-origin session (PDF/MD) → full mode select unchanged.

## Automated

```bash
node cursor-tests/20260620_nodoc-interview-capture.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```
