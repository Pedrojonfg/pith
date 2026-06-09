# Contract: Session Format Migration (html_min → markdown)

## Purpose

Definir migración lazy de sesiones Slow/Cloze guardadas con `normalizedFormat: "html_min"`.

## Trigger

Al cargar sesión desde `localStorage` o import JSON cuando:
```javascript
session.slow?.normalizedFormat === "html_min"
// o
session.cloze?.normalizedFormat === "html_min"
```

## Algorithm

```javascript
function migrateLegacyHtmlMinSession(session) {
  const slot = session.slow || session.cloze;
  if (!slot || slot.normalizedFormat !== "html_min") return session;
  if (slot._migratedFromHtmlMin) return session;

  const text = String(slot.normalizedTextFull || slot.normalizedText || "");
  const markdown = htmlMinToMarkdown(text); // headings h1-h6 → #, p → párrafos
  slot.normalizedTextFull = markdown;
  slot.normalizedText = markdown; // si aplica
  slot.normalizedFormat = "markdown";
  slot._migratedFromHtmlMin = true;
  return session;
}
```

## htmlMinToMarkdown (determinístico)

1. Parse DOM o regex sobre tags permitidos (`h1-h6`, `p`, `li`, `br`).
2. `<hN>` → `#`.repeat(N) + label
3. `<p>` → párrafo + `\n\n`
4. `<li>` → `- ` + texto
5. Strip tags restantes → texto plano

## Non-goals

- No re-normalizar desde archivo fuente (no disponible).
- No garantizar equivalencia bit-a-bit con re-upload.

## Acceptance mapping

- FR-006, SC-004
