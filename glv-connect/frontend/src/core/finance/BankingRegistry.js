/**
 * BankingRegistry.js
 * Banking capability metadata per GLV entity.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * CRITICAL: NO account numbers, routing numbers, SWIFT codes, or any sensitive
 * financial data. Capability flags only.
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// BANKING_ENTITY_MAP (frozen object)
// Maps entity keys to banking capability metadata.
// ---------------------------------------------------------------------------
export const BANKING_ENTITY_MAP = Object.freeze({
  GLV_SAS: Object.freeze({
    entityId: 'GLV-SAS',
    entityName: 'GLV Services SAS',
    country: 'CO',
    primaryCurrency: 'USD',
    supportedCurrencies: Object.freeze(['USD', 'COP']),
    supportsInternationalWire: true,
    supportsLC: true,
    supportsSBLC: true,
    status: 'ACTIVE',
  }),
  GLV_LLC: Object.freeze({
    entityId: 'GLV-LLC',
    entityName: 'GLV Global Food Services LLC',
    country: 'US',
    primaryCurrency: 'USD',
    supportedCurrencies: Object.freeze(['USD', 'EUR', 'CNY']),
    supportsInternationalWire: true,
    supportsLC: true,
    supportsSBLC: true,
    status: 'ACTIVE',
  }),
  GLV_BRZ: Object.freeze({
    entityId: 'GLV-BRZ',
    entityName: 'GLV Brazil (Future Entity)',
    country: 'BR',
    primaryCurrency: 'BRL',
    supportedCurrencies: Object.freeze(['BRL', 'USD']),
    supportsInternationalWire: false,
    supportsLC: false,
    supportsSBLC: false,
    status: 'PENDING',
  }),
});

// ---------------------------------------------------------------------------
// getBankingConfig(entityId)
// Returns the banking config for the given entityId or throws.
// ---------------------------------------------------------------------------
export function getBankingConfig(entityId) {
  const config = Object.values(BANKING_ENTITY_MAP).find(
    (entry) => entry.entityId === entityId
  );
  if (!config) {
    throw new Error(
      `getBankingConfig: entity "${entityId}" not found. ` +
        `Valid entityIds: ${Object.values(BANKING_ENTITY_MAP).map((e) => e.entityId).join(', ')}`
    );
  }
  return config;
}

// ---------------------------------------------------------------------------
// supportsInstrument(entityId, instrument)
// Returns boolean — maps instrument to required capability flags:
//   LC/DLC  → supportsLC
//   SBLC    → supportsSBLC
//   TT/ESCROW/CAD/OPEN_ACCOUNT → supportsInternationalWire (or true if domestic)
// ---------------------------------------------------------------------------
export function supportsInstrument(entityId, instrument) {
  const config = getBankingConfig(entityId);

  switch (instrument) {
    case 'LC':
    case 'DLC':
      return config.supportsLC;

    case 'SBLC':
      return config.supportsSBLC;

    case 'TT':
    case 'ESCROW':
    case 'CAD':
    case 'OPEN_ACCOUNT':
      return config.supportsInternationalWire;

    default:
      throw new Error(
        `supportsInstrument: unknown instrument "${instrument}". ` +
          `Valid instruments: LC, DLC, SBLC, TT, ESCROW, CAD, OPEN_ACCOUNT`
      );
  }
}

// ---------------------------------------------------------------------------
// getCapableEntities(instrument)
// Returns array of entityIds that support the given instrument.
// ---------------------------------------------------------------------------
export function getCapableEntities(instrument) {
  return Object.values(BANKING_ENTITY_MAP)
    .filter((config) => supportsInstrument(config.entityId, instrument))
    .map((config) => config.entityId);
}
