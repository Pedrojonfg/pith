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

const LANG_OPTIONS = ["English", "Español", "Français", "Deutsch"];

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

export function initLanguageUi() {}
export function showScreen() {}
export function toggleSidebar() {}
export function typesetMath() {}
