/**
 * Project library browser orchestration.
 * @see specs/20260623-study-projects/contracts/project-library-ui.md
 */

import {
  deleteSession,
  getAllSessions,
  getProjectStore,
  getSession,
  getSmItemsDueToday,
  persistProjectStore,
  saveActiveSession,
} from "./session-store.js";
import {
  assignSessionToProject,
  createProject,
  deleteProject,
  getAncestorChain,
  getChildren,
  getProject,
  moveProject,
  PROJECT_ERROR_CYCLE,
  PROJECT_ERROR_DELETE_BLOCKED,
  renameProject,
} from "./project-store.js";
import { getPreparationBadgeLabel } from "./document-preparation.js";
import { scanStalePreparationSessions } from "./session.js";
import { exportDocumentSessionMarkdown } from "./export.js?v=20260625_02";
import { els, renderBreadcrumb, renderProjectPicker } from "./ui.js?v=20260625_02";

/** @type {{ currentProjectId: string|null, fromLibraryDocId: string|null, uploadProjectId: string|null }} */
export const projectLibraryState = {
  currentProjectId: null,
  fromLibraryDocId: null,
  uploadProjectId: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showProjectToast(message) {
  const text = String(message || "").trim();
  if (!text) return;
  window.alert(text);
}

export function getUploadDefaultProjectId() {
  if (projectLibraryState.uploadProjectId) return projectLibraryState.uploadProjectId;
  if (projectLibraryState.currentProjectId) return projectLibraryState.currentProjectId;
  return null;
}

export function setUploadProjectContext(projectId) {
  projectLibraryState.uploadProjectId = projectId ? String(projectId) : null;
}

export function mountUploadProjectPicker(onChange) {
  const mount = els.uploadProjectPickerMount;
  if (!mount) return;
  mount.innerHTML = "";
  const store = getProjectStore();
  const selectedId = getUploadDefaultProjectId();
  mount.appendChild(
    renderProjectPicker(store, {
      selectedId,
      onSelect: (id) => {
        projectLibraryState.uploadProjectId = id;
        if (typeof onChange === "function") onChange(id);
      },
    }),
  );
}

function projectBreadcrumbSegments(projectId, onNavigate) {
  const store = getProjectStore();
  const segments = [
    {
      label: "Library",
      onClick: () => onNavigate(null),
    },
  ];
  if (projectId) {
    const chain = getAncestorChain(store, projectId).slice().reverse();
    for (const project of chain) {
      const pid = project.id;
      segments.push({
        label: project.name || project.id,
        onClick: pid === projectId ? undefined : () => onNavigate(pid),
      });
    }
  }
  return segments;
}

function renderLibraryBreadcrumb(projectId, mountEl, onNavigate) {
  if (!mountEl) return;
  mountEl.innerHTML = "";
  const nav = renderBreadcrumb(projectBreadcrumbSegments(projectId, onNavigate));
  mountEl.appendChild(nav);
}

function formatDocLibraryDate(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDocLibraryModes(modes) {
  const labels = { rsvp: "RSVP", slow: "Slow", cloze: "Cloze", questions: "Questions", recall: "Recall" };
  return (modes || []).map((m) => labels[m] || m).join(" · ");
}

const DOC_LIBRARY_DOWNLOAD_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0l4-4m-4 4l-4-4M4 20h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderProjectRows(store, parentId, container, onOpenProject) {
  if (!container) return;
  const children = getChildren(store, parentId);
  if (!children.length) {
    if (!parentId) {
      container.innerHTML = '<p class="doc-library-empty hint">No projects yet. Create one to organize your study sessions.</p>';
    } else {
      container.innerHTML = "";
    }
    return;
  }
  container.innerHTML = children
    .map((project) => {
      const swatch = project.color
        ? `<span class="project-library-swatch" style="background:${escapeHtml(project.color)}"></span>`
        : "";
      return `<button type="button" class="project-library-item" data-project-id="${escapeHtml(project.id)}" role="listitem">
        ${swatch}
        <span class="doc-library-title">${escapeHtml(project.name || project.id)}</span>
      </button>`;
    })
    .join("");
  container.querySelectorAll("[data-project-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-project-id");
      if (id) onOpenProject(id);
    });
  });
}

