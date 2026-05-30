/**
 * FrozenOperationProfileRegistry.js
 * Commercial operation profiles for frozen cargo programs.
 * Metadata only — no pricing, no calculations.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// OPERATION_PROFILES (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const OPERATION_PROFILES = Object.freeze({
  DUAL_GIGANTE: Object.freeze({
    key: 'DUAL_GIGANTE',
    label: 'Dual Gigante',
    description: 'Dual-SKU high-volume frozen program targeting large-format retail',
    targetMarket: 'RETAIL',
    containerProgram: 'RF40HC',
    minContainers: 2,
    tradeProgram: 'CONTAINER_PROGRAM',
    active: true,
  }),
  RETAIL_MAESTRO: Object.freeze({
    key: 'RETAIL_MAESTRO',
    label: 'Retail Maestro',
    description: 'Multi-SKU retail frozen assortment program',
    targetMarket: 'RETAIL',
    containerProgram: 'RF40HC',
    minContainers: 1,
    tradeProgram: 'CONTAINER_PROGRAM',
    active: true,
  }),
  POTENCIA_HORECA: Object.freeze({
    key: 'POTENCIA_HORECA',
    label: 'Potencia HoReCa',
    description: 'Foodservice frozen bulk program for HoReCa sector',
    targetMarket: 'FOODSERVICE',
    containerProgram: 'RF40',
    minContainers: 1,
    tradeProgram: 'CONTAINER_PROGRAM',
    active: true,
  }),
  EXPLOSION_RETAIL: Object.freeze({
    key: 'EXPLOSION_RETAIL',
    label: 'Explosión Retail',
    description: 'High-rotation retail frozen launch program — multi-SKU fast replenishment',
    targetMarket: 'RETAIL',
    containerProgram: 'RF40HC',
    minContainers: 3,
    tradeProgram: 'CONTAINER_PROGRAM',
    active: true,
  }),
  SINCRONIA_HORECA: Object.freeze({
    key: 'SINCRONIA_HORECA',
    label: 'Sincronía HoReCa',
    description: 'Synchronized HoReCa delivery program with scheduled reefer cycles',
    targetMarket: 'FOODSERVICE',
    containerProgram: 'RF40',
    minContainers: 2,
    tradeProgram: 'CONTAINER_PROGRAM',
    active: true,
  }),
});

// ---------------------------------------------------------------------------
// getProfile(key)
// Returns the entry for the given key or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getProfile(key) {
  const entry = OPERATION_PROFILES[key];
  if (!entry) {
    throw new Error(
      `getProfile: key "${key}" not found. ` +
        `Valid keys: ${Object.keys(OPERATION_PROFILES).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getActiveProfiles()
// Returns array of profiles where active === true.
// ---------------------------------------------------------------------------
export function getActiveProfiles() {
  return Object.values(OPERATION_PROFILES).filter((p) => p.active === true);
}

// ---------------------------------------------------------------------------
// getProfilesByMarket(targetMarket)
// Returns array of profiles matching the given targetMarket.
// ---------------------------------------------------------------------------
export function getProfilesByMarket(targetMarket) {
  return Object.values(OPERATION_PROFILES).filter(
    (p) => p.targetMarket === targetMarket
  );
}

// ---------------------------------------------------------------------------
// isValidProfile(key)
// Returns boolean — true if key matches a known operation profile.
// ---------------------------------------------------------------------------
export function isValidProfile(key) {
  return Object.prototype.hasOwnProperty.call(OPERATION_PROFILES, key);
}
