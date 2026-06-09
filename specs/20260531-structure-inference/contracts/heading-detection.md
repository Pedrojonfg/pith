# Contract: Heading Detection & Emission

## Purpose

Convertir bloques en headings markdown (`#`–`######`) o html_min (`<h1>`–`<h6>`).

## Scoring (MUST implement)

| Signal | Points | Condition |
|--------|--------|-----------|
| Font size ratio | 0–30 | `(fontSize / bodyFontSize - 1) * 100`, cap 30, min 0 |
| Bold | 0–15 | fontWeight ≥600 o fontName matches /bold/i |
| Short line | 0–10 | wordCount ≤12 |
| No sentence end | 0–10 | no trailing `.` `,` `;` |
| Numbered pattern | 0–20 | `^\d+(\.\d+)*\.?\s+[A-ZÁÉÍÓÚÑ]` o roman |
| ALL CAPS | 0–10 | 2–10 words, all upper |
| Section keyword | 0–10 | Introduction, Abstract, Conclusiones, … |
| Outline match | 100 | título coincide con outline entry |
| Footer/header zone | -50 | bbox en zona artifact |

**Threshold**: `score >= 35` → heading (except outline → always accept)

## Level assignment

1. Collect distinct `fontSize` among accepted headings
2. Sort descending → map to levels 1..6 (clamp)
3. Outline depth in tree → override level when available
4. Post-process: no H1 followed immediately by H1; demote stacked headings

## Emission — Markdown

```markdown
## Section Title

Body paragraph...
```

- Prefix: `#`.repeat(level) + space + label
- Blank line before and after heading
- Strip numbering from label optional (config `preserveNumbers: true` default)

## Emission — html_min

```html
<h2>Section Title</h2>
```

- Level maps 1:1 to tag
- No attributes on heading tags

## parseHeadings compatibility

Emitted output MUST be parseable by extended `parseHeadings`:
- Markdown: `/^(#{1,6})\s+(.+)$/gm`
- HTML: `/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi`

## Acceptance mapping

- FR-003, FR-004, FR-005, FR-006, FR-008, SC-001, SC-002, SC-005
