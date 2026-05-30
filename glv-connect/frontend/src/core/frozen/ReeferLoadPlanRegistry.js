/**
 * ReeferLoadPlanRegistry.js
 * Standard GLV reefer container load plans.
 * FROZEN_LOGISTICS_INTELLIGENCE_V1
 *
 * Operational load specification per container type.
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { REEFER_CONTAINERS } from './ReeferContainerRegistry.js';
import { PALLETIZATION_STANDARDS } from './FrozenPalletizationRegistry.js';

// ---------------------------------------------------------------------------
// LOAD_PLANS (frozen object)
// One entry per reefer container type.
// ---------------------------------------------------------------------------
export const LOAD_PLANS = Object.freeze({
  RF20: Object.freeze({
    containerCode: 'RF20',
    palletCapacity: 10,
    maxPayloadKg: 21600,
    maxVolumeM3: 28.3,
    recommendedUtilizationPercent: 92,
    effectivePayloadKg: 19872,
    effectiveVolumeM3: 26.0,
    standardPresentationKey: 'RETAIL_1KG',
    maxCasesAtStandardPresentation: 1000,
    maxUnitsAtStandardPresentation: 10000,
  }),
  RF40: Object.freeze({
    containerCode: 'RF40',
    palletCapacity: 20,
    maxPayloadKg: 26580,
    maxVolumeM3: 59.3,
    recommendedUtilizationPercent: 92,
    effectivePayloadKg: 24454,
    effectiveVolumeM3: 54.6,
    standardPresentationKey: 'RETAIL_1KG',
    maxCasesAtStandardPresentation: 2000,
    maxUnitsAtStandardPresentation: 20000,
  }),
  RF40HC: Object.freeze({
    containerCode: 'RF40HC',
    palletCapacity: 22,
    maxPayloadKg: 26580,
    maxVolumeM3: 67.3,
    recommendedUtilizationPercent: 92,
    effectivePayloadKg: 24454,
    effectiveVolumeM3: 61.9,
    standardPresentationKey: 'RETAIL_1KG',
    maxCasesAtStandardPresentation: 2200,
    maxUnitsAtStandardPresentation: 22000,
  }),
});

// ---------------------------------------------------------------------------
// getLoadPlan(containerCode)
// Returns the load plan for the given container code or throws.
// ---------------------------------------------------------------------------
export function getLoadPlan(containerCode) {
  const entry = LOAD_PLANS[containerCode];
  if (!entry) {
    throw new Error(
      `getLoadPlan: containerCode "${containerCode}" not found. ` +
        `Valid codes: ${Object.keys(LOAD_PLANS).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getEffectivePayload(containerCode)
// Returns the effectivePayloadKg for the given container code.
// ---------------------------------------------------------------------------
export function getEffectivePayload(containerCode) {
  return getLoadPlan(containerCode).effectivePayloadKg;
}

// ---------------------------------------------------------------------------
// getMaxPallets(containerCode)
// Returns the palletCapacity for the given container code.
// ---------------------------------------------------------------------------
export function getMaxPallets(containerCode) {
  return getLoadPlan(containerCode).palletCapacity;
}

// ---------------------------------------------------------------------------
// isValidContainer(containerCode)
// Returns boolean — true if containerCode matches a known load plan.
// ---------------------------------------------------------------------------
export function isValidContainer(containerCode) {
  return Object.prototype.hasOwnProperty.call(LOAD_PLANS, containerCode);
}
