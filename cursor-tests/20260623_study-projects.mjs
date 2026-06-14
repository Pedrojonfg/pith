/**
 * Study Projects integration tests — feature 20260623-study-projects
 * Run: node --import ./cursor-tests/register.mjs cursor-tests/20260623_study-projects.mjs
 */
import {
  assignSessionToProject,
  createProject,
  deleteProject,
  getAncestorChain,
  getDescendantIds,
  getProjectTree,
  getSessionsByProject,
  moveProject,
  renameProject,
  PROJECT_ERROR_CYCLE,
  PROJECT_ERROR_DELETE_BLOCKED,
  PROJECT_ERROR_EMPTY_NAME,
  ensureMiscProject,
} from "../src/js/project-store.js";
import {
  buildVaultContextBlock,
  getProjectScopeDepth,
} from "../src/js/vault/prompt-injection.js";
import {
  filterDueSmItems,
  getReviewableItemsForProject,
} from "../src/js/review-project-scope.js";
import { MISC_PROJECT_ID, validateDocumentSession } from "../src/js/session-types.js";
import { LS_DOC_SESSIONS_KEY, LS_PROJECTS_KEY } from "../src/js/config.js";
import { migrateProjects } from "../src/js/session-migration.js";
import { resetStorage } from "./setup-dom.mjs";

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

function makeStore() {
  return ensureMiscProject({ schemaVersion: 1, projects: [] });
}

function makeSession(docId, projectId) {
  return {
    docId,
    schemaVersion: 2,
    projectId,
    createdAt: 1,
    updatedAt: 1,
    shared: {
      rawMarkdown: "# Hi",
      docMeta: { titleInferred: "Hi", charCount: 4, language: "en", estimatedGenre: "unknown" },
      conceptInventory: [],
      annotations: [],
      smItems: [{ id: "sm1", sourceType: "rsvp_block", sourceId: "b1", docId, title: "T" }],
    },
    modes: { rsvp: null, slow: null, cloze: null, questions: null, recall: null },
  };
}

// --- T01 / FR-003: types & validation ---
assert(MISC_PROJECT_ID === "misc", "MISC_PROJECT_ID is misc");

{
  const legacy = makeSession("abc", undefined);
  delete legacy.projectId;
  assert(validateDocumentSession(legacy).ok, "happy: session without projectId validates");
}

{
  const withProject = makeSession("abc", "algebra");
  assert(validateDocumentSession(withProject).ok, "happy: session with projectId validates");
}

{
  const bad = makeSession("abc", "");
  assert(!validateDocumentSession(bad).ok, "failure: empty projectId rejected");
}

// --- T02 / FR-001, FR-006, FR-007: project store ---
{
  const store = makeStore();
  const root = createProject(store, "Algebra", null);
  const child = createProject(store, "Unit 3", root.ok ? root.project.id : null);
  assert(root.ok && child.ok, "happy: create root + subproject");

  const chain = getAncestorChain(store, child.project.id);
  assert(chain[0]?.id === child.project.id, "happy: ancestor chain starts at self");
  assert(chain.some((p) => p.id === root.project.id), "happy: ancestor chain includes parent");

  const descendants = getDescendantIds(store, root.project.id, { includeSelf: true });
  assert(descendants.includes(child.project.id), "happy: descendant ids include child");

  const cycle = moveProject(store, root.project.id, child.project.id);
  assert(!cycle.ok && cycle.error === PROJECT_ERROR_CYCLE, "failure: cycle reparent rejected");

  const miscMove = moveProject(store, MISC_PROJECT_ID, root.project.id);
  assert(miscMove.ok, "edge: misc reparent is no-op success");

  assert(deleteProject(store, MISC_PROJECT_ID, []).ok, "edge: misc delete is no-op");

  const blockedChild = deleteProject(store, root.project.id, []);
  assert(!blockedChild.ok && blockedChild.error === PROJECT_ERROR_DELETE_BLOCKED, "failure: delete with children blocked");

  const emptyName = renameProject(store, root.project.id, "   ");
  assert(!emptyName.ok && emptyName.error === PROJECT_ERROR_EMPTY_NAME, "failure: empty rename rejected");

  const tree = getProjectTree(store);
  assert(tree.length >= 2, "happy: project tree has multiple roots");
}

