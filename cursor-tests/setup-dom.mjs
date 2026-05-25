/** Minimal browser globals for importing src/js modules in Node. */
const store = new Map();

globalThis.window = globalThis.window || {};
globalThis.window.offlineMode = false;
globalThis.window.assessmentConfig = undefined;

globalThis.localStorage = {
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
};

export function resetStorage() {
  store.clear();
}
