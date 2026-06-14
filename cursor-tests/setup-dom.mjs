/** Minimal browser globals for importing src/js modules in Node. */
const store = new Map();

globalThis.window = globalThis.window || {};
globalThis.window.offlineMode = false;
globalThis.window.assessmentConfig = undefined;
if (typeof globalThis.window.addEventListener !== "function") {
  globalThis.window.addEventListener = () => {};
}
if (typeof globalThis.window.removeEventListener !== "function") {
  globalThis.window.removeEventListener = () => {};
}

globalThis.localStorage = {
  get length() {
    return store.size;
  },
  key(index) {
    const keys = [...store.keys()];
    return keys[index] ?? null;
  },
  getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  setItem(key, value) {
    store.set(key, String(value));
  },
  removeItem(key) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
};

globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => ({
    tagName: String(tag || "div").toUpperCase(),
    className: "",
    hidden: false,
    children: [],
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    setAttribute() {},
    getAttribute: () => null,
    classList: { toggle() {}, add() {}, remove() {} },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    textContent: "",
  }),
  body: { classList: { contains: () => false } },
};

export function resetStorage() {
  store.clear();
}
