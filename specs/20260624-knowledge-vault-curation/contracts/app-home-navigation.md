# Contract: App Home Navigation

**Screens**: `screenAppHome`, `screenVaultBranch`

## Entry flow

```text
API key missing → screenApiSetup
API key present → screenAppHome (NEW default)
```

## screenAppHome

| Control | Action |
|---------|--------|
| Vault | `showScreen('vaultBranch')` |
| Sessions | `enterDocLibraryScreen()` |

## screenVaultBranch

| Control | Action |
|---------|--------|
| Knowledge Vault | Open existing vault panel/overlay (promoted from settings) |
| Review | `showScreen('reviewConfig')` then `runVaultSm2ReviewSession` |
| Back | `enterAppHome()` |

## Session Hub (screenModeSelect)

- Reached only via library document open or active session continuity
- Remove `#modeSelectHub` visibility when used as Session Hub (or remove hub entirely per spec)
- Add `#btnDownloadSessionMd`, `#btnUploadToVault`

## Breadcrumbs

- Session Hub: `[Project path] › [Document name]`
- Review from vault branch: `Review › [scope]`
