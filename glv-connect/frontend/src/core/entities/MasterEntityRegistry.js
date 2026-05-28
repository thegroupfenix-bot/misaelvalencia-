/**
 * MasterEntityRegistry.js — GLV GOS Core Domain — Entity Registry Foundation V1.0
 *
 * Central registry of GLV corporate entities for use in documents, invoices,
 * signatures, and operation chains.
 *
 * STATUS: FOUNDATION — entity schema and resolver defined.
 * Sensitive fields (bank accounts, tax IDs, signatures) are NOT stored here.
 * Those are managed in secure server-side configuration and injected at runtime.
 *
 * SECURITY NOTE: This file is safe to commit. No confidential values are exposed.
 * Bank account numbers, tax credentials, and private keys are resolved server-side.
 */

// ─── Entity type constants ──────────────────────────────────────────────────────

export const ENTITY_TYPES = Object.freeze({
  OPERATING_COMPANY:  "OPERATING_COMPANY",
  TRADING_COMPANY:    "TRADING_COMPANY",
  HOLDING:            "HOLDING",
  SUBSIDIARY:         "SUBSIDIARY",
  BRANCH:             "BRANCH",
});

export const ENTITY_STATUS = Object.freeze({
  ACTIVE:     "ACTIVE",
  INACTIVE:   "INACTIVE",
  PLANNED:    "PLANNED",
});

// ─── GLV Entity Registry ────────────────────────────────────────────────────────

export const GLV_ENTITIES = Object.freeze({

  GLV_SERVICES_SAS: {
    id:           "GLV_SERVICES_SAS",
    legalName:    "GLV Services SAS",
    shortName:    "GLV Services",
    country:      "COLOMBIA",
    currency:     "COP",
    type:         ENTITY_TYPES.OPERATING_COMPANY,
    status:       ENTITY_STATUS.ACTIVE,
    invoicePrefix:"GLV-SAS",
    // taxId, bankAccounts, signatures: resolved server-side only
  },

  GLV_GLOBAL_FOOD_SERVICES_LLC: {
    id:           "GLV_GLOBAL_FOOD_SERVICES_LLC",
    legalName:    "GLV Global Food Services LLC",
    shortName:    "GLV Food Services",
    country:      "USA",
    currency:     "USD",
    type:         ENTITY_TYPES.TRADING_COMPANY,
    status:       ENTITY_STATUS.ACTIVE,
    invoicePrefix:"GLV-LLC",
  },

  GLV_GLOBAL_FOODS_BRASIL: {
    id:           "GLV_GLOBAL_FOODS_BRASIL",
    legalName:    "GLV Global Foods Brasil Ltda.",
    shortName:    "GLV Brasil",
    country:      "BRAZIL",
    currency:     "BRL",
    type:         ENTITY_TYPES.SUBSIDIARY,
    status:       ENTITY_STATUS.ACTIVE,
    invoicePrefix:"GLV-BR",
  },

  GLV_GLOBAL_FOODS_ITALIA: {
    id:           "GLV_GLOBAL_FOODS_ITALIA",
    legalName:    "GLV Global Foods Italia SRL",
    shortName:    "GLV Italia",
    country:      "ITALY",
    currency:     "EUR",
    type:         ENTITY_TYPES.SUBSIDIARY,
    status:       ENTITY_STATUS.ACTIVE,
    invoicePrefix:"GLV-IT",
  },

  GLV_GLOBAL_COMMODITIES_TRADING: {
    id:           "GLV_GLOBAL_COMMODITIES_TRADING",
    legalName:    "GLV Global Commodities Trading FZ-LLC",
    shortName:    "GLV Commodities",
    country:      "UAE",
    currency:     "USD",
    type:         ENTITY_TYPES.TRADING_COMPANY,
    status:       ENTITY_STATUS.ACTIVE,
    invoicePrefix:"GLV-FZ",
  },

  GLV_GLOBAL_FOODS_INTERNATIONAL: {
    id:           "GLV_GLOBAL_FOODS_INTERNATIONAL",
    legalName:    "GLV Global Foods International Limited",
    shortName:    "GLV International",
    country:      "UNITED_KINGDOM",
    currency:     "GBP",
    type:         ENTITY_TYPES.TRADING_COMPANY,
    status:       ENTITY_STATUS.ACTIVE,
    invoicePrefix:"GLV-UK",
  },

});

// ─── Resolver functions ─────────────────────────────────────────────────────────

/**
 * Resolve an entity by ID.
 *
 * @param {string} entityId
 * @returns {object|null}
 */
export function resolveEntity(entityId) {
  return GLV_ENTITIES[entityId] || null;
}

/**
 * Get all active entities.
 *
 * @returns {object[]}
 */
export function getActiveEntities() {
  return Object.values(GLV_ENTITIES).filter(e => e.status === ENTITY_STATUS.ACTIVE);
}

/**
 * Get entities for a specific country.
 *
 * @param {string} country
 * @returns {object[]}
 */
export function getEntitiesForCountry(country) {
  return Object.values(GLV_ENTITIES).filter(e => e.country === country);
}

/**
 * Get the default invoice entity for a given operation country.
 * Falls back to GLV_GLOBAL_FOOD_SERVICES_LLC (USD) if no local entity found.
 *
 * @param {string} country
 * @returns {object}
 */
export function resolveInvoiceEntity(country) {
  const local = getEntitiesForCountry(country).find(
    e => e.status === ENTITY_STATUS.ACTIVE && e.type !== ENTITY_TYPES.HOLDING
  );
  return local || GLV_ENTITIES.GLV_GLOBAL_FOOD_SERVICES_LLC;
}

/**
 * List all entity IDs and their short names — safe for UI dropdowns.
 *
 * @returns {{ id: string, label: string }[]}
 */
export function listEntityOptions() {
  return Object.values(GLV_ENTITIES).map(e => ({
    id:     e.id,
    label:  `${e.legalName} (${e.country})`,
    short:  e.shortName,
    status: e.status,
  }));
}
