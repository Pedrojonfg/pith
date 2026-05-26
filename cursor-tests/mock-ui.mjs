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
  screenBetweenBlocks: mockScreen(),
  screenSocratic: mockScreen(),
  screenTest: mockScreen(),
};
export function getStudyLanguage() {
  return "English";
}
export function initLanguageUi() {}
export function showScreen() {}
export function toggleSidebar() {}
export function typesetMath() {}
