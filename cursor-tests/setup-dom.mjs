/** Minimal browser globals for importing src/js modules in Node. */
const store = new Map();

globalThis.window = globalThis.window || {};
globalThis.window.offlineMode = false;
globalThis.window.assessmentConfig = undefined;

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
};

export function resetStorage() {
  store.clear();
}
