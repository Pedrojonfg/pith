/** Cross-document prerequisite elevation for Global Knowledge Vault. */

import { loadVault, saveVault } from "./vault-store.js";

/**
 * @param {object} vault
 * @param {string} dependentId
 * @param {string} prereqId
 */
export function addPrerequisiteRelation(vault, dependentId, prereqId) {
  const depId = String(dependentId || "").trim();
  const preId = String(prereqId || "").trim();
  if (!depId || !preId || depId === preId) return;

  const dependent = vault.entries.find((e) => String(e?.id || "") === depId);
  const prereq = vault.entries.find((e) => String(e?.id || "") === preId);
  if (!dependent || !prereq) return;

  if (!Array.isArray(dependent.prerequisites)) dependent.prerequisites = [];
  if (!dependent.prerequisites.includes(preId)) dependent.prerequisites.push(preId);

  if (!Array.isArray(prereq.dependents)) prereq.dependents = [];
  if (!prereq.dependents.includes(depId)) prereq.dependents.push(depId);
}

/**
 * @param {object} session
 * @param {Record<string, string>} normalizationMap
 */
export function elevatePrerequisiteRelations(session, normalizationMap) {
  const map = normalizationMap && typeof normalizationMap === "object" ? normalizationMap : {};
  const inventory = Array.isArray(session?.shared?.conceptInventory)
    ? session.shared.conceptInventory
    : [];
  if (!inventory.length) return;

  const vault = loadVault();
  let changed = false;

  for (const concept of inventory) {
    const conceptId = String(concept?.id || concept?.canonicalId || "").trim();
    if (!conceptId) continue;
    const vaultId = map[conceptId];
    if (!vaultId) continue;
    const prereqIds = Array.isArray(concept.prerequisite_ids) ? concept.prerequisite_ids : [];
    for (const prereqConceptId of prereqIds) {
      const pid = String(prereqConceptId || "").trim();
      if (!pid) continue;
      const prereqVaultId = map[pid];
      if (!prereqVaultId || prereqVaultId === vaultId) continue;
      const before = JSON.stringify(
        vault.entries.find((e) => e.id === vaultId)?.prerequisites || [],
      );
      addPrerequisiteRelation(vault, vaultId, prereqVaultId);
      const after = JSON.stringify(
        vault.entries.find((e) => e.id === vaultId)?.prerequisites || [],
      );
      if (before !== after) changed = true;
    }
  }

  if (changed) {
    vault.lastUpdated = Date.now();
    saveVault(vault);
  }
}
