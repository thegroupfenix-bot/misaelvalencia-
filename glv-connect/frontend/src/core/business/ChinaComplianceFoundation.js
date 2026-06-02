/**
 * ChinaComplianceFoundation.js
 * GACC compliance scaffolding for China market entry.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// GACC_STATUS (frozen enum)
// ---------------------------------------------------------------------------
export const GACC_STATUS = Object.freeze({
  NOT_REGISTERED: 'NOT_REGISTERED',
  PENDING_REGISTRATION: 'PENDING_REGISTRATION',
  REGISTERED: 'REGISTERED',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
});

// ---------------------------------------------------------------------------
// GACC_PRODUCT_CATEGORIES (frozen enum)
// ---------------------------------------------------------------------------
export const GACC_PRODUCT_CATEGORIES = Object.freeze({
  BEEF: 'BEEF',
  POULTRY: 'POULTRY',
  PORK: 'PORK',
  SEAFOOD: 'SEAFOOD',
  DAIRY: 'DAIRY',
  GRAIN: 'GRAIN',
  VEGETABLE_OIL: 'VEGETABLE_OIL',
  PROCESSED_FOOD: 'PROCESSED_FOOD',
});

// ---------------------------------------------------------------------------
// CHINA_COMPLIANCE_REQUIREMENTS (frozen)
// Maps each product category to its China-specific compliance requirements.
// ---------------------------------------------------------------------------
export const CHINA_COMPLIANCE_REQUIREMENTS = Object.freeze({
  [GACC_PRODUCT_CATEGORIES.BEEF]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: true,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.POULTRY]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: true,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.PORK]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: true,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.SEAFOOD]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: true,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.DAIRY]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: true,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.GRAIN]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: true,
    requiresVeterinaryCert: false,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.VEGETABLE_OIL]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: false,
    requiresCIQ: true,
  }),
  [GACC_PRODUCT_CATEGORIES.PROCESSED_FOOD]: Object.freeze({
    requiresGACC: true,
    requiresPhytosanitary: false,
    requiresVeterinaryCert: false,
    requiresCIQ: true,
  }),
});

// ---------------------------------------------------------------------------
// createGACCAssignment(fields)
// Returns frozen GACC assignment record.
// Required: assignmentId, legalEntityId, productCategory, status
// Optional (nullable): gaccNumber, expiresAt
// Always sets: assignedAt = now
// ---------------------------------------------------------------------------
export function createGACCAssignment(fields = {}) {
  const REQUIRED_FIELDS = ['assignmentId', 'legalEntityId', 'productCategory', 'status'];

  for (const field of REQUIRED_FIELDS) {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      throw new Error(`createGACCAssignment: missing required field "${field}"`);
    }
  }

  const record = {
    gaccNumber: null,
    expiresAt: null,
    ...fields,
    assignedAt: new Date().toISOString(),
  };

  const validationError = validateGACCAssignment(record);
  if (validationError) {
    throw new Error(`createGACCAssignment validation failed: ${validationError}`);
  }

  return Object.freeze(record);
}

// ---------------------------------------------------------------------------
// validateGACCAssignment(record)
// Returns error string or null.
// ---------------------------------------------------------------------------
export function validateGACCAssignment(record) {
  if (!record || typeof record !== 'object') {
    return 'GACC assignment must be a non-null object';
  }

  const REQUIRED_FIELDS = ['assignmentId', 'legalEntityId', 'productCategory', 'status'];

  for (const field of REQUIRED_FIELDS) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      return `Missing or empty required field: ${field}`;
    }
  }

  if (!Object.values(GACC_PRODUCT_CATEGORIES).includes(record.productCategory)) {
    return (
      `Invalid productCategory: "${record.productCategory}". ` +
      `Must be one of: ${Object.values(GACC_PRODUCT_CATEGORIES).join(', ')}`
    );
  }

  if (!Object.values(GACC_STATUS).includes(record.status)) {
    return (
      `Invalid status: "${record.status}". ` +
      `Must be one of: ${Object.values(GACC_STATUS).join(', ')}`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// isGACCRequired(productCategory)
// Returns boolean — reads from CHINA_COMPLIANCE_REQUIREMENTS.
// ---------------------------------------------------------------------------
export function isGACCRequired(productCategory) {
  const requirements = CHINA_COMPLIANCE_REQUIREMENTS[productCategory];
  if (!requirements) return false;
  return requirements.requiresGACC === true;
}

// ---------------------------------------------------------------------------
// getComplianceRequirements(productCategory)
// Returns the compliance requirements entry or throws.
// ---------------------------------------------------------------------------
export function getComplianceRequirements(productCategory) {
  const requirements = CHINA_COMPLIANCE_REQUIREMENTS[productCategory];
  if (!requirements) {
    throw new Error(
      `getComplianceRequirements: unknown product category "${productCategory}". ` +
        `Valid categories: ${Object.values(GACC_PRODUCT_CATEGORIES).join(', ')}`
    );
  }
  return requirements;
}
