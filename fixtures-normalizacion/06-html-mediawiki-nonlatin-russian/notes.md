# Fixture 06: html-mediawiki-nonlatin-russian

**Source:** Russian Wikipedia "Тест Тьюринга" (Turing test) article, captured via Wayback Machine snapshot from 2021-01-16 (closest available snapshot to the requested 2020 date).

**Inspection method:** Direct grep/regex inspection of the raw HTML.

**Non-Latin script coverage:** Cyrillic. Confirmed 41 clean `mw-headline` heading strings extracted directly (e.g. "История", "Алан Тьюринг", "Достоинства теста").

**A NEW failure mode beyond fixture 05:** Because MediaWiki generates URL-anchor IDs from non-ASCII section titles using percent-encoded UTF-8 bytes, this snapshot has an *extra* legacy empty `<span id=".D0.92...">` immediately preceding the real `mw-headline` span inside every heading tag — a wrinkle that does not exist in the English snapshot (fixture 05). A heading-text extractor that naively grabs "the first span inside the heading" would get an empty string here, not just contaminated text. This is a materially different and arguably worse failure mode than fixture 05's.

**Table false positives:** Same pattern as fixture 05 — 2 `<table>` elements, both MediaWiki navbox/UI chrome (`navbox-inner` classes), re-confirmed independently on this document rather than assumed identical to fixture 05.

**Confidence:** High on structural claims (directly grepped). `needs_human_review: true` for the same reasons as fixture 05, plus the additional legacy-anchor-span wrinkle specific to non-Latin titles.
