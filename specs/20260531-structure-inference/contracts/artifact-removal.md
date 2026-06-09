# Contract: Artifact Removal (Page Numbers & Headers/Footers)

## Purpose

Eliminar números de página, running headers/footers y marcas editoriales sin borrar contenido del cuerpo.

## Inputs

- `TextBlock[]` con `bbox`, `pageIndex`, `text`, `fontSize`
- `pageCount` (PDF)
- Config opcional: `headerZoneRatio: 0.10`, `footerZoneRatio: 0.10`

## Rules (apply in order)

### R1 — Zona vertical (PDF/HTML con bbox)

- Si `bbox.y < pageHeight * headerZoneRatio` → candidato artifact
- Si `bbox.y + bbox.height > pageHeight * (1 - footerZoneRatio)` → candidato artifact

### R2 — Repetición inter-página

- Normalizar texto: lowercase, collapse whitespace
- Si misma cadena (o similitud ≥0.9) aparece en ≥70% de páginas en zona header/footer → artifact `running_header` / `running_footer`

### R3 — Regex (todos los formatos, líneas aisladas)

MUST match solo líneas completas (trim):

| Pattern | Code |
|---------|------|
| `^\d{1,4}$` | `page_number` |
| `^[-–—]\s*\d{1,4}\s*[-–—]$` | `page_number_decorated` |
| `^page\s+\d+(\s+of\s+\d+)?$`i | `page_number_labeled` |
| `^p\.?\s*\d+$`i | `page_number_short` |
| `^\d+\s*\/\s*\d+$` | `page_fraction` |
| `^[ivxlcdm]+$`i (len ≤6) | `page_number_roman` |

### R4 — Marcas editoriales (zona margen o línea corta)

- DOI, `doi.org`, `©`, `copyright`, `Downloaded by [`
- Publishers: Springer, Elsevier, Cambridge University Press, etc.

### R5 — Protecciones (MUST NOT remove)

- Línea con ≥4 palabras en zona central (`0.15 < y < 0.85`)
- Patrón de sección: `^\d+(\.\d+)+\s+\S` con palabras ≥2
- Línea que es `HeadingCandidate` con score ≥35

## Output

- Bloques con `kind: "artifact"` excluidos de emisión
- `StructureReport.artifactsRemoved` incrementado
- Opcional: log en `warnings` si muchos candidatos en zona central rechazados (`layout_complex`)

## Acceptance mapping

- FR-002, SC-003, SC-004