async function renderDocumentRows(projectId, container, onOpenDoc) {
  if (!container) return;
  const store = getProjectStore();
  const sessions = await scanStalePreparationSessions(
    (await getAllSessions()).filter(
      (s) => String(s?.projectId || "") === String(projectId),
    ),
  );
  if (!sessions.length) {
    container.innerHTML = projectId
      ? '<p class="doc-library-empty hint">No documents in this project yet. Use "Create session in this project" to start.</p>'
      : "";
    return;
  }
  const rowHtml = [];
  for (const doc of sessions) {
    const title = doc.shared?.docMeta?.titleInferred || "Untitled document";
    const modes = Object.entries(doc.modes || {})
      .filter(([, value]) => value != null)
      .map(([key]) => key);
    const smDue = (await getSmItemsDueToday(doc.docId)).length;
    const smDueHtml =
      smDue > 0 ? `<span class="doc-library-sm-due">${smDue} due today</span>` : "";
    const prepLabel = getPreparationBadgeLabel(doc);
    const prepHtml = prepLabel
      ? `<span class="doc-library-prep-badge doc-library-prep-badge--${prepLabel.toLowerCase()}">${escapeHtml(prepLabel)}</span>`
      : "";
    rowHtml.push(`<div class="doc-library-row" role="listitem">
        <button type="button" class="doc-library-item" data-doc-id="${escapeHtml(doc.docId)}">
          <span class="doc-library-title">${escapeHtml(title)}</span>
          <span class="doc-library-meta">
            ${prepHtml}
            <span class="doc-library-modes">${escapeHtml(formatDocLibraryModes(modes))}</span>
            ${smDueHtml}
            <span class="doc-library-date">${escapeHtml(formatDocLibraryDate(doc.updatedAt))}</span>
          </span>
        </button>
        <div class="doc-library-row-actions">
          <button type="button" class="btn-secondary doc-library-download-btn" data-download-doc-id="${escapeHtml(doc.docId)}" aria-label="Export session as Markdown" title="Export session as Markdown">${DOC_LIBRARY_DOWNLOAD_ICON}</button>
          <button type="button" class="btn-secondary doc-library-move-btn" data-move-doc-id="${escapeHtml(doc.docId)}">Move to project…</button>
          <button type="button" class="btn-secondary doc-library-delete-btn" data-delete-doc-id="${escapeHtml(doc.docId)}" aria-label="Delete session" title="Delete session">??</button>
        </div>
      </div>`);
  }
  container.innerHTML = rowHtml.join("");

  container.querySelectorAll("[data-doc-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-doc-id");
      if (id) onOpenDoc(id);
    });
  });
  container.querySelectorAll("[data-download-doc-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const id = btn.getAttribute("data-download-doc-id");
      if (!id) return;
      const result = await exportDocumentSessionMarkdown(id);
      if (result.ok) return;
      if (result.error === "download_blocked") {
        showProjectToast("Download blocked — try again or check browser settings.");
        return;
      }
      showProjectToast("No session content to export yet.");
    });
  });
  container.querySelectorAll("[data-move-doc-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-move-doc-id");
      if (id) promptMoveDocument(id);
    });
  });
  container.querySelectorAll("[data-delete-doc-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-doc-id");
      if (!id) return;
      const ok = window.confirm("Delete this session? This cannot be undone.");
      if (!ok) return;
      await deleteSession(id);
      await renderProjectLibraryView();
    });
  });
}

