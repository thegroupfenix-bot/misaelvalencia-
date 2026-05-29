/**
 * LegalEntityRegistry.js
 * Canonical registry of GLV legal entities.
 * GLV_BUSINESS_OPERATING_MODEL_FOUNDATION_V1
 *
 * Pure ES module — no external dependencies, no side effects at load time.
 */

// ---------------------------------------------------------------------------
// ENTITY_STATUS (frozen enum)
// ---------------------------------------------------------------------------
export const ENTITY_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
});

// ---------------------------------------------------------------------------
// LEGAL_ENTITIES (frozen registry)
// ---------------------------------------------------------------------------
export const LEGAL_ENTITIES = Object.freeze({
  GLV_SERVICES_SAS: Object.freeze({
    id: 'GLV-SAS',
    name: 'GLV Services SAS',
    jurisdiction: 'CO',
    currency: 'USD',
    vatId: null,
    status: ENTITY_STATUS.ACTIVE,
    incorporatedAt: 2020,
  }),

  GLV_GLOBAL_FOOD_LLC: Object.freeze({
    id: 'GLV-LLC',
    name: 'GLV Global Food Services LLC',
    jurisdiction: 'US',
    currency: 'USD',
    vatId: null,
    status: ENTITY_STATUS.ACTIVE,
    incorporatedAt: 2021,
  }),

  GLV_BRAZIL: Object.freeze({
    id: 'GLV-BRZ',
    name: 'GLV Brazil (Future Entity)',
    jurisdiction: 'BR',
    currency: 'BRL',
    vatId: null,
    status: ENTITY_STATUS.PENDING,
    incorporatedAt: null,
  }),
});

// ---------------------------------------------------------------------------
// getLegalEntity(entityId)
// Returns the entity with the given id or throws a descriptive error.
// ---------------------------------------------------------------------------
export function getLegalEntity(entityId) {
  const entity = Object.values(LEGAL_ENTITIES).find((e) => e.id === entityId);
  if (!entity) {
    throw new Error(
      `getLegalEntity: entity with id "${entityId}" not found. ` +
        `Valid ids: ${Object.values(LEGAL_ENTITIES).map((e) => e.id).join(', ')}`
    );
  }
  return entity;
}

// ---------------------------------------------------------------------------
// getActiveEntities()
// Returns array of entities with status === ACTIVE.
// ---------------------------------------------------------------------------
export function getActiveEntities() {
  return Object.values(LEGAL_ENTITIES).filter(
    (e) => e.status === ENTITY_STATUS.ACTIVE
  );
}

// ---------------------------------------------------------------------------
// isValidEntity(entityId)
// Returns boolean — true if entityId matches a known entity.
// ---------------------------------------------------------------------------
export function isValidEntity(entityId) {
  return Object.values(LEGAL_ENTITIES).some((e) => e.id === entityId);
}
