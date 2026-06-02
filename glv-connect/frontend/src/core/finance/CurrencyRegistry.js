/**
 * CurrencyRegistry.js
 * Canonical registry of currencies supported by GLV entities.
 * FINANCIAL_INSTRUMENT_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// CURRENCIES (frozen enum)
// ---------------------------------------------------------------------------
export const CURRENCIES = Object.freeze({
  USD: 'USD',
  EUR: 'EUR',
  BRL: 'BRL',
  COP: 'COP',
  CNY: 'CNY',
});

// ---------------------------------------------------------------------------
// CURRENCY_PROPERTIES (frozen object)
// Maps each currency code to its metadata.
// ---------------------------------------------------------------------------
export const CURRENCY_PROPERTIES = Object.freeze({
  USD: Object.freeze({
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimalPlaces: 2,
    associatedEntities: Object.freeze(['GLV-SAS', 'GLV-LLC', 'GLV-BRZ']),
  }),
  EUR: Object.freeze({
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    decimalPlaces: 2,
    associatedEntities: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
  BRL: Object.freeze({
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    decimalPlaces: 2,
    associatedEntities: Object.freeze(['GLV-BRZ']),
  }),
  COP: Object.freeze({
    code: 'COP',
    symbol: '$',
    name: 'Colombian Peso',
    decimalPlaces: 0,
    associatedEntities: Object.freeze(['GLV-SAS']),
  }),
  CNY: Object.freeze({
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan Renminbi',
    decimalPlaces: 2,
    associatedEntities: Object.freeze(['GLV-SAS', 'GLV-LLC']),
  }),
});

// ---------------------------------------------------------------------------
// getCurrencyProperties(currency)
// Returns the properties object for the given currency code or throws.
// ---------------------------------------------------------------------------
export function getCurrencyProperties(currency) {
  const props = CURRENCY_PROPERTIES[currency];
  if (!props) {
    throw new Error(
      `getCurrencyProperties: currency "${currency}" not found. ` +
        `Valid currencies: ${Object.keys(CURRENCIES).join(', ')}`
    );
  }
  return props;
}

// ---------------------------------------------------------------------------
// getCurrenciesForEntity(entityId)
// Returns array of CURRENCIES keys where associatedEntities includes entityId.
// ---------------------------------------------------------------------------
export function getCurrenciesForEntity(entityId) {
  return Object.keys(CURRENCIES).filter((key) =>
    CURRENCY_PROPERTIES[key].associatedEntities.includes(entityId)
  );
}

// ---------------------------------------------------------------------------
// isValidCurrency(currency)
// Returns boolean — true if currency is a known CURRENCIES key.
// ---------------------------------------------------------------------------
export function isValidCurrency(currency) {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, currency);
}
