/**
 * FinancialInstrumentRegistry.js
 * Canonical registry of payment instruments supported by GLV entities.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// PAYMENT_INSTRUMENTS (frozen enum)
// ---------------------------------------------------------------------------
export const PAYMENT_INSTRUMENTS = Object.freeze({
  TT: 'TT',
  DLC: 'DLC',
  LC: 'LC',
  SBLC: 'SBLC',
  ESCROW: 'ESCROW',
  CAD: 'CAD',
  OPEN_ACCOUNT: 'OPEN_ACCOUNT',
});

// ---------------------------------------------------------------------------
// INSTRUMENT_PROPERTIES (frozen object)
// Maps each instrument key to its metadata.
// ---------------------------------------------------------------------------
export const INSTRUMENT_PROPERTIES = Object.freeze({
  TT: Object.freeze({
    label: 'Telegraphic Transfer',
    abbreviation: 'T/T',
    requiresBankVerification: false,
    isSecured: false,
    typicalLeadDays: 1,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  DLC: Object.freeze({
    label: 'Documentary Letter of Credit',
    abbreviation: 'DLC',
    requiresBankVerification: true,
    isSecured: true,
    typicalLeadDays: 21,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  LC: Object.freeze({
    label: 'Letter of Credit',
    abbreviation: 'L/C',
    requiresBankVerification: true,
    isSecured: true,
    typicalLeadDays: 14,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  SBLC: Object.freeze({
    label: 'Standby Letter of Credit',
    abbreviation: 'SBLC',
    requiresBankVerification: true,
    isSecured: true,
    typicalLeadDays: 10,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  ESCROW: Object.freeze({
    label: 'Escrow',
    abbreviation: 'ESCROW',
    requiresBankVerification: true,
    isSecured: true,
    typicalLeadDays: 5,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  CAD: Object.freeze({
    label: 'Cash Against Documents',
    abbreviation: 'C.A.D.',
    requiresBankVerification: false,
    isSecured: false,
    typicalLeadDays: 3,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  OPEN_ACCOUNT: Object.freeze({
    label: 'Open Account',
    abbreviation: 'O/A',
    requiresBankVerification: false,
    isSecured: false,
    typicalLeadDays: 0,
    supportedBy: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
});

// ---------------------------------------------------------------------------
// getInstrumentProperties(instrument)
// Returns the properties object for the given instrument key or throws.
// ---------------------------------------------------------------------------
export function getInstrumentProperties(instrument) {
  const props = INSTRUMENT_PROPERTIES[instrument];
  if (!props) {
    throw new Error(
      `getInstrumentProperties: instrument "${instrument}" not found. ` +
        `Valid instruments: ${Object.keys(PAYMENT_INSTRUMENTS).join(', ')}`
    );
  }
  return props;
}

// ---------------------------------------------------------------------------
// isSecuredInstrument(instrument)
// Returns boolean — true if the instrument is secured.
// ---------------------------------------------------------------------------
export function isSecuredInstrument(instrument) {
  const props = getInstrumentProperties(instrument);
  return props.isSecured;
}

// ---------------------------------------------------------------------------
// getInstrumentsForEntity(entityId)
// Returns array of instrument keys where supportedBy includes the entityId.
// ---------------------------------------------------------------------------
export function getInstrumentsForEntity(entityId) {
  return Object.keys(PAYMENT_INSTRUMENTS).filter((key) =>
    INSTRUMENT_PROPERTIES[key].supportedBy.includes(entityId)
  );
}
