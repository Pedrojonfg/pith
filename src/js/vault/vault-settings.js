/** User preferences for vault curation flows. */

const SETTINGS_KEY = "pith_vault_settings";

const DEFAULTS = Object.freeze({
  autoDraftNotes: true,
});

/**
 * @returns {{ autoDraftNotes: boolean }}
 */
export function loadVaultSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULTS };
    return {
      autoDraftNotes:
        typeof parsed.autoDraftNotes === "boolean"
          ? parsed.autoDraftNotes
          : DEFAULTS.autoDraftNotes,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * @param {{ autoDraftNotes?: boolean }} patch
 */
export function saveVaultSettings(patch) {
  const current = loadVaultSettings();
  const next = {
    autoDraftNotes:
      typeof patch?.autoDraftNotes === "boolean"
        ? patch.autoDraftNotes
        : current.autoDraftNotes,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function isAutoDraftNotesEnabled() {
  return loadVaultSettings().autoDraftNotes;
}
