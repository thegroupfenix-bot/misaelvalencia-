/**
 * PricingGovernanceRegistry.js
 * Pricing basis definitions and program defaults for GLV trade programs.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { INCOTERMS, TRADE_PROGRAM_TYPES } from '../business/TradeExecutionRegistry.js';

// ---------------------------------------------------------------------------
// PRICING_BASIS (frozen enum)
// Subset of INCOTERMS applicable to GLV pricing governance.
// ---------------------------------------------------------------------------
export const PRICING_BASIS = Object.freeze({
  FOB: INCOTERMS.FOB,
  CFR: INCOTERMS.CFR,
  CIF: INCOTERMS.CIF,
});

// ---------------------------------------------------------------------------
// PRICING_BASIS_PROPERTIES (frozen object)
// Maps each PRICING_BASIS key to metadata.
// ---------------------------------------------------------------------------
export const PRICING_BASIS_PROPERTIES = Object.freeze({
  FOB: Object.freeze({
    label: 'Free on Board',
    includesFreight: false,
    includesInsurance: false,
    riskTransferPoint: 'ORIGIN_PORT',
    applicablePrograms: Object.freeze([
      TRADE_PROGRAM_TYPES.CONTAINER_PROGRAM,
      TRADE_PROGRAM_TYPES.BULK_VESSEL_PROGRAM,
    ]),
  }),
  CFR: Object.freeze({
    label: 'Cost and Freight',
    includesFreight: true,
    includesInsurance: false,
    riskTransferPoint: 'ORIGIN_PORT',
    applicablePrograms: Object.freeze([
      TRADE_PROGRAM_TYPES.CONTAINER_PROGRAM,
      TRADE_PROGRAM_TYPES.BULK_VESSEL_PROGRAM,
    ]),
  }),
  CIF: Object.freeze({
    label: 'Cost Insurance and Freight',
    includesFreight: true,
    includesInsurance: true,
    riskTransferPoint: 'ORIGIN_PORT',
    applicablePrograms: Object.freeze([
      TRADE_PROGRAM_TYPES.CONTAINER_PROGRAM,
      TRADE_PROGRAM_TYPES.BULK_VESSEL_PROGRAM,
    ]),
  }),
});

// ---------------------------------------------------------------------------
// PROGRAM_PRICING_DEFAULTS (frozen object)
// Maps each TRADE_PROGRAM_TYPES key to its default PRICING_BASIS value.
// ---------------------------------------------------------------------------
export const PROGRAM_PRICING_DEFAULTS = Object.freeze({
  [TRADE_PROGRAM_TYPES.CONTAINER_PROGRAM]: PRICING_BASIS.CFR,
  [TRADE_PROGRAM_TYPES.BULK_VESSEL_PROGRAM]: PRICING_BASIS.FOB,
});

// ---------------------------------------------------------------------------
// getPricingBasisProperties(basis)
// Returns the properties object for the given PRICING_BASIS key or throws.
// ---------------------------------------------------------------------------
export function getPricingBasisProperties(basis) {
  const props = PRICING_BASIS_PROPERTIES[basis];
  if (!props) {
    throw new Error(
      `getPricingBasisProperties: pricing basis "${basis}" not found. ` +
        `Valid bases: ${Object.keys(PRICING_BASIS).join(', ')}`
    );
  }
  return props;
}

// ---------------------------------------------------------------------------
// getDefaultPricingBasis(tradeProgram)
// Returns the PRICING_BASIS value for the given trade program or throws.
// ---------------------------------------------------------------------------
export function getDefaultPricingBasis(tradeProgram) {
  const defaultBasis = PROGRAM_PRICING_DEFAULTS[tradeProgram];
  if (defaultBasis === undefined) {
    throw new Error(
      `getDefaultPricingBasis: trade program "${tradeProgram}" not found. ` +
        `Valid programs: ${Object.keys(PROGRAM_PRICING_DEFAULTS).join(', ')}`
    );
  }
  return defaultBasis;
}

// ---------------------------------------------------------------------------
// getPricingBasesForProgram(tradeProgram)
// Returns array of PRICING_BASIS values applicable to the given program.
// ---------------------------------------------------------------------------
export function getPricingBasesForProgram(tradeProgram) {
  return Object.keys(PRICING_BASIS).filter((key) =>
    PRICING_BASIS_PROPERTIES[key].applicablePrograms.includes(tradeProgram)
  );
}

// ---------------------------------------------------------------------------
// isPricingBasisApplicable(basis, tradeProgram)
// Returns boolean — true if the basis is applicable to the trade program.
// ---------------------------------------------------------------------------
export function isPricingBasisApplicable(basis, tradeProgram) {
  const props = PRICING_BASIS_PROPERTIES[basis];
  if (!props) return false;
  return props.applicablePrograms.includes(tradeProgram);
}
