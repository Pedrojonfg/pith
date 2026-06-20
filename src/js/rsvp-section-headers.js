/**
 * RSVP structured section headers — development blocks only (20260620-rsvp-generation-pedagogy-hardening R5).
 */

export const RSVP_HEADER_POOL = Object.freeze({
  OPENING: Object.freeze([
    "What is it?",
    "The core idea",
    "Defining [concept]",
    "What's actually going on",
    "The basic idea",
    "Where this fits",
    "Setting the stage",
    "What we're talking about",
    "The key distinction",
    "Naming the problem",
    "The starting point",
    "What changed",
  ]),
  MECHANISM: Object.freeze([
    "How it works",
    "The mechanism",
    "Step by step",
    "Under the hood",
    "What drives this",
    "The process",
    "Cause and effect",
    "What makes it happen",
    "The logic behind it",
    "Breaking it down",
  ]),
  EXAMPLE: Object.freeze([
    "A concrete case",
    "In practice",
    "Seeing it in action",
    "A worked example",
    "Applying the idea",
    "The real-world version",
    "Putting it to use",
    "Where you'd see this",
    "A quick illustration",
    "Case in point",
  ]),
  CONTRAST: Object.freeze([
    "What it's not",
    "The common confusion",
    "The exception",
    "Where this breaks down",
    "Versus the alternative",
    "The trap to avoid",
    "A frequent mistake",
    "Where people get this wrong",
  ]),
  IMPLICATION: Object.freeze([
    "Why it matters",
    "What this means",
    "The takeaway",
    "The consequence",
    "What follows from this",
    "Why you should care",
    "The bigger picture",
    "What this enables",
    "The payoff",
    "Connecting the dots",
  ]),
});

/** Standalone markdown bold line used as a section header. */
export function isBoldHeaderLine(text) {
  return /^\*\*[^*\n]+\*\*$/.test(String(text || "").trim());
}

/** Count standalone bold header lines in an explanation. */
export function countStructuredHeaders(explanation) {
  return String(explanation || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(isBoldHeaderLine).length;
}

export function warnStructuredHeaderCount(explanation) {
  const n = countStructuredHeaders(explanation);
  if (n > 0 && (n < 2 || n > 4)) {
    console.warn(`RSVP headers: expected 2–4 bold section headers, found ${n}.`);
  }
}

export const EXPLANATION_RSVP_STRUCTURED_HEADERS = `STRUCTURED SECTION HEADERS (development blocks — mandatory format):
Use visible section signposts so the RSVP reader pauses at structural transitions. Headers live inside the explanation string only.

HEADER POOL (choose ONLY from these phrases — never invent new header text):
OPENING (pick exactly 1, always first): ${RSVP_HEADER_POOL.OPENING.join(" · ")}
MECHANISM (optional, middle): ${RSVP_HEADER_POOL.MECHANISM.join(" · ")}
EXAMPLE (include only when the source chunk provides a concrete example; otherwise omit the whole EXAMPLE section): ${RSVP_HEADER_POOL.EXAMPLE.join(" · ")}
CONTRAST (optional, only when grounded in source): ${RSVP_HEADER_POOL.CONTRAST.join(" · ")}
IMPLICATION (pick exactly 1, always last): ${RSVP_HEADER_POOL.IMPLICATION.join(" · ")}

SELECTION RULES:
- Exactly one OPENING header first; exactly one IMPLICATION header last.
- Total headers per block: minimum 2 (OPENING + IMPLICATION), maximum 4. Never reuse a band twice.
- EXAMPLE section only when the source provides a concrete case — same fidelity rule as before; the header appears only when the example section is included.
- MECHANISM and CONTRAST are optional; never add them purely to pad length.
- When multiple middle bands are used, order them as those ideas appear in the source — do not reorder for style.
- Translate the chosen header phrase into the study language (functional meaning preserved).

FORMAT (each section):
**Header Phrase**

Body paragraph(s) for that section.

(blank line before next header)

WORD BUDGET (body text only — exclude header phrases from the count):
- 2 headers used → 180–260 words total body
- 3 headers → 260–340 words
- 4 headers → 320–420 words
Each section ≥ ~40 words except CONTRAST (~30–60 words when brief).

WRITING RULES (still apply):
- Short sentences: max 15 words; one idea per sentence; no parentheses, semicolons, or em-dashes.
- Define technical terms on first use. Active voice. Source-fidelity rules supreme.
- When this block is not first, the OPENING section's first content sentence must bridge from the previous block title (provided in the user message).`;