async function promptMoveDocument(docId) {
  const session = await getSession(docId);
  if (!session) return;
  const store = getProjectStore();
  const overlay = document.createElement("div");
  overlay.className = "project-move-overlay";
  overlay.innerHTML = `<div class="card project-move-dialog">
    <h2>Move to project…</h2>
    <div id="moveProjectPickerMount"></div>
    <div class="row"><button type="button" id="moveProjectCancel" class="btn-secondary">Cancel</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const mount = overlay.querySelector("#moveProjectPickerMount");
  mount?.appendChild(
    renderProjectPicker(store, {
      selectedId: session.projectId || undefined,
      onSelect: async (projectId) => {
        const result = assignSessionToProject(session, projectId, store);
        if (!result.ok) {
          showProjectToast(result.error);
          return;
        }
        await saveActiveSession(result.session);
        document.body.removeChild(overlay);
        await renderProjectLibraryView();
      },
    }),
  );
  overlay.querySelector("#moveProjectCancel")?.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
}

function promptNewProject(parentId) {
  const name = window.prompt(parentId ? "Subproject name:" : "Project name:");
  if (name == null) return;
  const store = getProjectStore();
  const result = createProject(store, name, parentId);
  if (!result.ok) {
    showProjectToast(result.error);
    return;
  }
  persistProjectStore(store);
  if (parentId) {
    projectLibraryState.currentProjectId = result.project.id;
  }
  renderProjectLibraryView();
}

function promptRenameProject(projectId) {
  const store = getProjectStore();
  const project = getProject(store, projectId);
  if (!project) return;
  const name = window.prompt("Rename project:", project.name);
  if (name == null) return;
  const result = renameProject(store, projectId, name);
  if (!result.ok) {
    showProjectToast(result.error);
    return;
  }
  persistProjectStore(store);
  renderProjectLibraryView();
}

async function promptDeleteProject(projectId) {
  const store = getProjectStore();
  const sessions = await getAllSessions();
  const result = deleteProject(store, projectId, sessions);
  if (!result.ok && result.error !== PROJECT_ERROR_DELETE_BLOCKED) {
    if (result.error) showProjectToast(result.error);
    return;
  }
  if (!result.ok) {
    showProjectToast(result.error);
    return;
  }
  persistProjectStore(store);
  if (projectLibraryState.currentProjectId === projectId) {
    projectLibraryState.currentProjectId = null;
  }
  renderProjectLibraryView();
}

export function renderProjectLibraryView() {
  const store = getProjectStore();
  const projectId = projectLibraryState.currentProjectId;
  const parentForList = projectId ?? null;

  renderLibraryBreadcrumb(projectId, els.docLibraryBreadcrumb, (nextId) => {
    projectLibraryState.currentProjectId = nextId;
    renderProjectLibraryView();
  });

  if (els.btnNewProject) els.btnNewProject.hidden = Boolean(projectId);
  if (els.btnNewSubproject) els.btnNewSubproject.hidden = !projectId;
  if (els.btnCreateProjectSession) els.btnCreateProjectSession.hidden = !projectId;

  renderProjectRows(store, parentForList, els.docLibraryProjectList, (id) => {
    projectLibraryState.currentProjectId = id;
    renderProjectLibraryView();
  });

  if (projectId) {
    renderDocumentRows(projectId, els.docLibraryList, (docId) => {
      projectLibraryState.fromLibraryDocId = docId;
      if (typeof projectLibraryCallbacks.onDocumentOpen === "function") {
        projectLibraryCallbacks.onDocumentOpen(docId);
      }
    });
  } else if (els.docLibraryList) {
    els.docLibraryList.innerHTML =
      '<p class="doc-library-empty hint">Select a subject to see its documents.</p>';
  }
}

/** @type {{ onDocumentOpen?: (docId: string) => void, onBack?: () => void, onCreateSessionInProject?: (projectId: string) => void }} */
export const projectLibraryCallbacks = {};

export function enterProjectLibrary(options = {}) {
  if (options.projectId !== undefined) {
    projectLibraryState.currentProjectId = options.projectId || null;
  } else if (options.reset !== false) {
    projectLibraryState.currentProjectId = null;
  }
  setUploadProjectContext(projectLibraryState.currentProjectId || null);
  renderProjectLibraryView();
}

export function wireProjectLibraryHandlers() {
  els.btnNewProject?.addEventListener("click", () => promptNewProject(null));
  els.btnNewSubproject?.addEventListener("click", () => {
    if (projectLibraryState.currentProjectId) {
      promptNewProject(projectLibraryState.currentProjectId);
    }
  });
  els.btnCreateProjectSession?.addEventListener("click", () => {
    const projectId = projectLibraryState.currentProjectId;
    if (!projectId) return;
    setUploadProjectContext(projectId);
    if (typeof projectLibraryCallbacks.onCreateSessionInProject === "function") {
      projectLibraryCallbacks.onCreateSessionInProject(projectId);
    }
  });
  els.docLibraryBackBtn?.addEventListener("click", () => {
    if (projectLibraryState.currentProjectId) {
      const store = getProjectStore();
      const current = getProject(store, projectLibraryState.currentProjectId);
      projectLibraryState.currentProjectId = current?.parentId ?? null;
      renderProjectLibraryView();
      return;
    }
    if (typeof projectLibraryCallbacks.onBack === "function") {
      projectLibraryCallbacks.onBack();
    }
  });
}

export function mountModeSelectBreadcrumb(doc) {
  const mount = els.modeSelectBreadcrumb;
  if (!mount) return;
  mount.innerHTML = "";
  if (!doc) return;
  const store = getProjectStore();
  const projectId = doc.projectId;
  const project = projectId ? getProject(store, projectId) : null;
  const segments = [
    { label: "Library", onClick: () => enterProjectLibrary({ projectId: projectId || null }) },
  ];
  if (project) {
    segments.push({ label: project.name || "Subject" });
  }
  segments.push({ label: doc.shared?.docMeta?.titleInferred || "Document" });
  mount.appendChild(renderBreadcrumb(segments));
}

export function populateReviewScopeSelect() {
  const select = els.reviewScopeSelect;
  if (!select) return;
  const store = getProjectStore();
  const current = select.value || "all";
  select.innerHTML = '<option value="all">All subjects</option>';
  const walk = (parentId, depth) => {
    for (const project of getChildren(store, parentId)) {
      const opt = document.createElement("option");
      opt.value = project.id;
      opt.textContent = `${"  ".repeat(depth)}${project.name || project.id}`;
      select.appendChild(opt);
      walk(project.id, depth + 1);
    }
  };
  walk(null, 0);
  if ([...select.options].some((o) => o.value === current)) {
    select.value = current;
  }
  const includeRow = select.closest(".review-scope-field")?.querySelector(".review-scope-include");
  if (includeRow) {
    includeRow.hidden = select.value === "all";
  }
  const project = select.value !== "all" ? getProject(store, select.value) : null;
  if (els.reviewConfigBreadcrumb) {
    els.reviewConfigBreadcrumb.innerHTML = "";
    const label = select.value === "all" ? "All subjects" : project?.name || "Subject";
    els.reviewConfigBreadcrumb.appendChild(
      renderBreadcrumb([{ label: "Review" }, { label }]),
    );
  }
}

export { PROJECT_ERROR_CYCLE, PROJECT_ERROR_DELETE_BLOCKED };
