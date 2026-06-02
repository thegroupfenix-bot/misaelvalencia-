/**
 * FrozenCommercialProgramRegistry.js
 * Commercial scale program tiers for frozen cargo operations.
 * FROZEN_LOGISTICS_INTELLIGENCE_V1
 *
 * Standalone — no imports from business layer to avoid coupling.
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// FROZEN_PROGRAM_TIERS (frozen object)
// Commercial scale tiers specific to frozen cargo trade.
// ---------------------------------------------------------------------------
export const FROZEN_PROGRAM_TIERS = Object.freeze({
  MICRO: Object.freeze({
    key: 'MICRO',
    label: 'Micro Program',
    minimumMT: 0,
    maximumMT: 25.99,
    minContainers: 0,
    maxContainers: 1,
    logisticsProfile: 'LCL or partial RF20',
    paymentTier: 'ADVANCE_100',
  }),
  CONTAINER: Object.freeze({
    key: 'CONTAINER',
    label: 'Container Program',
    minimumMT: 26,
    maximumMT: 999.99,
    minContainers: 1,
    maxContainers: null,
    logisticsProfile: 'FCL reefer containers',
    paymentTier: 'ADVANCE_100',
  }),
  PROGRAM: Object.freeze({
    key: 'PROGRAM',
    label: 'Export Program',
    minimumMT: 1000,
    maximumMT: 4999.99,
    minContainers: null,
    maxContainers: null,
    logisticsProfile: 'Multi-container reefer program',
    paymentTier: 'SPLIT_50_50',
  }),
  STRATEGIC: Object.freeze({
    key: 'STRATEGIC',
    label: 'Strategic Program',
    minimumMT: 5000,
    maximumMT: 24999.99,
    minContainers: null,
    maxContainers: null,
    logisticsProfile: 'Dedicated reefer program',
    paymentTier: 'SPLIT_50_50',
  }),
  MEGA: Object.freeze({
    key: 'MEGA',
    label: 'Mega Program',
    minimumMT: 25000,
    maximumMT: null,
    minContainers: null,
    maxContainers: null,
    logisticsProfile: 'Bulk vessel or dedicated reefer fleet',
    paymentTier: 'SPLIT_30_70_SBLC',
  }),
});

// ---------------------------------------------------------------------------
// getProgramTierForMT(totalMT)
// Returns the matching FROZEN_PROGRAM_TIERS entry for a given MT volume.
// Returns MICRO for 0 or null.
// ---------------------------------------------------------------------------
export function getProgramTierForMT(totalMT) {
  if (totalMT === null || totalMT === undefined || totalMT <= 0) {
    return FROZEN_PROGRAM_TIERS.MICRO;
  }
  const tiers = Object.values(FROZEN_PROGRAM_TIERS);
  for (const tier of tiers) {
    const aboveMin = totalMT >= tier.minimumMT;
    const belowMax = tier.maximumMT === null || totalMT <= tier.maximumMT;
    if (aboveMin && belowMax) {
      return tier;
    }
  }
  // Fallback to MEGA for anything above all defined tiers
  return FROZEN_PROGRAM_TIERS.MEGA;
}

// ---------------------------------------------------------------------------
// getProgramLabel(totalMT)
// Returns the label string for the program tier matching the given MT.
// ---------------------------------------------------------------------------
export function getProgramLabel(totalMT) {
  return getProgramTierForMT(totalMT).label;
}

// ---------------------------------------------------------------------------
// requiresSBLC(totalMT)
// Returns boolean — true only for MEGA tier.
// ---------------------------------------------------------------------------
export function requiresSBLC(totalMT) {
  return getProgramTierForMT(totalMT).key === 'MEGA';
}

// ---------------------------------------------------------------------------
// isContainerProgram(totalMT)
// Returns boolean — true for CONTAINER tier only.
// ---------------------------------------------------------------------------
export function isContainerProgram(totalMT) {
  return getProgramTierForMT(totalMT).key === 'CONTAINER';
}
