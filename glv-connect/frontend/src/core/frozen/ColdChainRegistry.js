/**
 * ColdChainRegistry.js
 * Cold chain operating specifications by product type.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// COLD_CHAIN_PRODUCT_TYPES (frozen enum)
// ---------------------------------------------------------------------------
export const COLD_CHAIN_PRODUCT_TYPES = Object.freeze({
  FROZEN_PULP: 'FROZEN_PULP',
  FROZEN_WHOLE: 'FROZEN_WHOLE',
  FROZEN_IQF: 'FROZEN_IQF',
  FROZEN_MEAT: 'FROZEN_MEAT',
  FROZEN_SEAFOOD: 'FROZEN_SEAFOOD',
  FRESH_PRODUCE: 'FRESH_PRODUCE',
  AMBIENT: 'AMBIENT',
});

// ---------------------------------------------------------------------------
// COLD_CHAIN_SPECS (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const COLD_CHAIN_SPECS = Object.freeze({
  FROZEN_PULP: Object.freeze({
    key: 'FROZEN_PULP',
    label: 'Frozen Fruit Pulp',
    minTempC: -18,
    maxTempC: -15,
    humidityRangePercent: Object.freeze({ min: 85, max: 95 }),
    shelfLifeDays: 730,
    requiresMonitoring: true,
  }),
  FROZEN_WHOLE: Object.freeze({
    key: 'FROZEN_WHOLE',
    label: 'Frozen Whole Fruit',
    minTempC: -18,
    maxTempC: -12,
    humidityRangePercent: Object.freeze({ min: 85, max: 95 }),
    shelfLifeDays: 365,
    requiresMonitoring: true,
  }),
  FROZEN_IQF: Object.freeze({
    key: 'FROZEN_IQF',
    label: 'IQF Frozen',
    minTempC: -20,
    maxTempC: -18,
    humidityRangePercent: Object.freeze({ min: 85, max: 95 }),
    shelfLifeDays: 365,
    requiresMonitoring: true,
  }),
  FROZEN_MEAT: Object.freeze({
    key: 'FROZEN_MEAT',
    label: 'Frozen Meat',
    minTempC: -18,
    maxTempC: -12,
    humidityRangePercent: Object.freeze({ min: 85, max: 95 }),
    shelfLifeDays: 365,
    requiresMonitoring: true,
  }),
  FROZEN_SEAFOOD: Object.freeze({
    key: 'FROZEN_SEAFOOD',
    label: 'Frozen Seafood',
    minTempC: -20,
    maxTempC: -18,
    humidityRangePercent: Object.freeze({ min: 85, max: 95 }),
    shelfLifeDays: 365,
    requiresMonitoring: true,
  }),
  FRESH_PRODUCE: Object.freeze({
    key: 'FRESH_PRODUCE',
    label: 'Fresh Produce',
    minTempC: 2,
    maxTempC: 8,
    humidityRangePercent: Object.freeze({ min: 90, max: 98 }),
    shelfLifeDays: 21,
    requiresMonitoring: true,
  }),
  AMBIENT: Object.freeze({
    key: 'AMBIENT',
    label: 'Ambient',
    minTempC: 15,
    maxTempC: 25,
    humidityRangePercent: Object.freeze({ min: 50, max: 70 }),
    shelfLifeDays: null,
    requiresMonitoring: false,
  }),
});

// ---------------------------------------------------------------------------
// getColdChainSpec(productType)
// Returns the entry for the given productType or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getColdChainSpec(productType) {
  const entry = COLD_CHAIN_SPECS[productType];
  if (!entry) {
    throw new Error(
      `getColdChainSpec: productType "${productType}" not found. ` +
        `Valid types: ${Object.keys(COLD_CHAIN_SPECS).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// isTemperatureCompliant(productType, actualTempC)
// Returns boolean — true if actualTempC is within minTempC..maxTempC.
// ---------------------------------------------------------------------------
export function isTemperatureCompliant(productType, actualTempC) {
  const spec = getColdChainSpec(productType);
  return actualTempC >= spec.minTempC && actualTempC <= spec.maxTempC;
}

// ---------------------------------------------------------------------------
// getProductTypesRequiringMonitoring()
// Returns array of keys where requiresMonitoring === true.
// ---------------------------------------------------------------------------
export function getProductTypesRequiringMonitoring() {
  return Object.values(COLD_CHAIN_SPECS)
    .filter((s) => s.requiresMonitoring === true)
    .map((s) => s.key);
}
