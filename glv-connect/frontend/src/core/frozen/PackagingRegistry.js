/**
 * PackagingRegistry.js
 * Export packaging standards for frozen cargo.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// MASTER_CASES (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const MASTER_CASES = Object.freeze({
  MASTER_CASE_10KG: Object.freeze({
    key: 'MASTER_CASE_10KG',
    label: 'Master Case 10kg',
    grossWeightKg: 10.5,
    netWeightKg: 10.0,
    stackable: true,
    exportReady: true,
  }),
  MASTER_CASE_12KG: Object.freeze({
    key: 'MASTER_CASE_12KG',
    label: 'Master Case 12kg',
    grossWeightKg: 12.6,
    netWeightKg: 12.0,
    stackable: true,
    exportReady: true,
  }),
  MASTER_CASE_20KG: Object.freeze({
    key: 'MASTER_CASE_20KG',
    label: 'Master Case 20kg',
    grossWeightKg: 21.0,
    netWeightKg: 20.0,
    stackable: true,
    exportReady: true,
  }),
});

// ---------------------------------------------------------------------------
// PACKAGING_MATERIALS (frozen enum)
// ---------------------------------------------------------------------------
export const PACKAGING_MATERIALS = Object.freeze({
  CARDBOARD: 'CARDBOARD',
  WAX_CARDBOARD: 'WAX_CARDBOARD',
  FOAM: 'FOAM',
  VACUUM_BAG: 'VACUUM_BAG',
  CRYOVAC: 'CRYOVAC',
  POLYBAG: 'POLYBAG',
});

// ---------------------------------------------------------------------------
// getMasterCase(key)
// Returns the entry for the given key or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getMasterCase(key) {
  const entry = MASTER_CASES[key];
  if (!entry) {
    throw new Error(
      `getMasterCase: key "${key}" not found. ` +
        `Valid keys: ${Object.keys(MASTER_CASES).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getExportReadyCases()
// Returns array of cases where exportReady === true.
// ---------------------------------------------------------------------------
export function getExportReadyCases() {
  return Object.values(MASTER_CASES).filter((c) => c.exportReady === true);
}

// ---------------------------------------------------------------------------
// getStackableCases()
// Returns array of cases where stackable === true.
// ---------------------------------------------------------------------------
export function getStackableCases() {
  return Object.values(MASTER_CASES).filter((c) => c.stackable === true);
}
