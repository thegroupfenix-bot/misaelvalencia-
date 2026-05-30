/**
 * PaymentTermsRegistry.js
 * Payment term tier registry keyed by MT (metric ton) volume thresholds.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// PAYMENT_TERM_TIERS (frozen object — rich metadata, NOT plain strings)
// ---------------------------------------------------------------------------
export const PAYMENT_TERM_TIERS = Object.freeze({
  ADVANCE_100: Object.freeze({
    key: 'ADVANCE_100',
    label: '100% Advance',
    minMT: 0,
    maxMT: 999.99,
    advancePercent: 100,
    balancePercent: 0,
    requiresSecuredInstrument: false,
    defaultInstrument: 'TT',
  }),
  SPLIT_50_50: Object.freeze({
    key: 'SPLIT_50_50',
    label: '50% Advance / 50% Balance',
    minMT: 1000,
    maxMT: 12499.99,
    advancePercent: 50,
    balancePercent: 50,
    requiresSecuredInstrument: false,
    defaultInstrument: 'TT',
  }),
  SPLIT_30_70_SBLC: Object.freeze({
    key: 'SPLIT_30_70_SBLC',
    label: '30% Advance / 70% Balance + SBLC',
    minMT: 12500,
    maxMT: null,
    advancePercent: 30,
    balancePercent: 70,
    requiresSecuredInstrument: true,
    defaultInstrument: 'SBLC',
  }),
});

// ---------------------------------------------------------------------------
// Internal ordered tier list for iteration
// ---------------------------------------------------------------------------
const _ORDERED_TIERS = [
  PAYMENT_TERM_TIERS.ADVANCE_100,
  PAYMENT_TERM_TIERS.SPLIT_50_50,
  PAYMENT_TERM_TIERS.SPLIT_30_70_SBLC,
];

// ---------------------------------------------------------------------------
// getPaymentTierForMT(totalMT)
// Returns the matching PAYMENT_TERM_TIERS entry.
// If totalMT is 0 or null, returns ADVANCE_100.
// ---------------------------------------------------------------------------
export function getPaymentTierForMT(totalMT) {
  if (totalMT === 0 || totalMT === null || totalMT === undefined) {
    return PAYMENT_TERM_TIERS.ADVANCE_100;
  }

  for (const tier of _ORDERED_TIERS) {
    const withinMin = totalMT >= tier.minMT;
    const withinMax = tier.maxMT === null || totalMT <= tier.maxMT;
    if (withinMin && withinMax) {
      return tier;
    }
  }

  // Fallback to highest tier for values beyond all ranges
  return PAYMENT_TERM_TIERS.SPLIT_30_70_SBLC;
}

// ---------------------------------------------------------------------------
// getDefaultInstrument(totalMT)
// Returns the defaultInstrument string for the matching tier.
// ---------------------------------------------------------------------------
export function getDefaultInstrument(totalMT) {
  return getPaymentTierForMT(totalMT).defaultInstrument;
}

// ---------------------------------------------------------------------------
// requiresSBLC(totalMT)
// Returns true if the matching tier requires a secured instrument and
// the defaultInstrument is SBLC.
// ---------------------------------------------------------------------------
export function requiresSBLC(totalMT) {
  const tier = getPaymentTierForMT(totalMT);
  return tier.requiresSecuredInstrument && tier.defaultInstrument === 'SBLC';
}
