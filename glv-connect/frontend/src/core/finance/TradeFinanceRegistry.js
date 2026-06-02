/**
 * TradeFinanceRegistry.js
 * Trade finance applicability matrix — maps payment instruments to trade programs,
 * currencies, and MT thresholds.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

import { PAYMENT_INSTRUMENTS } from './FinancialInstrumentRegistry.js';
import { CURRENCIES } from './CurrencyRegistry.js';
import { getPaymentTierForMT } from './PaymentTermsRegistry.js';

// ---------------------------------------------------------------------------
// TRADE_FINANCE_MATRIX (frozen object)
// Maps each PAYMENT_INSTRUMENTS key to applicability rules.
// ---------------------------------------------------------------------------
export const TRADE_FINANCE_MATRIX = Object.freeze({
  [PAYMENT_INSTRUMENTS.TT]: Object.freeze({
    applicableTradePrograms: Object.freeze(['CONTAINER_PROGRAM', 'BULK_VESSEL_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD', 'EUR', 'COP']),
    minMT: 0,
    maxMT: 12499.99,
  }),
  [PAYMENT_INSTRUMENTS.DLC]: Object.freeze({
    applicableTradePrograms: Object.freeze(['CONTAINER_PROGRAM', 'BULK_VESSEL_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD', 'EUR']),
    minMT: 1000,
    maxMT: null,
  }),
  [PAYMENT_INSTRUMENTS.LC]: Object.freeze({
    applicableTradePrograms: Object.freeze(['CONTAINER_PROGRAM', 'BULK_VESSEL_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD', 'EUR', 'CNY']),
    minMT: 500,
    maxMT: null,
  }),
  [PAYMENT_INSTRUMENTS.SBLC]: Object.freeze({
    applicableTradePrograms: Object.freeze(['BULK_VESSEL_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD', 'EUR']),
    minMT: 12500,
    maxMT: null,
  }),
  [PAYMENT_INSTRUMENTS.ESCROW]: Object.freeze({
    applicableTradePrograms: Object.freeze(['CONTAINER_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD']),
    minMT: 0,
    maxMT: 6249.99,
  }),
  [PAYMENT_INSTRUMENTS.CAD]: Object.freeze({
    applicableTradePrograms: Object.freeze(['CONTAINER_PROGRAM', 'BULK_VESSEL_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD', 'EUR']),
    minMT: 0,
    maxMT: null,
  }),
  [PAYMENT_INSTRUMENTS.OPEN_ACCOUNT]: Object.freeze({
    applicableTradePrograms: Object.freeze(['CONTAINER_PROGRAM']),
    applicableCurrencies: Object.freeze(['USD', 'EUR', 'COP']),
    minMT: 0,
    maxMT: 999.99,
  }),
});

// ---------------------------------------------------------------------------
// isInstrumentApplicable(instrument, totalMT, tradeProgram, currency)
// Returns boolean — true if all three criteria are satisfied.
// ---------------------------------------------------------------------------
export function isInstrumentApplicable(instrument, totalMT, tradeProgram, currency) {
  const rule = TRADE_FINANCE_MATRIX[instrument];
  if (!rule) return false;

  const withinMinMT = typeof totalMT === 'number' ? totalMT >= rule.minMT : true;
  const withinMaxMT =
    rule.maxMT === null || (typeof totalMT === 'number' && totalMT <= rule.maxMT);
  const programMatch = rule.applicableTradePrograms.includes(tradeProgram);
  const currencyMatch = rule.applicableCurrencies.includes(currency);

  return withinMinMT && withinMaxMT && programMatch && currencyMatch;
}

// ---------------------------------------------------------------------------
// getAvailableInstruments(totalMT, tradeProgram, currency)
// Returns array of instrument keys matching all criteria.
// ---------------------------------------------------------------------------
export function getAvailableInstruments(totalMT, tradeProgram, currency) {
  return Object.keys(PAYMENT_INSTRUMENTS).filter((key) =>
    isInstrumentApplicable(key, totalMT, tradeProgram, currency)
  );
}

// ---------------------------------------------------------------------------
// getRecommendedInstrument(totalMT)
// Returns the defaultInstrument from the matching payment tier.
// ---------------------------------------------------------------------------
export function getRecommendedInstrument(totalMT) {
  return getPaymentTierForMT(totalMT).defaultInstrument;
}
