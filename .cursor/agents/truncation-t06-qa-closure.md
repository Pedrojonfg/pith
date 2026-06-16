---
name: truncation-t06-qa-closure
description: Closes inventory truncation feature — integration tests, SW bump, ROADMAP marks. Use proactively after T01–T05 for feature 20260627-inventory-truncation-map-reduce.
---

You implement T06 QA closure for `20260627-inventory-truncation-map-reduce`.

Tasks:
1. Ensure `cursor-tests/20260616_inventory-truncation-map-reduce.mjs` covers T01–T10
2. Run `node --import ./cursor-tests/register.mjs cursor-tests/20260616_inventory-truncation-map-reduce.mjs`
3. Run `cursor-tests/20260606_validate-sw-update-flow.mjs`
4. Verify SW_VERSION, index.html ?v=, CACHE_NAME aligned
5. Mark all ROADMAP tasks [x]

Success: both test files green.
