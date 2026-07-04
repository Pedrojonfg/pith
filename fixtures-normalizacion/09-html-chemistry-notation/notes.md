# Fixture 09: html-chemistry-notation

**Source:** English Wikipedia "Aspirin" article — lead section + Chemical properties (incl. Synthesis) + Physical properties (incl. Polymorphism) sections, captured live via in-browser DOM extraction.

**Inspection method:** Direct grep of the raw HTML for heading tags, infobox/chembox class names, `<table>` count, and `<sub>`/`<sup>`/`<math>`/`mwe-math` occurrences.

**Key finding — corrects an assumption:** I expected (going in) that Wikipedia chemistry infoboxes would use a distinct `chembox` CSS class. Direct inspection shows this is wrong for the current live Wikipedia markup: the infobox uses the generic `class="infobox"` (with `infobox-header`, `infobox-data`, `infobox-full-data`, `infobox-caption` sub-classes). Any implementation hardcoded to look for a literal `chembox` string would silently fail to recognize this element.

**Key finding — math notation representation:** Zero `<math>` tags and zero `mwe-math` (Wikipedia's rendered-LaTeX-image class) appear anywhere in this document. Chemical formulas and unit exponents are expressed with plain HTML `<sub>`/`<sup>` tags instead (e.g. `C<sub>9</sub>H<sub>8</sub>O<sub>4</sub>`, `g·mol<sup>−1</sup>`). This is a structurally different "math-like" representation than the LaTeX-heavy PDFs in fixtures 01/02, and directly tests whether Pith's math-detection heuristic (built and tuned against LaTeX/MathML, presumably) also recognizes this HTML-native chemical notation. I flagged this `needs_human_review: true` since there's no single obviously-correct answer — it depends on Pith's intended scope — but the detector's behavior here should be a deliberate choice, not an untested blind spot.

**Table shape:** The infobox is fundamentally a key-value (property/value) structure, not a multi-row dataset like fixture 08's Nobel laureates table. Whether this should even be reported as "a table" by Pith is a legitimate open question, marked `confidence: medium` in the rubric.

**Confidence:** High on all directly-verified structural facts; medium specifically on how the infobox table should be scored, honestly reflecting genuine ambiguity rather than forcing a false certainty.
