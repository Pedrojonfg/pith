# Quickstart: Read Mode

1. Upload a document with concept inventory ready.
2. Mode select → **Read** → Generate blocks.
3. Start session: full block text → **Continue to questions** → MCQ/Socratic as RSVP.
4. With images in source: verify `pith-image` token in block chunk pairs with figure.
5. With diagram-friendly content: verify optional Mermaid appears (may lag one block behind prefetch).

## Validate

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260705_read-mode.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260606_validate-sw-update-flow.mjs
```
