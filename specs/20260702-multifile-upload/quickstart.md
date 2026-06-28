# Quickstart QA — Multi-File Upload

## Single-file regression

1. Create session with one PDF.
2. Confirm DPP completes and mode select appears.
3. Legacy session without `files` loads from library.

## Multi-file staging

1. Add 2 files — both rows visible with sizes.
2. Remove second file — list updates.
3. Add until 5 — "Add another" hidden.
4. Session name from first file; edit name — not overwritten on add.

## Multi-file DPP

1. Continue with 2 small txt files.
2. Inventory/graph populated from combined text.

## Provenance (dev console)

1. After RSVP pack, inspect block `sourceFileIds` for 2-file session.

## Slow scope

1. Multi-file session → Slow → file selector visible.
2. Switch file → section list changes.
3. Single-file session → no selector.
