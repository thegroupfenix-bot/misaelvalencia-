/**
 * PalletRegistry.js
 * GLV pallet standards for frozen cargo operations.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// PALLET_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const PALLET_TYPES = Object.freeze({
  EURO: 'EURO',
  ISPM_48X40: 'ISPM_48X40',
  ISPM_48X48: 'ISPM_48X48',
  CHEP: 'CHEP',
  DISPLAY: 'DISPLAY',
});

// ---------------------------------------------------------------------------
// PALLET_STANDARDS (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const PALLET_STANDARDS = Object.freeze({
  EURO: Object.freeze({
    key: 'EURO',
    label: 'EUR/EPAL Pallet',
    palletType: 'EURO',
    lengthMm: 1200,
    widthMm: 800,
    maxHeightMm: 2200,
    maxWeightKg: 1500,
    exportCertified: true,
  }),
  ISPM_48X40: Object.freeze({
    key: 'ISPM_48X40',
    label: 'ISPM 48x40 Pallet',
    palletType: 'ISPM_48X40',
    lengthMm: 1219,
    widthMm: 1016,
    maxHeightMm: 2200,
    maxWeightKg: 1500,
    exportCertified: true,
  }),
  ISPM_48X48: Object.freeze({
    key: 'ISPM_48X48',
    label: 'ISPM 48x48 Pallet',
    palletType: 'ISPM_48X48',
    lengthMm: 1219,
    widthMm: 1219,
    maxHeightMm: 2200,
    maxWeightKg: 2000,
    exportCertified: true,
  }),
  CHEP: Object.freeze({
    key: 'CHEP',
    label: 'CHEP Pallet',
    palletType: 'CHEP',
    lengthMm: 1165,
    widthMm: 1165,
    maxHeightMm: 2000,
    maxWeightKg: 1250,
    exportCertified: true,
  }),
  DISPLAY: Object.freeze({
    key: 'DISPLAY',
    label: 'Display Pallet',
    palletType: 'DISPLAY',
    lengthMm: 600,
    widthMm: 400,
    maxHeightMm: 1800,
    maxWeightKg: 500,
    exportCertified: false,
  }),
});

// ---------------------------------------------------------------------------
// getPallet(key)
// Returns the entry for the given key or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getPallet(key) {
  const entry = PALLET_STANDARDS[key];
  if (!entry) {
    throw new Error(
      `getPallet: key "${key}" not found. ` +
        `Valid keys: ${Object.keys(PALLET_STANDARDS).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getExportCertifiedPallets()
// Returns array of pallet standards where exportCertified === true.
// ---------------------------------------------------------------------------
export function getExportCertifiedPallets() {
  return Object.values(PALLET_STANDARDS).filter(
    (p) => p.exportCertified === true
  );
}

// ---------------------------------------------------------------------------
// isValidPalletType(key)
// Returns boolean — true if key matches a known pallet standard.
// ---------------------------------------------------------------------------
export function isValidPalletType(key) {
  return Object.prototype.hasOwnProperty.call(PALLET_STANDARDS, key);
}
