# Data Model — Multi-File Upload

## uploadMeta extension

```js
// session.shared.uploadMeta
{
  fileName: string,        // legacy: first file name
  originalFormat: string,  // legacy: first file format
  uploadedAt: string,      // ISO
  bookMeta?: BookMeta,
  files?: SourceFileMeta[],
  sourceMap?: Record<string, string> // optional chunkIndex → fileId
}
```

## SourceFileMeta

| Field | Type | Notes |
|-------|------|-------|
| fileId | string | `f1`, `f2`, … stable within session |
| fileName | string | Original upload name |
| originalFormat | string | pdf \| html \| txt \| md |
| sizeBytes | number | From File.size |
| addedAt | number | ms epoch |

## Block provenance

```js
// modes.rsvp.blocks[] / modes.questions.blocks[]
{
  // ...existing fields
  sourceFileIds?: string[]  // omitted on legacy
}
```

## Recall / Cloze

```js
// modes.recall.questions[]
{ sourceFileId?: string }

// modes.cloze.items[]
{ sourceFileId?: string }
```

## Sentinel format

Between files in concatenated markdown:

```
\n\n---\n\n<!-- source: f2 -->\n\n
```

First file has no leading sentinel.

## Legacy migration

- `files` undefined → treat as single anonymous source
- `sourceFileIds` / `sourceFileId` undefined → omit on read paths
