/**
 * FrozenCapacityEngine.js
 * Pure calculation functions for frozen cargo load planning.
 * FROZEN_LOGISTICS_INTELLIGENCE_V1
 *
 * ALL functions are pure — no side effects, no mutations, no React, no UI.
 * Takes data and returns frozen results.
 */

import { MASTER_CASES } from './PackagingRegistry.js';
import { PALLETIZATION_STANDARDS, getPalletization } from './FrozenPalletizationRegistry.js';
import { LOAD_PLANS, getLoadPlan } from './ReeferLoadPlanRegistry.js';
import { FROZEN_PROGRAM_TIERS, getProgramTierForMT } from './FrozenCommercialProgramRegistry.js';

// ---------------------------------------------------------------------------
// calculateCases({ totalNetWeightKg, presentationKey })
// Returns: { cases, totalNetWeightKg, totalGrossWeightKg }
// ---------------------------------------------------------------------------
export function calculateCases({ totalNetWeightKg, presentationKey }) {
  const palletStd = getPalletization(presentationKey);
  const masterCase = MASTER_CASES[palletStd.masterCaseKey];
  if (!masterCase) {
    throw new Error(
      `calculateCases: masterCaseKey "${palletStd.masterCaseKey}" not found in MASTER_CASES`
    );
  }
  const cases = Math.ceil(totalNetWeightKg / masterCase.netWeightKg);
  const totalGrossWeightKg = cases * masterCase.grossWeightKg;
  return Object.freeze({
    cases,
    totalNetWeightKg,
    totalGrossWeightKg,
  });
}

// ---------------------------------------------------------------------------
// calculateUnits({ totalNetWeightKg, presentationKey })
// Returns: { units, cases, totalNetWeightKg }
// ---------------------------------------------------------------------------
export function calculateUnits({ totalNetWeightKg, presentationKey }) {
  const casesResult = calculateCases({ totalNetWeightKg, presentationKey });
  const palletStd = getPalletization(presentationKey);
  const units = casesResult.cases * palletStd.unitsPerCase;
  return Object.freeze({
    units,
    cases: casesResult.cases,
    totalNetWeightKg,
  });
}

// ---------------------------------------------------------------------------
// calculatePallets({ totalNetWeightKg, presentationKey })
// Returns: { pallets, cases, units, netWeightKg, grossWeightKg }
// ---------------------------------------------------------------------------
export function calculatePallets({ totalNetWeightKg, presentationKey }) {
  const casesResult = calculateCases({ totalNetWeightKg, presentationKey });
  const palletStd = getPalletization(presentationKey);
  const pallets = Math.ceil(casesResult.cases / palletStd.casesPerPallet);
  const units = casesResult.cases * palletStd.unitsPerCase;
  return Object.freeze({
    pallets,
    cases: casesResult.cases,
    units,
    netWeightKg: casesResult.totalNetWeightKg,
    grossWeightKg: casesResult.totalGrossWeightKg,
  });
}

// ---------------------------------------------------------------------------
// calculateContainerFill({ totalNetWeightKg, presentationKey, containerCode })
// Returns: {
//   containersNeeded, pallets, cases, units, netWeightKg, grossWeightKg,
//   weightUtilizationPercent, palletUtilizationPercent
// }
// ---------------------------------------------------------------------------
export function calculateContainerFill({ totalNetWeightKg, presentationKey, containerCode }) {
  const palletsResult = calculatePallets({ totalNetWeightKg, presentationKey });
  const loadPlan = getLoadPlan(containerCode);
  const containersNeeded = Math.ceil(palletsResult.pallets / loadPlan.palletCapacity);
  const weightUtilizationPercent = Math.round(
    ((palletsResult.grossWeightKg / (containersNeeded * loadPlan.maxPayloadKg)) * 100) * 100
  ) / 100;
  const palletUtilizationPercent = Math.round(
    ((palletsResult.pallets / (containersNeeded * loadPlan.palletCapacity)) * 100) * 100
  ) / 100;
  return Object.freeze({
    containersNeeded,
    pallets: palletsResult.pallets,
    cases: palletsResult.cases,
    units: palletsResult.units,
    netWeightKg: palletsResult.netWeightKg,
    grossWeightKg: palletsResult.grossWeightKg,
    weightUtilizationPercent,
    palletUtilizationPercent,
  });
}

// ---------------------------------------------------------------------------
// calculateWeightUtilization({ grossWeightKg, containerCode, containersCount })
// Returns: { utilizationPercent, remainingCapacityKg, status }
// status: 'UNDER' | 'OPTIMAL' | 'OVER'
// ---------------------------------------------------------------------------
export function calculateWeightUtilization({ grossWeightKg, containerCode, containersCount }) {
  const loadPlan = getLoadPlan(containerCode);
  const capacity = containersCount * loadPlan.maxPayloadKg;
  const utilizationPercent = Math.round((grossWeightKg / capacity) * 100 * 100) / 100;
  const remainingCapacityKg = Math.max(0, capacity - grossWeightKg);
  let status;
  if (utilizationPercent > 100) {
    status = 'OVER';
  } else if (utilizationPercent >= 85) {
    status = 'OPTIMAL';
  } else {
    status = 'UNDER';
  }
  return Object.freeze({
    utilizationPercent,
    remainingCapacityKg,
    status,
  });
}

// ---------------------------------------------------------------------------
// calculateVolumeUtilization({ palletCount, containerCode, containersCount })
// Returns: { utilizationPercent, remainingPallets, status }
// status: 'UNDER' | 'OPTIMAL' | 'OVER'
// ---------------------------------------------------------------------------
export function calculateVolumeUtilization({ palletCount, containerCode, containersCount }) {
  const loadPlan = getLoadPlan(containerCode);
  const capacity = containersCount * loadPlan.palletCapacity;
  const utilizationPercent = Math.round((palletCount / capacity) * 100 * 100) / 100;
  const remainingPallets = Math.max(0, capacity - palletCount);
  let status;
  if (utilizationPercent > 100) {
    status = 'OVER';
  } else if (utilizationPercent >= 85) {
    status = 'OPTIMAL';
  } else {
    status = 'UNDER';
  }
  return Object.freeze({
    utilizationPercent,
    remainingPallets,
    status,
  });
}

// ---------------------------------------------------------------------------
// calculateLoadSummary({ totalNetWeightKg, presentationKey, containerCode })
// Returns complete frozen summary object.
// ---------------------------------------------------------------------------
export function calculateLoadSummary({ totalNetWeightKg, presentationKey, containerCode }) {
  const fill = calculateContainerFill({ totalNetWeightKg, presentationKey, containerCode });
  const weightUtilization = calculateWeightUtilization({
    grossWeightKg: fill.grossWeightKg,
    containerCode,
    containersCount: fill.containersNeeded,
  });
  const palletUtilization = calculateVolumeUtilization({
    palletCount: fill.pallets,
    containerCode,
    containersCount: fill.containersNeeded,
  });
  const programTier = getProgramTierForMT(totalNetWeightKg / 1000);
  return Object.freeze({
    presentation: presentationKey,
    container: containerCode,
    programTier: programTier.key,
    units: fill.units,
    cases: fill.cases,
    pallets: fill.pallets,
    containersNeeded: fill.containersNeeded,
    netWeightKg: fill.netWeightKg,
    grossWeightKg: fill.grossWeightKg,
    weightUtilization: Object.freeze(weightUtilization),
    palletUtilization: Object.freeze(palletUtilization),
  });
}
