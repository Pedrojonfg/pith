# Repo artifacts (non-app code)

| Path | Purpose |
|------|---------|
| `progress/` | Orchestrator runtime state (`state.json` gitignored). Empty dir is normal when the loop is not running. |
| `fixtures-normalizacion/` | Normalization QA inputs + rubrics — not loaded by the PWA. |
| `generate-icons.js` + `icon-*.png` | Dev script (`npm` devDependency `canvas`) to regenerate PWA icons from the brand mark. |
| `tests/rsvp-latex.html` | Manual page to check RSVP + KaTeX rendering. |
| `cursor-tests/` | Node integration checks referenced in `.cursorrules` (versioned). |
| `docs/demo-flow.gif` | README demo loop (add locally; not required for build). |

Debug instrumentation: append `?debugEnrich=1` or set `localStorage.pith_debug_enrich = "true"`. Vault debug UI: `?vaultDebug=1`.
