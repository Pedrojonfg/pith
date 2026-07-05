/**
 * Pure project tree helpers and mutations.
 * @see specs/20260623-study-projects/contracts/project-store-api.md
 */

export const PROJECT_ERROR_CYCLE = "Cannot move a project into its own subproject";
export const PROJECT_ERROR_DELETE_BLOCKED =
  "Move subprojects and documents out before deleting";
export const PROJECT_ERROR_PROTECTED = "This project cannot be deleted";
export const PROJECT_ERROR_EMPTY_NAME = "Project name cannot be empty";
export const PROJECT_ERROR_INVALID_PROJECT = "Project not found";

function nowMs() {
  return Date.now();
}

function newProjectId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `proj_${nowMs()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {import("./session-types.js").ProjectStore|null|undefined} store
 * @param {string} id
 * @returns {import("./session-types.js").Project|null}
 */
export function getProject(store, id) {
  const pid = String(id || "").trim();
  if (!store || !pid) return null;
  return (store.projects || []).find((p) => p?.id === pid) || null;
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} id
 * @returns {import("./session-types.js").Project[]}
 */
export function getAncestorChain(store, id) {
  const chain = [];
  let current = getProject(store, id);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    if (!current.parentId) break;
    current = getProject(store, current.parentId);
  }
  return chain;
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} id
 * @param {{ includeSelf?: boolean }} [opts]
 * @returns {string[]}
 */
export function getDescendantIds(store, id, opts = {}) {
  const includeSelf = opts.includeSelf !== false;
  const rootId = String(id || "").trim();
  if (!rootId) return [];
  const out = includeSelf ? [rootId] : [];
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift();
    for (const child of getChildren(store, parentId)) {
      out.push(child.id);
      queue.push(child.id);
    }
  }
  return includeSelf ? out : out.filter((x) => x !== rootId);
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string|null|undefined} parentId
 * @returns {import("./session-types.js").Project[]}
 */
export function getChildren(store, parentId) {
  if (!store) return [];
  const pid = parentId == null ? null : String(parentId).trim();
  return (store.projects || [])
    .filter((p) => (p?.parentId ?? null) === pid)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * @typedef {{ project: import("./session-types.js").Project, children: ProjectTreeNode[] }} ProjectTreeNode
 */

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string|null} [rootId]
 * @returns {ProjectTreeNode[]}
 */
export function getProjectTree(store, rootId = null) {
  if (!store) return [];
  /** @param {import("./session-types.js").Project} project */
  const buildNode = (project) => ({
    project,
    children: getChildren(store, project.id).map(buildNode),
  });
  if (rootId == null) {
    return getChildren(store, null).map(buildNode);
  }
  const root = getProject(store, rootId);
  return root ? [buildNode(root)] : [];
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {object[]} sessions
 * @param {string} projectId
 * @param {{ includeDescendants?: boolean }} [opts]
 * @returns {object[]}
 */
export function getSessionsByProject(store, sessions, projectId, opts = {}) {
  const pid = String(projectId || "").trim();
  if (!pid) return [];
  const list = Array.isArray(sessions) ? sessions : [];
  const includeDescendants = opts.includeDescendants === true;
  if (!includeDescendants) {
    return list.filter((s) => String(s?.projectId || "") === pid);
  }
  const scope = new Set(getDescendantIds(store, pid, { includeSelf: true }));
  return list.filter((s) => scope.has(String(s?.projectId || "")));
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} name
 * @param {string|null} parentId
 * @returns {{ ok: true, project: import("./session-types.js").Project }|{ ok: false, error: string }}
 */
export function createProject(store, name, parentId) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok: false, error: PROJECT_ERROR_EMPTY_NAME };
  if (!store || !Array.isArray(store.projects)) {
    return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  }
  if (parentId != null) {
    const parent = getProject(store, parentId);
    if (!parent) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  }
  const ts = nowMs();
  const project = {
    id: newProjectId(),
    name: trimmed,
    parentId: parentId == null ? null : String(parentId),
    createdAt: ts,
    updatedAt: ts,
  };
  store.projects.push(project);
  return { ok: true, project };
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} id
 * @param {string} newName
 * @returns {{ ok: true }|{ ok: false, error: string }}
 */
export function renameProject(store, id, newName) {
  const project = getProject(store, id);
  if (!project) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  const trimmed = String(newName || "").trim();
  if (!trimmed) return { ok: false, error: PROJECT_ERROR_EMPTY_NAME };
  project.name = trimmed;
  project.updatedAt = nowMs();
  return { ok: true };
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} id
 * @param {string|null} newParentId
 * @returns {{ ok: true }|{ ok: false, error: string }}
 */
export function moveProject(store, id, newParentId) {
  const project = getProject(store, id);
  if (!project) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  const nextParent = newParentId == null ? null : String(newParentId).trim();
  if (nextParent === project.parentId) return { ok: true };
  if (nextParent != null && !getProject(store, nextParent)) {
    return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  }
  const blocked = getDescendantIds(store, id, { includeSelf: true });
  if (nextParent != null && blocked.includes(nextParent)) {
    return { ok: false, error: PROJECT_ERROR_CYCLE };
  }
  project.parentId = nextParent;
  project.updatedAt = nowMs();
  return { ok: true };
}

/**
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} id
 * @param {object[]} sessions
 * @returns {{ ok: true }|{ ok: false, error: string }}
 */
export function deleteProject(store, id, sessions) {
  const project = getProject(store, id);
  if (!project) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  if (getChildren(store, id).length > 0) {
    return { ok: false, error: PROJECT_ERROR_DELETE_BLOCKED };
  }
  const assigned = getSessionsByProject(store, sessions, id, { includeDescendants: true });
  if (assigned.length > 0) {
    return { ok: false, error: PROJECT_ERROR_DELETE_BLOCKED };
  }
  store.projects = (store.projects || []).filter((p) => p?.id !== id);
  return { ok: true };
}

/**
 * Plan cascade delete: all descendant projects and assigned sessions.
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string} id
 * @param {object[]} sessions
 * @returns {{ ok: true, projectIds: string[], sessionIds: string[] }|{ ok: false, error: string }}
 */
export function planProjectDeletion(store, id, sessions) {
  const pid = String(id || "").trim();
  if (!pid) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  if (pid === "misc") return { ok: false, error: PROJECT_ERROR_PROTECTED };
  const project = getProject(store, pid);
  if (!project) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };

  const projectIds = getDescendantIds(store, pid, { includeSelf: true });
  const sortedProjectIds = [...projectIds].sort(
    (a, b) =>
      getDescendantIds(store, a, { includeSelf: true }).length -
      getDescendantIds(store, b, { includeSelf: true }).length,
  );
  const sessionIds = getSessionsByProject(store, sessions, pid, { includeDescendants: true }).map(
    (s) => String(s?.docId || "").trim(),
  ).filter(Boolean);
  return { ok: true, projectIds: sortedProjectIds, sessionIds };
}

/**
 * Remove project rows after sessions are deleted.
 * @param {import("./session-types.js").ProjectStore} store
 * @param {string[]} projectIds — leaf-first order from planProjectDeletion
 */
export function commitProjectDeletion(store, projectIds) {
  const remove = new Set((projectIds || []).map((id) => String(id).trim()).filter(Boolean));
  if (!remove.size) return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  store.projects = (store.projects || []).filter((p) => !remove.has(p?.id));
  return { ok: true };
}

/**
 * @param {object} session
 * @param {string} projectId
 * @param {import("./session-types.js").ProjectStore} store
 * @returns {{ ok: true, session: object }|{ ok: false, error: string }}
 */
export function assignSessionToProject(session, projectId, store) {
  const pid = String(projectId || "").trim();
  if (!session || typeof session !== "object") {
    return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  }
  if (!getProject(store, pid)) {
    return { ok: false, error: PROJECT_ERROR_INVALID_PROJECT };
  }
  return { ok: true, session: { ...session, projectId: pid, updatedAt: nowMs() } };
}
