# Quickstart QA: Study Projects

**Feature**: `20260623-study-projects` | **Branch**: `20260623-study-projects`

## Prerequisites

- App served locally (or PWA dev build)
- At least 2 existing documents in library (legacy, no projectId)
- Knowledge Vault with entries from 2+ documents (optional for GKV tests)
- DevTools → Application → localStorage visible

## 1. Migration smoke

- [ ] Hard refresh after deploy
- [ ] `localStorage['mylearning_projects']` exists with `misc` project
- [ ] All sessions in store have `projectId: 'misc'`
- [ ] Second refresh — no duplicate misc, no data loss

## 2. Project CRUD

- [ ] Library → `New Project` "Algebra II" appears at root
- [ ] Inside Algebra II → `New Subproject` "Unit 3"
- [ ] Rename Misc → "Uncategorized" (still non-deletable)
- [ ] Attempt delete Misc → blocked
- [ ] Attempt move subproject into its own child → error message shown

## 3. Document assignment

- [ ] Upload new doc from root hub → defaults to Misc/Uncategorized
- [ ] Upload from inside "Unit 3" → defaults to Unit 3
- [ ] `Move to project…` on existing doc → appears under target in library

## 4. Library navigation

- [ ] Root shows top-level projects
- [ ] Drill into subproject shows documents at that level only
- [ ] Breadcrumb clickable back to ancestors
- [ ] Document tap → mode select with project breadcrumb

## 5. Mode select hub

- [ ] General home shows Continue / Library / Review
- [ ] Library button opens project browser
- [ ] Review button opens review config

## 6. Scoped review

- [ ] Create due smItems on docs in Project A and Project B
- [ ] Review scope "All subjects" → both appear
- [ ] Scope Project A + Include subprojects → only A items
- [ ] Scope Project A, subprojects off → only direct assignments

## 7. GKV context priority (manual / test)

- [ ] Document in Project A generates pack with vault context
- [ ] Same-project entries appear in "Same-subject mastery" band before unrelated
- [ ] Unrelated entries still present in "General mastery" band

## 8. Regression

- [ ] docTopics still populated on new uploads
- [ ] Mode continuity / retrieval hub still works from library document
- [ ] SM-2 review (all subjects) unchanged when scope is All
- [ ] Run `node cursor-tests/20260623_study-projects.mjs` — all pass
- [ ] Run `node cursor-tests/20260606_validate-sw-update-flow.mjs` after SW bump

## Sign-off

| Role | Date | OK |
|------|------|-----|
| Dev | | |
| QA | | |
