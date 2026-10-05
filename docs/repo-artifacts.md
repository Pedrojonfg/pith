# Repo artifacts (non-app code)

| Path | Purpose |
|------|---------|
| `fixtures-normalizacion/` | Normalization QA inputs + rubrics — not loaded by the PWA. |
| `scripts/generate-icons.js` + `icon-*.png` | Dev script (`npm` devDependency `canvas`) to regenerate PWA icons from the brand mark. |
| `tests/rsvp-latex.html` | Manual page to check RSVP + KaTeX rendering. |
| `tests/js/` | Curated offline JS tests run by `npm test` / CI (see `package.json`). |
| `docs/media/demo.gif` | README demo loop (Pedro adds in T5; tracked under `docs/media/`). |

`progress/` is not in the tree; orchestrator still writes `progress/state.json` and `progress/run-log-*.md` at runtime (gitignored).

Debug instrumentation: append `?debugEnrich=1` or set `localStorage.pith_debug_enrich = "true"`. Vault debug UI: `?vaultDebug=1`.
