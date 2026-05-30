/**
 * ProductPresentationRegistry.js
 * Standardized commercial presentations for frozen cargo.
 * FROZEN_CARGO_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// PRESENTATION_CATEGORIES (frozen enum)
// ---------------------------------------------------------------------------
export const PRESENTATION_CATEGORIES = Object.freeze({
  RETAIL: 'RETAIL',
  FOODSERVICE: 'FOODSERVICE',
  INDUSTRIAL: 'INDUSTRIAL',
});

// ---------------------------------------------------------------------------
// PRODUCT_PRESENTATIONS (frozen object — rich metadata)
// ---------------------------------------------------------------------------
export const PRODUCT_PRESENTATIONS = Object.freeze({
  RETAIL_100G: Object.freeze({
    key: 'RETAIL_100G',
    label: 'Retail 100g',
    netWeightKg: 0.1,
    category: 'RETAIL',
    frozenCompatible: true,
  }),
  RETAIL_250G: Object.freeze({
    key: 'RETAIL_250G',
    label: 'Retail 250g',
    netWeightKg: 0.25,
    category: 'RETAIL',
    frozenCompatible: true,
  }),
  RETAIL_500G: Object.freeze({
    key: 'RETAIL_500G',
    label: 'Retail 500g',
    netWeightKg: 0.5,
    category: 'RETAIL',
    frozenCompatible: true,
  }),
  RETAIL_1KG: Object.freeze({
    key: 'RETAIL_1KG',
    label: 'Retail 1kg',
    netWeightKg: 1.0,
    category: 'RETAIL',
    frozenCompatible: true,
  }),
  FOODSERVICE_2KG: Object.freeze({
    key: 'FOODSERVICE_2KG',
    label: 'Foodservice 2kg',
    netWeightKg: 2.0,
    category: 'FOODSERVICE',
    frozenCompatible: true,
  }),
  FOODSERVICE_5KG: Object.freeze({
    key: 'FOODSERVICE_5KG',
    label: 'Foodservice 5kg',
    netWeightKg: 5.0,
    category: 'FOODSERVICE',
    frozenCompatible: true,
  }),
  INDUSTRIAL_20KG: Object.freeze({
    key: 'INDUSTRIAL_20KG',
    label: 'Industrial 20kg',
    netWeightKg: 20.0,
    category: 'INDUSTRIAL',
    frozenCompatible: true,
  }),
});

// ---------------------------------------------------------------------------
// getPresentationsByCategory(category)
// Returns array of PRODUCT_PRESENTATIONS entries matching the given category.
// ---------------------------------------------------------------------------
export function getPresentationsByCategory(category) {
  return Object.values(PRODUCT_PRESENTATIONS).filter(
    (p) => p.category === category
  );
}

// ---------------------------------------------------------------------------
// getPresentation(key)
// Returns the entry for the given key or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getPresentation(key) {
  const entry = PRODUCT_PRESENTATIONS[key];
  if (!entry) {
    throw new Error(
      `getPresentation: key "${key}" not found. ` +
        `Valid keys: ${Object.keys(PRODUCT_PRESENTATIONS).join(', ')}`
    );
  }
  return entry;
}

// ---------------------------------------------------------------------------
// isFrozenCompatible(key)
// Returns boolean — true if the presentation is frozen compatible.
// ---------------------------------------------------------------------------
export function isFrozenCompatible(key) {
  const entry = PRODUCT_PRESENTATIONS[key];
  return entry ? entry.frozenCompatible === true : false;
}
