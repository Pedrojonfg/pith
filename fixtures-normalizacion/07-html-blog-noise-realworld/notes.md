# Fixture 07: html-blog-noise-realworld

**Source:** Live Smashing Magazine article, "Users Don't Need More Tools: They Need Seamless Integrations" (July 2026), captured via in-browser Blob download of the full `<body>` element (not a text-only fetch), so real page chrome is preserved intact.

**Inspection method:** Direct grep of the raw HTML for heading tags, `<nav>` count, cookie-banner classes, and other noise markers.

**What's real here:** This is not a synthetic mockup — it's a snapshot of an actual, currently-live production page including its actual cookie-consent banner (with real accept/customize button markup), 5 real `<nav>` elements, a real embedded newsletter signup form, a real author bio box, real book/course promotional call-to-action boxes, and a real comments section.

**Notable finding:** Several non-article UI elements use heading tags whose CSS class disagrees with the tag's semantic level (e.g. `<h4 class="h2">Email Newsletter</h4>`, `<h2 class="h1">— Comments</h2>`). This is a realistic case of the visual/CSS heading level and the semantic HTML heading level pointing in different directions — worth checking whether Pith's heading-level inference trusts the tag name, the CSS class, or computed font-size (all three would give different answers here).

**Relationship to fixture 10:** Same source article. This fixture keeps the surrounding chrome (nav/cookie-banner/footer/newsletter/comments) to test noise-filtering; fixture 10 extracts just the `<article>` subtree to isolate the heading-nesting irregularity without noise as a confound.

**Confidence:** High on directly-grepped structural facts. Several individual heading confidence levels are marked `low`/`medium` in rubric.json specifically for the non-article chrome headings, since their exact expected treatment (include vs. exclude vs. flag) is a legitimate implementation choice rather than a single obviously-correct answer — this is not one of the two named weak-spot categories, so `needs_human_review` is false at the fixture level, but individual items are still honestly uncertain.