// --- FR-004: session assignment ---
{
  const store = makeStore();
  const p = createProject(store, "Physics", null);
  const session = makeSession("doc1", MISC_PROJECT_ID);
  const assigned = assignSessionToProject(session, p.project.id, store);
  assert(assigned.ok && assigned.session.projectId === p.project.id, "happy: assignSessionToProject");
  const invalid = assignSessionToProject(session, "missing-id", store);
  assert(!invalid.ok, "failure: assign to missing project rejected");
}

// --- T03 / edge case: migration idempotent ---
try {
  migrateProjects();
  migrateProjects();
  assert(true, "happy: migrateProjects idempotent");
} catch (err) {
  assert(false, `failure: migrateProjects threw: ${err?.message || err}`);
}

// --- T04 / FR-010: vault scope depth & bands ---
{
  const ancestorIds = ["unit", "algebra"];
  const docMap = new Map([
    ["d1", "unit"],
    ["d2", "algebra"],
    ["d3", "other"],
  ]);
  assert(
    getProjectScopeDepth({ sources: [{ docId: "d1" }] }, ancestorIds, docMap) === 0,
    "happy: same project depth 0",
  );
  assert(
    getProjectScopeDepth({ sources: [{ docId: "d2" }] }, ancestorIds, docMap) === 1,
    "happy: parent project depth 1",
  );
  assert(
    getProjectScopeDepth({ sources: [{ docId: "d3" }] }, ancestorIds, docMap) === Infinity,
    "edge: unrelated depth Infinity",
  );

  const block = buildVaultContextBlock([
    { entry: { canonicalTitle: "Same", sources: [{ docId: "d1" }] }, scopeDepth: 0 },
    { entry: { canonicalTitle: "Related", sources: [{ docId: "d2" }] }, scopeDepth: 1 },
    { entry: { canonicalTitle: "General", sources: [{ docId: "d3" }] }, scopeDepth: Infinity },
  ]);
  assert(block.includes("Same-subject mastery"), "contract: same-subject band label");
  assert(block.includes("Related-subject mastery"), "contract: related band label");
  assert(block.includes("General mastery"), "contract: general band label");
}

// --- T05 / FR-008, FR-009: review scope ---
{
  resetStorage();
  const store = makeStore();
  const a = createProject(store, "Project A", null);
  const b = createProject(store, "Project B", null);
  const child = createProject(store, "A-child", a.project.id);
  const sessions = [
    makeSession("d1", a.project.id),
    makeSession("d2", child.project.id),
    makeSession("d3", b.project.id),
  ];
  localStorage.setItem(LS_DOC_SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(store));

  assert(Array.isArray(getReviewableItemsForProject("all")), "happy: all scope returns array");
  assert(getReviewableItemsForProject("all").length === 3, "happy: all scope three smItems");

  const scopedDirect = getSessionsByProject(store, sessions, a.project.id, {
    includeDescendants: false,
  });
  assert(scopedDirect.length === 1 && scopedDirect[0].docId === "d1", "happy: direct project sessions only");

  const scopedTree = getReviewableItemsForProject(a.project.id, { includeDescendants: true });
  assert(scopedTree.length === 2, "happy: include subprojects aggregates smItems");

  const scopedNoDesc = getReviewableItemsForProject(a.project.id, { includeDescendants: false });
  assert(scopedNoDesc.length === 1, "edge: exclude subprojects limits items");

  const dueOnly = filterDueSmItems([
    { scheduledDue: Date.now() - 1000 },
    { scheduledDue: Date.now() + 86400000 * 30 },
  ]);
  assert(dueOnly.length === 1, "happy: filterDueSmItems keeps due items");
}

console.log(`\nStudy projects tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
