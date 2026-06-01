/**
 * OperationChainEngine.js — GLV GOS Core Domain — Operation Chain Foundation V1.0
 *
 * Multi-entity operation chain management for export operations.
 * Links the full chain: sales entity → invoice entity → supplier → inspection → logistics
 * → insurance → banking → origin country → destination country.
 *
 * STATUS: FOUNDATION — chain schema, creation, validation, and summary defined.
 * Persistence and cross-domain linking to be layered on top.
 */

// ─── Chain entity role constants ───────────────────────────────────────────────

export const CHAIN_ROLES = Object.freeze({
  SALES_ENTITY:       "SALES_ENTITY",
  INVOICE_ENTITY:     "INVOICE_ENTITY",
  SUPPLIER_ENTITY:    "SUPPLIER_ENTITY",
  INSPECTION_ENTITY:  "INSPECTION_ENTITY",
  LOGISTICS_ENTITY:   "LOGISTICS_ENTITY",
  INSURANCE_ENTITY:   "INSURANCE_ENTITY",
  BANKING_ENTITY:     "BANKING_ENTITY",
  DESTINATION_COUNTRY:"DESTINATION_COUNTRY",
  ORIGIN_COUNTRY:     "ORIGIN_COUNTRY",
});

export const CHAIN_STATUS = Object.freeze({
  DRAFT:      "DRAFT",
  ACTIVE:     "ACTIVE",
  COMPLETE:   "COMPLETE",
  CANCELLED:  "CANCELLED",
  ON_HOLD:    "ON_HOLD",
});

// ─── Chain entity schema ────────────────────────────────────────────────────────

/**
 * Create a single entity node within an operation chain.
 */
export function createChainEntity({
  role,
  entityId,
  entityName,
  country      = null,
  taxId        = null,
  contactName  = null,
  contactEmail = null,
  notes        = null,
}) {
  if (!role || !CHAIN_ROLES[role]) {
    throw new Error(`[OperationChainEngine] Invalid chain role: "${role}"`);
  }
  return Object.freeze({
    role,
    entityId:     entityId || null,
    entityName:   entityName || null,
    country,
    taxId,
    contactName,
    contactEmail,
    notes,
    _addedAt: new Date().toISOString(),
  });
}

// ─── Operation chain ────────────────────────────────────────────────────────────

/**
 * Create a canonical operation chain record.
 *
 * @param {object} params
 * @param {string} params.operationId   — e.g. "SCO-GLV-2026-001"
 * @param {string} params.category      — product category (OILS, GRAINS, LIVE_ANIMALS, …)
 * @param {string} params.currency      — operation base currency
 * @param {object[]} params.entities    — array of chain entity objects (createChainEntity)
 * @param {string} [params.status]      — CHAIN_STATUS value
 * @param {string} [params.notes]
 */
export function createOperationChain({
  operationId,
  category,
  currency,
  entities     = [],
  status       = CHAIN_STATUS.DRAFT,
  notes        = null,
}) {
  const entityMap = {};
  for (const entity of entities) {
    entityMap[entity.role] = entity;
  }

  return Object.freeze({
    operationId,
    category,
    currency,
    status,
    entities:   Object.freeze(entityMap),
    notes,
    _schema:    "GLV_OPERATION_CHAIN_V1",
    _createdAt: new Date().toISOString(),
  });
}

// ─── Validation ─────────────────────────────────────────────────────────────────

const REQUIRED_ROLES = [
  CHAIN_ROLES.SALES_ENTITY,
  CHAIN_ROLES.INVOICE_ENTITY,
  CHAIN_ROLES.ORIGIN_COUNTRY,
  CHAIN_ROLES.DESTINATION_COUNTRY,
];

/**
 * Validate an operation chain for completeness.
 * Never throws — returns structured validation report.
 *
 * @param {object} chain — result of createOperationChain()
 * @returns {{ valid: boolean, missing: string[], warnings: string[], report: string }}
 */
export function validateOperationChain(chain = {}) {
  const issues   = [];
  const warnings = [];

  if (!chain.operationId) issues.push("operationId is required");
  if (!chain.category)    issues.push("category is required");
  if (!chain.currency)    issues.push("currency is required");

  const entities = chain.entities || {};

  for (const role of REQUIRED_ROLES) {
    if (!entities[role]) {
      issues.push(`Missing required chain entity: ${role}`);
    }
  }

  if (!entities[CHAIN_ROLES.LOGISTICS_ENTITY]) {
    warnings.push("LOGISTICS_ENTITY not set — logistics details incomplete");
  }
  if (!entities[CHAIN_ROLES.BANKING_ENTITY]) {
    warnings.push("BANKING_ENTITY not set — banking details incomplete");
  }

  return Object.freeze({
    valid:    issues.length === 0,
    missing:  issues,
    warnings,
    report:   issues.length === 0
      ? `Operation chain "${chain.operationId}" is valid.`
      : `Operation chain "${chain.operationId}" has ${issues.length} issue(s).`,
  });
}

// ─── Summary ───────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable summary of the operation chain.
 *
 * @param {object} chain — result of createOperationChain()
 * @returns {object}
 */
export function getOperationChainSummary(chain = {}) {
  const entities = chain.entities || {};

  const resolve = (role) => {
    const e = entities[role];
    return e ? (e.entityName || e.entityId || "—") : "—";
  };

  return Object.freeze({
    operationId:        chain.operationId || "—",
    category:           chain.category || "—",
    currency:           chain.currency || "—",
    status:             chain.status || "—",
    salesEntity:        resolve(CHAIN_ROLES.SALES_ENTITY),
    invoiceEntity:      resolve(CHAIN_ROLES.INVOICE_ENTITY),
    supplierEntity:     resolve(CHAIN_ROLES.SUPPLIER_ENTITY),
    inspectionEntity:   resolve(CHAIN_ROLES.INSPECTION_ENTITY),
    logisticsEntity:    resolve(CHAIN_ROLES.LOGISTICS_ENTITY),
    insuranceEntity:    resolve(CHAIN_ROLES.INSURANCE_ENTITY),
    bankingEntity:      resolve(CHAIN_ROLES.BANKING_ENTITY),
    originCountry:      resolve(CHAIN_ROLES.ORIGIN_COUNTRY),
    destinationCountry: resolve(CHAIN_ROLES.DESTINATION_COUNTRY),
    entityCount:        Object.keys(entities).length,
    _generated:         new Date().toISOString(),
  });
}
