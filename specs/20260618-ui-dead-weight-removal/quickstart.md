# Quickstart — UI Dead Weight Removal

1. Hard-reload (incognito) — no console errors on load.
2. First boot without API key → `screenSettings` with onboarding banner.
3. Save keys → lands on app home.
4. ⚙ opens settings from any screen; ← Back returns to prior screen.
5. `+` visible only on App Home, Library, Mode Select.
6. Export icon visible only on Complete, Test, Socratic.
7. Mode select: no upload CTA, no duplicate persist banner, ← Back to home.
8. Complete screen: "Your session has been saved." — no Save session button.
9. Library: "Quick review" button (not "Review").
10. Run: `node --import ./cursor-tests/register.mjs cursor-tests/20260618_ui-dead-weight-removal.mjs`
