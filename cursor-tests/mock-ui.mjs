function mockEl(tag = "div") {
  return {
    tagName: tag.toUpperCase(),
    className: "",
    hidden: false,
    children: [],
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    setAttribute() {},
    getAttribute() {
      return null;
    },
    classList: {
      toggle() {},
      add() {},
      remove() {},
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    textContent: "",
  };
}

export function renderBreadcrumb(segments) {
  const nav = mockEl("nav");
  nav.className = "study-breadcrumb";
  for (const segment of Array.isArray(segments) ? segments : []) {
    if (!segment?.label) continue;
    const span = mockEl("span");
    span.textContent = String(segment.label);
    nav.appendChild(span);
  }
  return nav;
}

export function renderProjectPicker(store, { selectedId, onSelect } = {}) {
  const root = mockEl("div");
  root.className = "project-picker";
  const projects = Array.isArray(store?.projects) ? store.projects : [];
  for (const project of projects) {
    const btn = mockEl("button");
    btn.dataset.projectId = project.id;
    btn.addEventListener = (evt, fn) => {
      if (evt === "click" && typeof fn === "function") btn._click = fn;
    };
    root.appendChild(btn);
  }
  if (typeof onSelect === "function" && projects[0]) {
    void onSelect;
  }
  return root;
}

function mockScreen() {
  return {
    _ariaHidden: "true",
    setAttribute(name, value) {
      if (name === "aria-hidden") this._ariaHidden = String(value);
    },
    getAttribute(name) {
      if (name === "aria-hidden") return this._ariaHidden;
      return null;
    },
  };
}

export const els = {
  dictionaryBtn: { hidden: true },
  languageSelect: null,
  screenBetweenBlocks: mockScreen(),
  screenSocratic: mockScreen(),
  screenTest: mockScreen(),
};

const LANG_OPTIONS = ["English", "Spanish", "French", "German"];

export function getStudyLanguage() {
  const stored = globalThis.localStorage?.getItem("study_lang");
  if (stored && LANG_OPTIONS.includes(stored)) return stored;
  return "English";
}

export function syncStudyLanguage(lang) {
  const v = String(lang || "").trim();
  const safe = v && LANG_OPTIONS.includes(v) ? v : getStudyLanguage();
  globalThis.localStorage?.setItem("study_lang", safe);
  if (els.languageSelect) els.languageSelect.value = safe;
  return safe;
}

let _currentScreenId = "setup";

export function getCurrentScreenId() {
  return _currentScreenId;
}

export function initLanguageUi() {}
export function showScreen(which) {
  if (which) _currentScreenId = which;
}
export function toggleSidebar() {}
export function typesetMath() {}
export function hideSidebar() {}
export function showSidebar() {}
export function setFullPackEntryCta() {}
export function updateFullPackProgressUi() {}
export function setOfflinePackButtonVisibility() {}
export function enableUnifiedMaterialUpload() {}
export function setPrefetchIndicator() {}
export function setBlockReadContentProvider() {}
export function closeBlockReadSidebar() {}
export function refreshBlockReadSidebarContent() {}
export function toggleBlockReadSidebar() {}
export function setBlockReadSidebarAvailable() {}
export function resolveChromeVisibility() {
  return { showGuide: false, showFab: false };
}
export function syncFloatingChrome() {}
export function registerChromeStudyModeResolver() {}
export function registerChromeHasConceptsResolver() {}
