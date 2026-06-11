# Contract: Bootstrap Create Screen UI

Minimal DOM/copy contract — no visual redesign.

## States

| State | Visible elements | Hidden elements |
|-------|------------------|-----------------|
| `upload_required` | `#generateBlocksForm`, file input | — |
| `bootstrap` | Material loaded banner, mode CTA | File input (`#studyFileInput` or equivalent) |
| `resume` | `#modeResumePanel` OR direct resume screen | Upload form |

## New / reused elements

| ID / class | Purpose |
|------------|---------|
| `#modeMaterialLoadedBanner` | `hidden` by default; shown on bootstrap |
| `.mode-material-loaded-title` | Document title from `docMeta.titleInferred` |
| `.mode-material-loaded-meta` | e.g. “Loaded from recommendation — no need to upload again” |

Copy (EN, consistent with app):

- Banner title: `Document ready`
- Banner body: `Your material is already loaded for this study mode.`
- RSVP CTA unchanged: `Generate blocks`
- Cloze CTA unchanged: `Generate items` / `Upload and continue →` → rename to `Continue with loaded material →` when bootstrapped

## `ui.js`

Add refs:

```js
modeMaterialLoadedBanner: document.getElementById('modeMaterialLoadedBanner'),
```

## Rules

- Bootstrap MUST NOT trigger file picker automatically
- Bootstrap MUST NOT call LLM until user clicks Generate
- Switching mode with active doc re-evaluates bootstrap vs resume
