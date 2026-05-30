/**
 * FruitCatalogRegistry.js
 * Master registry of tropical fruits for frozen/fresh/reefer export.
 * Designed for future expansion.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// FRUIT_CATALOG (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const FRUIT_CATALOG = Object.freeze({
  MANGO: Object.freeze({
    productCode: 'FRU-MNG',
    key: 'MANGO',
    commonName: 'Mango',
    scientificName: 'Mangifera indica',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: true,
    pulpEligible: true,
    originCountries: Object.freeze(['CO', 'MX', 'PE', 'BR', 'EC']),
  }),
  PINEAPPLE: Object.freeze({
    productCode: 'FRU-PIN',
    key: 'PINEAPPLE',
    commonName: 'Pineapple',
    scientificName: 'Ananas comosus',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: true,
    pulpEligible: true,
    originCountries: Object.freeze(['CR', 'CO', 'EC', 'PH', 'TH']),
  }),
  PASSION_FRUIT: Object.freeze({
    productCode: 'FRU-PAS',
    key: 'PASSION_FRUIT',
    commonName: 'Passion Fruit',
    scientificName: 'Passiflora edulis',
    frozenEligible: true,
    freshEligible: false,
    reeferEligible: true,
    iqdCompatible: false,
    pulpEligible: true,
    originCountries: Object.freeze(['CO', 'BR', 'EC', 'PE']),
  }),
  GUAVA: Object.freeze({
    productCode: 'FRU-GUA',
    key: 'GUAVA',
    commonName: 'Guava',
    scientificName: 'Psidium guajava',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: false,
    pulpEligible: true,
    originCountries: Object.freeze(['CO', 'MX', 'BR', 'PE']),
  }),
  SOURSOP: Object.freeze({
    productCode: 'FRU-SOU',
    key: 'SOURSOP',
    commonName: 'Soursop',
    scientificName: 'Annona muricata',
    frozenEligible: true,
    freshEligible: false,
    reeferEligible: false,
    iqdCompatible: false,
    pulpEligible: true,
    originCountries: Object.freeze(['CO', 'VE', 'BR', 'MX']),
  }),
  LULO: Object.freeze({
    productCode: 'FRU-LUL',
    key: 'LULO',
    commonName: 'Lulo (Naranjilla)',
    scientificName: 'Solanum quitoense',
    frozenEligible: true,
    freshEligible: false,
    reeferEligible: true,
    iqdCompatible: false,
    pulpEligible: true,
    originCountries: Object.freeze(['CO', 'EC']),
  }),
  BANANA: Object.freeze({
    productCode: 'FRU-BAN',
    key: 'BANANA',
    commonName: 'Banana',
    scientificName: 'Musa acuminata',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: true,
    pulpEligible: true,
    originCountries: Object.freeze(['EC', 'CO', 'CR', 'GT', 'HN']),
  }),
  PAPAYA: Object.freeze({
    productCode: 'FRU-PAP',
    key: 'PAPAYA',
    commonName: 'Papaya',
    scientificName: 'Carica papaya',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: true,
    pulpEligible: true,
    originCountries: Object.freeze(['CO', 'MX', 'BR', 'IN']),
  }),
  STRAWBERRY: Object.freeze({
    productCode: 'FRU-STR',
    key: 'STRAWBERRY',
    commonName: 'Strawberry',
    scientificName: 'Fragaria × ananassa',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: true,
    pulpEligible: false,
    originCountries: Object.freeze(['CO', 'MX', 'ES', 'US']),
  }),
  BLACKBERRY: Object.freeze({
    productCode: 'FRU-BLK',
    key: 'BLACKBERRY',
    commonName: 'Blackberry',
    scientificName: 'Rubus fruticosus',
    frozenEligible: true,
    freshEligible: true,
    reeferEligible: true,
    iqdCompatible: true,
    pulpEligible: false,
    originCountries: Object.freeze(['CO', 'MX', 'US', 'GT']),
  }),
});

// ---------------------------------------------------------------------------
// getFruit(key)
// Returns the entry for the given key or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getFruit(key) {
  const entry = FRUIT_CATALOG[key];
  if (!entry) {
    throw new Error(
      `getFruit: key "${key}" not found. ` +
        `Valid keys: ${Object.keys(FRUIT_CATALOG).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// getFrozenEligibleFruits()
// Returns array of entries where frozenEligible === true.
// ---------------------------------------------------------------------------
export function getFrozenEligibleFruits() {
  return Object.values(FRUIT_CATALOG).filter((f) => f.frozenEligible === true);
}

// ---------------------------------------------------------------------------
// getPulpEligibleFruits()
// Returns array of entries where pulpEligible === true.
// ---------------------------------------------------------------------------
export function getPulpEligibleFruits() {
  return Object.values(FRUIT_CATALOG).filter((f) => f.pulpEligible === true);
}

// ---------------------------------------------------------------------------
// getReeferEligibleFruits()
// Returns array of entries where reeferEligible === true.
// ---------------------------------------------------------------------------
export function getReeferEligibleFruits() {
  return Object.values(FRUIT_CATALOG).filter((f) => f.reeferEligible === true);
}

// ---------------------------------------------------------------------------
// getFruitsByOrigin(countryCode)
// Returns array of entries where originCountries includes the countryCode.
// ---------------------------------------------------------------------------
export function getFruitsByOrigin(countryCode) {
  return Object.values(FRUIT_CATALOG).filter((f) =>
    f.originCountries.includes(countryCode)
  );
}

// ---------------------------------------------------------------------------
// isValidFruit(key)
// Returns boolean — true if key matches a known fruit entry.
// ---------------------------------------------------------------------------
export function isValidFruit(key) {
  return Object.prototype.hasOwnProperty.call(FRUIT_CATALOG, key);
}
